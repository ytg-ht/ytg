/* script.js — final version
   - Requires facts.js (global const facts = [...])
   - Expects media files in /media/
   - Browser-only MP4 export using ffmpeg.wasm (user must share tab audio)
   - Captions show 5-word chunks while full fact is spoken (no mid-sentence pause)
*/

console.log("YT Short Generator — final build loaded");

(() => {
  // DOM
  const voiceSelect = document.getElementById('voiceSelect');
  const generateBtn = document.getElementById('generateBtn');
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const status = document.getElementById('status');
  const previewVideo = document.getElementById('previewVideo');
  const captionText = document.getElementById('captionText');

  // CONFIG
  const BASE = (location.origin + location.pathname).replace(/\/[^/]*$/, '/'); // current folder base
  const VIDEOS = [
    "media/slime1.mp4",
    "media/slime2.mp4",
    "media/slime3.mp4",
    "media/slime4.mp4",
    "media/soap1.mp4"
  ];
  const FACTS_PER_SHORT = 7;
  const CHUNK_WORDS = 5;
  const AVG_WPM = 160; // estimate
  const MS_PER_WORD = Math.round(60000 / AVG_WPM); // ~375ms/word

  // state
  let preparedFacts = [];
  let playing = false;
  let stopRequested = false;
  let voiceName = null;

  // sanity: facts should exist
  if (!Array.isArray(window.facts) || window.facts.length < FACTS_PER_SHORT) {
    status.textContent = "facts.js missing or too small — add at least " + FACTS_PER_SHORT + " facts.";
    generateBtn.disabled = true;
    playBtn.disabled = true;
    return;
  }

  // load voices into dropdown
  function loadVoices() {
    const vs = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';
    vs.forEach(v => {
      // include all english voices (user wanted to choose later)
      if (/^en/i.test(v.lang)) {
        const o = document.createElement('option');
        o.value = v.name;
        o.textContent = `${v.name} ${v.lang ? '('+v.lang+')' : ''}`;
        voiceSelect.appendChild(o);
      }
    });
    // fallback: if none, keep empty option
    if (!voiceSelect.options.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'No voices available';
      voiceSelect.appendChild(o);
    } else {
      // pick default en-US if present
      const preferred = Array.from(voiceSelect.options).find(opt => /en-?us/i.test(opt.text));
      if (preferred) voiceSelect.value = preferred.value;
    }
    voiceName = voiceSelect.value;
  }
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();

  // helper: pick N unique facts (no repeat inside single short)
  function pickFacts(n) {
    const out = [];
    const used = new Set();
    while (out.length < n) {
      const pick = window.facts[Math.floor(Math.random() * window.facts.length)];
      if (!used.has(pick)) { used.add(pick); out.push(pick); }
    }
    return out;
  }

  // split into 5-word chunks
  function chunkFact(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i=0;i<words.length;i+=CHUNK_WORDS) {
      chunks.push(words.slice(i, i+CHUNK_WORDS).join(' '));
    }
    return { chunks, wordsCount: words.length };
  }

  // speak whole fact (no splits), returns promise resolves when done
  function speakFactFull(text, voice) {
    return new Promise(resolve => {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) {
        const v = speechSynthesis.getVoices().find(x => x.name === voice);
        if (v) u.voice = v;
      }
      u.rate = 1.02;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }

  // caption animation: show next chunk (5 words) — simply update text (chunk switching handled by player)
  function showChunk(text) {
    captionText.textContent = text;
  }

  // random video switching while playing (independent)
  let switcherTimer = null;
  function startVideoSwitcher() {
    if (switcherTimer) clearTimeout(switcherTimer);
    function schedule() {
      if (stopRequested) return;
      const t = 1500 + Math.random()*1500; // 1.5-3s
      switcherTimer = setTimeout(() => {
        const v = VIDEOS[Math.floor(Math.random()*VIDEOS.length)];
        previewVideo.src = BASE + v;
        previewVideo.play().catch(()=>{});
        previewVideo.addEventListener('loadedmetadata', function once() {
          try { previewVideo.currentTime = Math.random() * Math.max(0.5, previewVideo.duration - 1.0); } catch(e){}
          previewVideo.removeEventListener('loadedmetadata', once);
        });
        schedule();
      }, t);
    }
    schedule();
  }
  function stopVideoSwitcher() { if (switcherTimer) clearTimeout(switcherTimer); switcherTimer = null; }

  // play the prepared facts (shows 5-word chunks while speaking the full fact)
  async function playPrepared() {
    if (!preparedFacts.length) return;
    playing = true;
    stopRequested = false;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    generateBtn.disabled = true;
    downloadBtn.disabled = true;
    status.textContent = "Playing...";

    // start video switching & play
    startVideoSwitcher();

    for (let i=0; i<preparedFacts.length; i++) {
      if (stopRequested) break;
      const fact = preparedFacts[i];
      const { chunks, wordsCount } = chunkFact(fact);
      const estMs = Math.max(700, wordsCount * MS_PER_WORD); // estimated TTS duration
      // compute durations for each chunk proportional to words in chunk
      const chunkWordCounts = chunks.map(c => c.split(/\s+/).filter(Boolean).length);
      const totalWords = chunkWordCounts.reduce((a,b)=>a+b,0) || wordsCount;
      const chunkDurations = chunkWordCounts.map(cnt => Math.max(300, Math.round(estMs * (cnt / totalWords))));

      // start TTS (speak whole fact)
      const tts = speakFactFull(fact, voiceName);

      // show chunks in sequence
      for (let j=0;j<chunks.length;j++) {
        if (stopRequested) break;
        showChunk(chunks[j]);
        await new Promise(r => setTimeout(r, chunkDurations[j]));
      }
      // wait for TTS end if it still hasn't ended
      await tts;
      // short pause between facts
      await new Promise(r => setTimeout(r, 320));
    }

    // finish
    stopRequested = true;
    stopVideoSwitcher();
    previewVideo.pause();
    captionText.textContent = "✔ Done!";
    playing = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
    generateBtn.disabled = false;
    downloadBtn.disabled = false; // enable download after playback
    status.textContent = "Finished — Download ready";
  }

  // STOP handler
  function stopPlayback() {
    stopRequested = true;
    speechSynthesis.cancel();
    stopVideoSwitcher();
    previewVideo.pause();
    captionText.textContent = "Stopped";
    playing = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
    generateBtn.disabled = false;
    status.textContent = "Stopped";
  }

  // GENERATE (prepare) — choose 7 unique facts and preload a random frame
  generateBtn.addEventListener('click', () => {
    preparedFacts = pickFacts(FACTS_PER_SHORT);
    captionText.textContent = "Short prepared — press Play";
    // preload a random video paused
    const v = VIDEOS[Math.floor(Math.random()*VIDEOS.length)];
    previewVideo.src = BASE + v;
    previewVideo.addEventListener('loadedmetadata', function once() {
      try { previewVideo.currentTime = Math.random() * Math.max(0.5, previewVideo.duration - 1.0); } catch(e){}
      previewVideo.pause();
      previewVideo.removeEventListener('loadedmetadata', once);
    });
    playBtn.disabled = false;
    stopBtn.disabled = true;
    downloadBtn.disabled = true;
    status.textContent = "Prepared";
  });

  // PLAY
  playBtn.addEventListener('click', async () => {
    if (!preparedFacts.length) { status.textContent = "Press Generate first"; return; }
    voiceName = voiceSelect.value || null;
    await playPrepared();
  });

  // STOP
  stopBtn.addEventListener('click', () => stopPlayback());

  // DOWNLOAD: re-run the prepared short while recording canvas + tab audio, then convert to MP4 via ffmpeg.wasm
  downloadBtn.addEventListener('click', async () => {
    if (!preparedFacts.length) { status.textContent = "Generate first"; return; }

    // ask user to share this tab (needed to capture TTS audio)
    status.textContent = "Requesting tab capture — choose THIS TAB and enable Share audio";
    let displayStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (e) {
      console.error(e);
      status.textContent = "Tab capture denied.";
      return;
    }

    // stop video track (we only want audio from tab)
    displayStream.getVideoTracks().forEach(t => t.stop());
    const audioTracks = displayStream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) {
      status.textContent = "No tab audio detected. Make sure you picked This Tab and Share audio.";
    }

    status.textContent = "Recording short — please wait until recording finishes";

    // create offscreen canvas to render 720x1280 frames (for MP4). We'll draw previewVideo + captions into it.
    const OUT_W = 720, OUT_H = 1280;
    const canvas = document.createElement('canvas');
    canvas.width = OUT_W; canvas.height = OUT_H;
    const ctx = canvas.getContext('2d');

    // draw loop
    let animId = 0;
    function drawFrame() {
      // black bg
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,OUT_W,OUT_H);
      // draw video scaled to full canvas
      try {
        ctx.drawImage(previewVideo, 0, 0, OUT_W, OUT_H);
      } catch(e){}
      // caption box (bottom)
      const captionBoxH = 220;
      const captionY = OUT_H - captionBoxH - 40;
      const grad = ctx.createLinearGradient(0, captionY, 0, OUT_H);
      grad.addColorStop(0, 'rgba(0,0,0,0.45)'); grad.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = grad; ctx.fillRect(0, captionY, OUT_W, captionBoxH + 40);
      // draw caption text (white with black outline)
      ctx.font = 'bold 48px system-ui, Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const text = captionText.textContent || '';
      // wrap text to max width
      const maxWidth = OUT_W - 160;
      const lines = wrapText(ctx, text, maxWidth);
      ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
      const lineHeight = 56;
      const startY = captionY + (captionBoxH+40 - lines.length*lineHeight)/2 + 10;
      for (let i=0;i<lines.length;i++) {
        const y = startY + i*lineHeight;
        ctx.strokeText(lines[i], OUT_W/2, y);
        ctx.fillText(lines[i], OUT_W/2, y);
      }
      animId = requestAnimationFrame(drawFrame);
    }

    function wrapText(ctx, text, maxWidth) {
      const words = text.split(' ');
      const lines = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > maxWidth && cur) {
          lines.push(cur); cur = w;
        } else cur = test;
      }
      if (cur) lines.push(cur);
      return lines;
    }

    // start draw loop and set up canvas stream
    drawFrame();
    const canvasStream = canvas.captureStream(30);
    const combined = new MediaStream();
    canvasStream.getVideoTracks().forEach(t => combined.addTrack(t));
    audioTracks.forEach(t => combined.addTrack(t));

    // ensure there's at least one audio track
    if (combined.getAudioTracks().length === 0) {
      const ac = new AudioContext();
      const dst = ac.createMediaStreamDestination();
      const osc = ac.createOscillator();
      osc.frequency.value = 0; osc.connect(dst); osc.start();
      combined.addTrack(dst.stream.getAudioTracks()[0]);
    }

    // recorder
    const chunks = [];
    let recorder;
    try {
      recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp8,opus' });
    } catch (e) {
      recorder = new MediaRecorder(combined);
    }
    recorder.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };

    // Start recording, then re-play prepared facts (same as playPrepared but without UI blocking)
    recorder.start(1000);

    // play video and TTS sequence (same timing logic) but ensure previewVideo is playing so frames are drawn
    previewVideo.play().catch(()=>{});
    startVideoSwitcher();

    for (let i=0;i<preparedFacts.length;i++) {
      const fact = preparedFacts[i];
      const { chunks: txtChunks, wordsCount } = chunkFact(fact);
      const estMs = Math.max(700, wordsCount * MS_PER_WORD);
      const chunkWordCounts = txtChunks.map(c => c.split(/\s+/).filter(Boolean).length);
      const totalWords = chunkWordCounts.reduce((a,b)=>a+b,0) || wordsCount;
      const chunkDurations = chunkWordCounts.map(cnt => Math.max(300, Math.round(estMs * (cnt / totalWords))));

      // speak full
      const tts = speakFactFull(fact, voiceName);

      // animate captions locally so drawing loop shows them
      for (let j=0;j<txtChunks.length;j++) {
        captionText.textContent = txtChunks[j];
        await new Promise(r => setTimeout(r, chunkDurations[j]));
      }
      await tts;
      await new Promise(r => setTimeout(r, 320));
    }

    // stop recording
    stopVideoSwitcher();
    previewVideo.pause();
    recorder.stop();

    // wait for recorder to finalize
    await new Promise(res => {
      recorder.onstop = res;
      setTimeout(res, 6000); // safety
    });

    // build webm blob
    const webmBlob = new Blob(chunks, { type: 'video/webm' });
    status.textContent = 'Converting to MP4 (in-browser)...';

    // convert to MP4 with ffmpeg.wasm
    try {
      const { createFFmpeg, fetchFile } = FFmpeg;
      const ffmpeg = createFFmpeg({ log: false });
      await ffmpeg.load();
      await ffmpeg.FS('writeFile', 'input.webm', await fetchFile(webmBlob));
      // convert
      await ffmpeg.run('-i', 'input.webm', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', 'output.mp4');
      const data = ffmpeg.FS('readFile', 'output.mp4');
      const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
      const mp4Url = URL.createObjectURL(mp4Blob);

      // provide download link
      const a = document.createElement('a');
      a.href = mp4Url;
      a.download = `short_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      status.textContent = 'Download ready (MP4).';
      // cleanup ffmpeg FS files
      try { ffmpeg.FS('unlink', 'input.webm'); ffmpeg.FS('unlink', 'output.mp4'); } catch(e){}
    } catch (err) {
      console.error('ffmpeg failed', err);
      // fallback: download webm
      const wUrl = URL.createObjectURL(webmBlob);
      const a = document.createElement('a');
      a.href = wUrl;
      a.download = `short_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      status.textContent = 'FFmpeg failed — downloaded WebM instead.';
    }

    // cleanup
    displayStream.getAudioTracks().forEach(t => t.stop());
    cancelAnimationFrame(animId);
  });

  // initial UI state
  playBtn.disabled = true;
  stopBtn.disabled = true;
  downloadBtn.disabled = true;
  status.textContent = "Ready";

})();
