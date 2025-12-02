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

/**
 * POST /render
 * multipart/form-data:
 *  - voice (required) : voice audio file (webm/mp3/wav)
 *  - music (optional)
 *  - video (optional)
 *  - captions : JSON stringified array of caption chunks
 *  - width (optional) & height (optional) -> defaults 720x1280
 */
app.post('/render', upload.fields([
  { name: 'voice', maxCount: 1 },
  { name: 'music', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.voice) {
      return res.status(400).json({ error: "voice audio file is required (field 'voice')" });
    }
    const voiceFile = req.files.voice[0].path;
    const musicFile = req.files.music ? req.files.music[0].path : null;
    const videoFile = req.files.video ? req.files.video[0].path : null;
    const captionsRaw = req.body.captions;
    if (!captionsRaw) return res.status(400).json({ error: "captions field required (JSON array)" });
    const captions = JSON.parse(captionsRaw);

    const gap = parseFloat(req.body.gap || "0.7");
    const outW = parseInt(req.body.width || "720", 10);
    const outH = parseInt(req.body.height || "1280", 10);

    const voiceDur = await getDuration(voiceFile);
    const n = captions.length;
    const totalGap = gap * (n - 1);
    const per = Math.max(0.2, (voiceDur - totalGap) / n);
    const perDurations = new Array(n).fill(per);

    const srtPath = path.join('uploads', `captions-${Date.now()}.srt`);
    writeSRT(captions, perDurations, gap, srtPath);

    // choose input video
    let inputVideo = videoFile;
    if (!inputVideo) {
      // find one random in ./media
      const mediaFolder = path.join(__dirname, 'media');
      const candidates = [];
      if (fs.existsSync(mediaFolder)) {
        for (const f of fs.readdirSync(mediaFolder)) {
          const ext = path.extname(f).toLowerCase();
          if (['.mp4', '.mov', '.webm', '.mkv'].includes(ext)) candidates.push(path.join(mediaFolder, f));
        }
      }
      if (candidates.length === 0) {
        return res.status(400).json({ error: "No video provided and no local media found in ./media" });
      }
      inputVideo = candidates[Math.floor(Math.random() * candidates.length)];
    }

    // output path
    if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
    const outPath = path.join('outputs', `short-${Date.now()}.mp4`);

    // Video filter: scale to width x topH (60% of height), pad to full height
    const topH = Math.round(outH * 0.60);
    const bottomH = outH - topH;

    // We'll use ffmpeg to:
    // - scale video to outW x topH (crop/pad as needed)
    // - pad/stack a black bar at bottom for captions (bottomH)
    // - burn subtitles with the SRT into the black area (subtitles filter)
    // - mix voice + music (if present)
    // Steps: map inputs: 0 = video, 1 = voice, 2 = music (if provided)

    const command = ffmpeg();

    command.input(inputVideo);
    command.input(voiceFile);
    if (musicFile) command.input(musicFile);

    // construct audio mixing filter
    // If music present, we mix voice + music; otherwise voice only.
    // We'll normalize voice volume and slightly lower music.
    let audioFilter = '';
    if (musicFile) {
      // inputs: 1:a = voice, 2:a = music
      audioFilter = `[1:a]volume=1.0[avoice];` +
                    `[2:a]volume=0.15[amusic];` +
                    `[avoice][amusic]amix=inputs=2:duration=longest:dropout_transition=0[aout]`;
    } else {
      audioFilter = `[1:a]aformat=channel_layouts=stereo[aout]`;
    }

    // video filter: scale input to width x topH and pad bottom with black
    const vf = `scale=${outW}:${topH}:force_original_aspect_ratio=decrease,pad=${outW}:${topH}:(ow-iw)/2:(oh-ih)/2,setsar=1[topv];` +
               `color=size=${outW}x${bottomH}:color=black[bar];` +
               `[topv][bar]vstack=inputs=2[vstack]`;

    // full complex filter
    const complex = [
      { filter: 'split', inputs: '0:v', outputs: ['vsplit0','vsplit1'] },
      // scale & pad placed as raw vf above using -vf later with subtitles
    ];

    // We'll instead use simpler approach: use -vf for subtitles and -filter_complex for audio mixing
    command
      .complexFilter(audioFilter, ['aout'])
      .outputOptions([
        '-map 0:v',
        '-map [aout]',
        `-vf subtitles=${srtPath.replace(/\\/g,'/')} ,scale=${outW}:${outH}`,
        '-r 30',
        '-movflags +faststart',
        '-preset veryfast',
        '-crf 23'
      ])
      .output(outPath)
      .on('start', cmd => console.log('ffmpeg start:', cmd))
      .on('progress', p => console.log('progress', p))
      .on('error', (err, stdout, stderr) => {
        console.error('ffmpeg error', err);
        console.error(stderr);
        res.status(500).json({ error: 'ffmpeg failed', detail: err.message });
      })
      .on('end', () => {
        res.download(outPath, err => {
          // cleanup
          try { fs.unlinkSync(voiceFile); } catch(e){}
          if (musicFile) try { fs.unlinkSync(musicFile); } catch(e){}
          if (req.files.video) try { fs.unlinkSync(req.files.video[0].path); } catch(e){}
          try { fs.unlinkSync(srtPath); } catch(e){}
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
