// server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const cors = require('cors');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

/**
 * Expected multipart/form-data fields:
 * - video (optional) : satisfying video file (if not provided, server can pick from media/)
 * - voice (required) : voice audio file (wav/mp3)
 * - music (optional) : background music file (mp3)
 * - captions : JSON stringified array of caption chunks (["line1","line2", ...])
 *
 * Response: streamed mp4 file as attachment
 */

function secondsToTimestamp(s) {
    const hr = Math.floor(s / 3600);
    s -= hr * 3600;
    const min = Math.floor(s / 60);
    const sec = s - min * 60;
    const ms = Math.floor((sec - Math.floor(sec)) * 1000);
    const secs = Math.floor(sec);
    return `${String(hr).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(secs).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

function writeSRT(captions, perDurations, gap = 0.7, outPath) {
    // captions: array of strings
    // perDurations: array of durations for each caption display (seconds)
    let cur = 0;
    let srt = '';
    for (let i = 0; i < captions.length; i++) {
        const start = cur;
        const dur = perDurations[i];
        const end = start + dur;
        srt += `${i+1}\n`;
        srt += `${secondsToTimestamp(start)} --> ${secondsToTimestamp(end)}\n`;
        srt += `${captions[i]}\n\n`;
        cur = end + gap;
    }
    fs.writeFileSync(outPath, srt, 'utf8');
}

function getDuration(filePath) {
    return new Promise((res, rej) => {
        ffmpeg.ffprobe(filePath, (err, meta) => {
            if (err) return rej(err);
            res(meta.format.duration);
        });
    });
}

app.post('/render', upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'voice', maxCount: 1 },
    { name: 'music', maxCount: 1 },
]), async (req, res) => {
    try {
        if (!req.files || !req.files.voice) {
            return res.status(400).json({ error: "voice audio file is required (field 'voice')" });
        }

        // get uploaded files or defaults
        const voiceFile = req.files.voice[0].path;
        const musicFile = req.files.music ? req.files.music[0].path : null;
        const videoFile = req.files.video ? req.files.video[0].path : null;

        // captions array (stringified JSON) from body
        const captionsRaw = req.body.captions;
        if (!captionsRaw) return res.status(400).json({ error: "captions field required (JSON array)" });
        const captions = JSON.parse(captionsRaw);

        // compute durations
        const voiceDur = await getDuration(voiceFile);
        // We'll split voiceDur across caption chunks, leaving gaps (0.7s) between them.
        const gap = 0.7;
        const n = captions.length;
        const totalGap = gap * (n - 1);
        // per caption display duration: subtract total gaps, divide remaining duration
        const per = Math.max(0.2, (voiceDur - totalGap) / n); // minimum 0.2s
        const perDurations = new Array(n).fill(per);

        // write SRT
        const srtPath = path.join('uploads', `captions-${Date.now()}.srt`);
        writeSRT(captions, perDurations, gap, srtPath);

        // paths
        const outPath = path.join('outputs', `short-${Date.now()}.mp4`);
        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');

        // choose input video: if not provided, try to use a local media file from ./media
        let inputVideo = videoFile;
        if (!inputVideo) {
            // pick first found in ./media that looks like a video
            const mediaFolder = path.join(__dirname, 'media');
            const candidates = [];
            if (fs.existsSync(mediaFolder)) {
                for (const f of fs.readdirSync(mediaFolder)) {
                    const ext = path.extname(f).toLowerCase();
                    if (['.mp4', '.mov', '.webm', '.mkv'].includes(ext)) candidates.push(path.join(mediaFolder, f));
                }
            }
            if (candidates.length === 0) return res.status(400).json({ error: "No video provided and no local media found" });
            inputVideo = candidates[Math.floor(Math.random() * candidates.length)];
        }

        // Build complex ffmpeg command:
        // 1) scale input video to 720x768 (top 60% = 768px), pad to 720x1280 with black bottom 512px
        // 2) overlay subtitles (SRT) on the bottom area (will appear inside the black bar)
        // 3) combine audio: voice + music (if available), duck music volume during voice segments (we use volume enable between())
        // We'll create a music filter string that reduces music volume to 0.18 during each voice chunk interval.

        // get voice duration (done), but also get music duration if present
        let musicFilter = '';
        if (musicFile) {
            // Reduce music volume to 0.18 during voice intervals.
            // Build a single 'volume' expression with successive enable segments is not supported directly,
            // so we generate an "volume=1, volume=enable='between(t,st,et)':volume=0.18" sequence per interval by chaining 'adelay' or using 'volume' with enable multiple times is tricky.
            // Simpler approach: create a complex filter that first loads music, then applies a 'volume' filter that uses an expression:
            // volume='if(gt(t,0),1,1)' doesn't help for many intervals. Instead we apply multiple volume filters with enable per interval using filter_complex labels.
            // We'll programmatically add one filter per interval.
        }

        // Compose filter_complex programmatically
        // We'll produce filter_complex pieces:
        // - [0:v] scale and pad -> [bg]
        // - subtitles will be applied with the subtitles filter (requires libass). We'll use -vf "subtitles=srtPath:force_style='FontName=Arial,Fontsize=36,...'"
        //
        // For audio:
        // Inputs: voice (say input index X), music (input index Y)
        // We'll use amix to mix voice and music, but reduce music volume during voice segments by applying volume filter with enable between() for each segment.

        // To avoid fighting ffmpeg filter syntax in this small example, we'll do this:
        // 1) create a version of the music where during voice times its volume is reduced by overlaying a 'volume' filter with multiple enable clauses by chaining them.
        // 2) then amix voice + adjusted music.

        // We'll craft command in fluent-ffmpeg:
        const command = ffmpeg();

        // add video input
        command.input(inputVideo);

        // add voice audio input
        command.input(voiceFile);

        let musicProvided = false;
        if (musicFile) {
            command.input(musicFile);
            musicProvided = true;
        }

        // Build video filter: scale to 720x768, pad to 720x1280 (black)
        // video is input 0
        const videoFilter = `[0:v]scale=720:768:force_original_aspect_ratio=decrease,pad=720:768:(ow-iw)/2:(oh-ih)/2,setsar=1[topv];` +
                            `color=size=720x512:color=black[bar];` +
                            `[topv][bar]vstack=inputs=2[vout]`;
        // We'll apply subtitles after building the padded video by using -vf "subtitles=..."
        // fluent-ffmpeg doesn't easily accept subtitles via filter_complex directly with local path that contains colon windows issues.
        // So we'll pass subtitles using -vf "subtitles='path/to/srt':force_style=...". Use double quotes safely.

        // Build audio filter: we want to mix voice (input 1) and music (input 2 if present)
        // We'll compute intervals where voice is present:
        const nChunks = captions.length;
        const perDur = per; // per second per chunk
        const intervals = [];
        let cur = 0;
        for (let i = 0; i < nChunks; i++) {
            const st = cur;
            const et = cur + perDur;
            intervals.push({ st, et });
            cur = et + gap;
        }

        // Build ffmpeg command with fluent-ffmpeg args
        // Approach:
        //  - create a filter_complex block that:
        //      scales/pads video -> [vout]
        //      if music exists:
        //         apply volume filters to music stream to reduce during each interval -> [music_adj]
        //      amix voice + music_adj -> [mixed]
        //  - map [vout] and [mixed] to output
        //
        // For simplicity and robustness, we'll write a temporary filter_complex string and pass it via .complexFilter()

        const filters = [];
        // video stack filter
        filters.push({
            filter: 'scale',
            options: { w: 720, h: 768, force_original_aspect_ratio: 'decrease' },
            inputs: '0:v',
            outputs: 'vs'
        });
        filters.push({
            filter: 'pad',
            options: { w: 720, h: 768, x: '(ow-iw)/2', y: '(oh-ih)/2' },
            inputs: 'vs',
            outputs: 'vpad'
        });
        // create bar
        filters.push({
            filter: 'color',
            options: { size: '720x512', color: 'black' },
            outputs: 'bar'
        });
        // vstack
        filters.push({
            filter: 'vstack',
            options: { inputs: 2 },
            inputs: ['vpad','bar'],
            outputs: 'vout'
        });

        // Now audio filters
        if (musicProvided) {
            // We'll take input indices: voice = 1:a, music = 2:a (or vice versa if video has audio)
            // To keep index mapping consistent, force map: inputs added in order: 0=video,1=voice,2=music
            // Create music adjust filters: we'll start with music stream labeled [2:a] -> [music0]
            filters.push({ filter: 'anull', inputs: '2:a', outputs: 'music_in' }); // placeholder

            // For each interval, we add a volume filter with enable between to reduce music volume
            // But fluent filters require names; we'll chain them: music_in -> vol1 -> vol2 -> ... -> music_adj
            let prev = 'music_in';
            intervals.forEach((it, idx) => {
                const outLabel = `music_v${idx}`;
                const enableExpr = `between(t,${it.st.toFixed(3)},${it.et.toFixed(3)})`;
                // during enabled time, set volume to 0.18, otherwise 1
                // use "volume=if(${enableExpr},0.18,1)" — ffmpeg allows expression use
                filters.push({
                    filter: 'volume',
                    options: `if(${enableExpr},0.18,1)`,
                    inputs: prev,
                    outputs: outLabel
                });
                prev = outLabel;
            });
            // final music adjusted label
            filters.push({ filter: 'anull', inputs: prev, outputs: 'music_adj' });

            // Now mix voice (1:a) and music_adj
            filters.push({
                filter: 'amix',
                options: { inputs: 2, dropout_transition: 0 },
                inputs: ['1:a','music_adj'],
                outputs: 'mixed'
            });
            // Normalize mixed volume
            filters.push({
                filter: 'volume',
                options: '1.0',
                inputs: 'mixed',
                outputs: 'finalaudio'
            });
        } else {
            // only voice
            filters.push({
                filter: 'anull',
                inputs: '1:a',
                outputs: 'finalaudio'
            });
        }

        // Pass complex filters to ffmpeg
        command.complexFilter(filters, ['vout','finalaudio']);

        // subtitles using srt: use -map and -vf "subtitles=path:force_style=..." on the vout stream.
        // fluent-ffmpeg does not easily accept a subtitles filter with complexFilter output; we will map vout to output and then re-apply subtitles by another filter through -vf.
        // Simpler: use stream mapping with -map and -filter_complex already created; then use -vf subtitles= to burn in SRT.
        const subtitleStyle = `FontName=Arial,Fontsize=48,PrimaryColour=&H00FFFFFF,BackColour=&H00000000,BorderStyle=3,Outline=2,Alignment=2`; // centered

        // prepare command options
        command
            .outputOptions([
                '-map [vout]',
                '-map [finalaudio]',
                // subtitles via libass
                `-vf subtitles=${srtPath.replace(/\\/g,'/')}:force_style='FontName=Arial,Fontsize=48,PrimaryColour=&H00FFFFFF,BackColour=&H00000000,BorderStyle=3,Outline=2,Alignment=2'`,
                '-r 30',
                '-movflags +faststart',
                '-preset veryfast',
                '-crf 23'
            ])
            .output(outPath)
            .on('start', cmd => {
                console.log('ffmpeg cmd:', cmd);
            })
            .on('progress', p => {
                console.log('progress', p);
            })
            .on('error', (err, stdout, stderr) => {
                console.error('ffmpeg error', err);
                console.error(stderr);
                return res.status(500).json({ error: 'ffmpeg failed', detail: err.message });
            })
            .on('end', () => {
                // stream file to client
                res.download(outPath, err => {
                    // cleanup temp files
                    try { fs.unlinkSync(voiceFile); } catch(e){}
                    if (musicFile) try { fs.unlinkSync(musicFile); } catch(e){}
                    if (req.files.video) try { fs.unlinkSync(req.files.video[0].path); } catch(e){}
                    try { fs.unlinkSync(srtPath); } catch(e){}
                    // optional: keep out file for some time, or delete immediately
                });
            })
            .run();

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Renderer server listening on ${PORT}`));
