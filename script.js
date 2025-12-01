/* script.js — final (60/40, left controls, US/UK male presets)
   Requires:
   - facts.js that sets window.facts = [...]
   - media files in /media/
   - Chrome/Edge desktop for best TTS & tab audio capture
*/

console.log("YT Short Generator — active");

(() => {
  // DOM
  const voicePreset = document.getElementById('voicePreset');
  const generateBtn = document.getElementById('generateBtn');
  const playBtn = document.getElementById('playBtn');
  const stopBtn = document.getElementById('stopBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const status = document.getElementById('status');
  const previewVideo = document.getElementById('previewVideo');
  const captionText = document.getElementById('captionText');

  // config
  const VIDEOS = [
    "media/slime1.mp4",
    "media/slime2.mp4",
    "media/slime3.mp4",
    "media/slime4.mp4",
    "media/soap1.mp4"
  ];
  const FACTS_PER_SHORT = 7;
  const CHUNK_WORDS = 5;
  const AVG_WPM = 160;
  const MS_PER_WORD = Math.round(60000 / AVG_WPM);

  // base path calculation (folder containing this HTML)
  const BASE = location.origin + location.pathname.replace(/\/[^/]*$/, '/');

  // state
  let preparedFacts = [];
  let playing = false;
  let stopRequested = false;
  let switchTimer = null;
  let voiceName = null;

  // validate facts
  if (!Array.isArray(window.facts) || window.facts.length < FACTS_PER_SHORT) {
    status.textContent = `facts.js missing or too small — add at least ${FACTS_PER_SHORT} facts.`;
    generateBtn.disabled = true;
    return;
  }

  // map presets to actual browser voice names (attempts)
  let preferredVoices = { us_male: null, uk_male: null };

  function discoverVoices() {
    const vs = speechSynthesis.getVoices();
    // find english-us male
    preferredVoices.us_male = (vs.find(v => /^en-?us/i.test(v.lang) && /male/i.test(v.name)) ||
                               vs.find(v => /^en-?us/i.test(v.lang)) ||
                               vs.find(v => /english/i.test(v.lang)) || vs[0])?.name || null;
    preferredVoices.uk_male = (vs.find(v => /^en-?gb/i.test(v.lang) && /male/i.test(v.name)) ||
                               vs.find(v => /^en-?gb/i.test(v.lang)) ||
                               vs.find(v => /english/i.test(v.lang) && /male/i.test(v.name)) ||
                               vs[0])?.name || null;
    // if discovery failed, keep null — the speak routine will pick best available
  }
  speechSynthesis.onvoiceschanged = discoverVoices;
  discoverVoices();

  // helpers
  function pickUniqueFacts(n) {
    const idxs = [];
    const used = new Set();
    while (idxs.length < n) {
      const i = Math.floor(Math.random() * window.facts.length);
      if (!used.has(i)) { used.add(i); idxs.push(i); }
    }
    return idxs.map(i => window.facts[i]);
  }

  function chunkText(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i=0; i<words.length; i+=CHUNK_WORDS) chunks.push(words.slice(i,i+CHUNK_WORDS).join(' '));
    return { chunks, wordsCount: words.length };
  }

  function speakFull(text, name) {
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(text);
      if (name) {
        const v = speechSynthesis.getVoices().find(x => x.name === name);
        if (v) u.voice = v;
      }
      u.rate = 1.02;
      u.onend = () => res();
      u.onerror = () => res();
      speechSynthesis.speak(u);
    });
  }

  function startSwitcher() {
    if (switchTimer) clearTimeout(switchTimer);
    function schedule() {
      if (stopRequested) return;
      const t = 1500 + Math.random()*1500;
      switchTimer = setTimeout(() => {
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
  function stopSwitcher() { if (switchTimer) clearTimeout(switchTimer); switchTimer = null; }

  // prepare short
  generateBtn.addEventListener('click', () => {
    preparedFacts = pickUniqueFacts(FACTS_PER_SHORT);
    captionText.textContent = "Short prepared — press Play";
    status.textContent = "Prepared";
    // preload a random video (paused)
    const v = VIDEOS[Math.floor(Math.random()*VIDEOS.length)];
    previewVideo.src = BASE + v;
    previewVideo.addEventListener('loadedmetadata', function once() {
      try { previewVideo.currentTime = Math.random() * Math.max(0.5, previewVideo.duration - 1.0); } catch(e){}
      previewVideo.pause(); previewVideo.removeEventListener('loadedmetadata', once);
    });
    playBtn.disabled = false;
    stopBtn.disabled = true;
    downloadBtn.disabled = true;
  });

  // playback sequence
  async function playSequence() {
    if (!preparedFacts.length) { status.textContent = "Generate first"; return; }
    playing = true; stopRequested = false;
    playBtn.disabled = true; stopBtn.disabled = false; generateBtn.disabled = true; downloadBtn.disabled = true;
    status.textContent = "Playing...";
    // choose voice from preset selection
    const preset = voicePreset.value;
    voiceName = preferredVoices[preset] || null;

    // start videos switching
    startSwitcher();

    for (let i=0;i<preparedFacts.length;i++) {
      if (stopRequested) break;
      const fact = preparedFacts[i];
      const { chunks, wordsCount } = chunkText(fact);
      const estMs = Math.max(700, wordsCount * MS_PER_WORD);
      const wordCounts = chunks.map(c=>c.split(/\s+/).filter(Boolean).length);
      const chunkDur = wordCounts.map(cnt => Math.max(300, Math.round(estMs * (cnt / (wordCounts.reduce((a,b)=>a+b,0)||wordsCount)))));

      // speak whole fact
      const tts = speakFull(fact, voiceName);

      // show chunks sequentially
      for (let j=0;j<chunks.length;j++) {
        if (stopRequested) break;
        captionText.textContent = chunks[j];
        await new Promise(r => setTimeout(r, chunkDur[j]));
      }

      await tts;
      await new Promise(r => setTimeout(r, 320)); // short pause between facts
    }

    // finish
    stopRequested = true;
    stopSwitcher();
    previewVideo.pause();
    captionText.textContent = "✔ Done!";
    playing = false;
    playBtn.disabled = false; stopBtn.disabled = true; generateBtn.disabled = false; downloadBtn.disabled = false;
    status.textContent = "Finished — Download ready";
  }

  // stop handler
  function stopAll() {
    stopRequested = true;
    speechSynthesis.cancel();
    stopSwitcher();
    previewVideo.pause();
    captionText.textContent = "Stopped";
    playing = false;
    playBtn.disabled = false; stopBtn.disabled = true; generateBtn.disabled = false;
    status.textContent = "Stopped";
  }

  playBtn.addEventListener('click', () => {
    if (playing) return;
    playSequence();
  });
  stopBtn.addEventListener('click', () => stopAll());

  // DOWNLOAD: re-play while recording canvas + tab audio then ffmpeg convert
  downloadBtn.addEventListener('click', async () => {
    if (!preparedFacts.length) { status.textContent = "Generate first"; return; }

    status.textContent = "Requesting tab capture — choose THIS TAB and Share audio";
    let disp;
    try {
      disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch(e) {
      status.textContent = "Tab capture denied.";
      return;
    }
    // stop video tracks (we only need audio)
    disp.getVideoTracks().forEach(t=>t.stop());
    const audioTracks = disp.getAudioTracks();

    status.textContent = "Recording — do not switch tabs";
    // prepare canvas 720x1280
    const W = 720, H = 1280;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    let rafId;
    function draw() {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H);
      // draw video scaled to cover
      try { ctx.drawImage(previewVideo, 0, 0, W, H); } catch(e){}
      // caption box
      const ch = 260; const cy = H - ch - 40;
      const grad = ctx.createLinearGradient(0, cy, 0, H); grad.addColorStop(0,'rgba(0,0,0,0.45)'); grad.addColorStop(1,'rgba(0,0,0,0.8)');
      ctx.fillStyle = grad; ctx.fillRect(0, cy, W, ch+40);
      // draw caption
      ctx.font = 'bold 48px system-ui, Arial'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.lineWidth=8; ctx.strokeStyle='#000';
      const text = captionText.textContent || '';
      const lines = wrapText(ctx, text, W-160);
      const lh = 56; const startY = cy + (ch - lines.length*lh)/2 + 20;
      for (let i=0;i<lines.length;i++) {
        const y = startY + i*lh;
        ctx.strokeText(lines[i], W/2, y);
        ctx.fillText(lines[i], W/2, y);
      }
      rafId = requestAnimationFrame(draw);
    }
    function wrapText(ctx, text, maxW) {
      const words = text.split(' ');
      const lines = []; let cur='';
      for (const w of words) {
        const test = cur ? cur+' '+w : w;
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur=w; } else cur=test;
      }
      if (cur) lines.push(cur); return lines;
    }

    draw();
    const canvasStream = canvas.captureStream(30);
    const combined = new MediaStream();
    canvasStream.getVideoTracks().forEach(t=>combined.addTrack(t));
    audioTracks.forEach(t=>combined.addTrack(t));
    if (combined.getAudioTracks().length===0) {
      const ac = new AudioContext(); const dst = ac.createMediaStreamDestination(); const osc = ac.createOscillator(); osc.frequency.value=0; osc.connect(dst); osc.start(); combined.addTrack(dst.stream.getAudioTracks()[0]);
    }

    const blobs = [];
    let recorder;
    try { recorder = new MediaRecorder(combined, { mimeType:'video/webm;codecs=vp8,opus' }); }
    catch(e) { recorder = new MediaRecorder(combined); }
    recorder.ondataavailable = e => { if (e.data && e.data.size) blobs.push(e.data); };
    recorder.start(1000);

    // replay sequence (synchronous to what playSequence does)
    previewVideo.play().catch(()=>{});
    startSwitcher();

    for (let i=0;i<preparedFacts.length;i++) {
      const fact = preparedFacts[i];
      const { chunks, wordsCount } = chunkText(fact);
      const estMs = Math.max(700, wordsCount * MS_PER_WORD);
      const wc = chunks.map(c=>c.split(/\s+/).filter(Boolean).length);
      const total = wc.reduce((a,b)=>a+b,0)||wordsCount;
      const cdurs = wc.map(cnt => Math.max(300, Math.round(estMs*(cnt/total))));
      const tts = speakFull(fact, preferredVoices[voicePreset.value] || null);
      for (let j=0;j<chunks.length;j++) {
        captionText.textContent = chunks[j];
        await new Promise(r=>setTimeout(r, cdurs[j]));
      }
      await tts;
      await new Promise(r=>setTimeout(r,320));
    }

    // finish
    stopSwitcher(); previewVideo.pause();
    recorder.stop();
    await new Promise(res => { recorder.onstop = res; setTimeout(res,4000); });

    // build webm
    const webm = new Blob(blobs, { type:'video/webm' });
    status.textContent = 'Converting to MP4... (browser)';
    try {
      const { createFFmpeg, fetchFile } = FFmpeg;
      const ffmpeg = createFFmpeg({ log:false });
      await ffmpeg.load();
      await ffmpeg.FS('writeFile','input.webm', await fetchFile(webm));
      await ffmpeg.run('-i','input.webm','-c:v','libx264','-preset','veryfast','-crf','28','-c:a','aac','-b:a','128k','output.mp4');
      const data = ffmpeg.FS('readFile','output.mp4');
      const mp4 = new Blob([data.buffer], { type:'video/mp4' });
      const url = URL.createObjectURL(mp4);
      const a = document.createElement('a'); a.href=url; a.download = `short_${Date.now()}.mp4`; document.body.appendChild(a); a.click(); a.remove();
      status.textContent = 'Download ready';
      try { ffmpeg.FS('unlink','input.webm'); ffmpeg.FS('unlink','output.mp4'); } catch(e){}
    } catch(err) {
      console.error('ffmpeg failed', err);
      const url = URL.createObjectURL(webm);
      const a = document.createElement('a'); a.href=url; a.download = `short_${Date.now()}.webm`; document.body.appendChild(a); a.click(); a.remove();
      status.textContent = 'Downloaded WebM (ffmpeg failed)';
    }

    // cleanup
    disp.getAudioTracks().forEach(t=>t.stop());
    cancelAnimationFrame(rafId);
  });

  // initial UI
  playBtn.disabled = true; stopBtn.disabled = true; downloadBtn.disabled = true; status.textContent = 'Ready';

})();
