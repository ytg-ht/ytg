/* script.js — final working generator (one Short per press)
   Requirements:
   - facts.js must define `const facts = [ "...", ... ];`
   - media files under /media/
   - Use Chrome/Edge desktop and when requested choose "This tab" + "Share audio"
*/

console.log("YT Short generator (final) loaded");

window.addEventListener("load", async () => {
  // sanity check: facts.js present
  if (!window.facts || !Array.isArray(facts) || facts.length === 0) {
    alert("facts.js missing or empty. Add your facts array before script.js");
    throw new Error("Missing facts");
  }

  // ---------- CONFIG ----------
  const BASE = "https://ytg-ht.github.io/ytg/"; // your base URL
  const VIDEOS = [
    "media/slime1.mp4",
    "media/slime2.mp4",
    "media/slime3.mp4",
    "media/slime4.mp4",
    "media/soap1.mp4"
  ];
  const FACTS_PER_SHORT = 7;
  const CHUNK_WORDS = 5;        // captions split into 5-word chunks
  const MIN_CHUNK_MS = 650;     // minimum ms per chunk
  const VIDEO_SWITCH_MIN = 1500;
  const VIDEO_SWITCH_MAX = 3000;

  // ---------- DOM ----------
  const topVideo = document.getElementById("topVideo");
  const captionText = document.getElementById("captionText");
  const generateBtn = document.getElementById("generateBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const voiceSelect = document.getElementById("voiceSelect");
  const status = document.getElementById("status");

  // ---------- voice mapping ----------
  let browserVoices = [];
  function refreshVoices() {
    browserVoices = speechSynthesis.getVoices();
    const us = browserVoices.find(v => /en-?us/i.test(v.lang) || /google us english/i.test(v.name));
    const ukMale = browserVoices.find(v => (/en-?gb|en-?uk/i.test(v.lang) && /male/i.test(v.name)) || /google uk english male/i.test(v.name));
    const fallbackUs = browserVoices.find(v => /en/i.test(v.lang)) || browserVoices[0];
    const fallbackUk = browserVoices.find(v => /en/i.test(v.lang) && v !== fallbackUs) || fallbackUs;
    voiceSelect.dataset.us = (us && us.name) || (fallbackUs && fallbackUs.name) || "";
    voiceSelect.dataset.uk = (ukMale && ukMale.name) || (fallbackUk && fallbackUk.name) || "";
  }
  speechSynthesis.onvoiceschanged = refreshVoices;
  refreshVoices();

  // ---------- helpers ----------
  function fullUrl(p) {
    if (/^https?:\/\//.test(p)) return p;
    return BASE + p.replace(/^\//, "");
  }

  function pickUniqueFacts(n) {
    const KEY = "ytg_used_v1";
    let used = [];
    try { used = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch(e){}
    const pool = [];
    for (let i=0;i<facts.length;i++) if (!used.includes(i)) pool.push(i);
    if (pool.length < n) { used = []; localStorage.setItem(KEY, JSON.stringify(used)); pool.length=0; for(let i=0;i<facts.length;i++) pool.push(i); }
    const chosen = [];
    for (let i=0;i<n;i++) {
      const idx = Math.floor(Math.random()*pool.length);
      const pick = pool.splice(idx,1)[0];
      chosen.push(pick);
      used.push(pick);
    }
    try { localStorage.setItem(KEY, JSON.stringify(used)); } catch(e){}
    return chosen.map(i => facts[i]);
  }

  function chunkText(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i=0;i<words.length;i+=CHUNK_WORDS) {
      chunks.push(words.slice(i,i+CHUNK_WORDS).join(" "));
    }
    return chunks;
  }

  function speakChunkWithVoice(text, which) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const name = which === "uk" ? voiceSelect.dataset.uk : voiceSelect.dataset.us;
      const v = speechSynthesis.getVoices().find(x => x.name === name);
      if (v) u.voice = v;
      u.rate = 1.0;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }

  // ---------- offscreen canvas for clean capture ----------
  const OUT_W = 720, OUT_H = 1280;
  const offCanvas = document.createElement("canvas");
  offCanvas.width = OUT_W;
  offCanvas.height = OUT_H;
  const octx = offCanvas.getContext("2d");

  let drawId = 0;
  function startDrawLoop(getCaption) {
    if (drawId) cancelAnimationFrame(drawId);
    function loop() {
      octx.clearRect(0,0,OUT_W,OUT_H);
      // draw video (cover)
      if (topVideo.videoWidth && topVideo.videoHeight) {
        const scale = Math.max(OUT_W / topVideo.videoWidth, OUT_H / topVideo.videoHeight);
        const nw = topVideo.videoWidth * scale, nh = topVideo.videoHeight * scale;
        const dx = (OUT_W - nw)/2, dy = (OUT_H - nh)/2;
        try { octx.drawImage(topVideo, dx, dy, nw, nh); } catch(e){}
      } else {
        octx.fillStyle = "#111";
        octx.fillRect(0,0,OUT_W,OUT_H);
      }

      // caption overlay
      const captionBoxH = Math.floor(OUT_H * 0.2);
      const captionY = OUT_H - captionBoxH - 60;
      const grad = octx.createLinearGradient(0, captionY, 0, OUT_H);
      grad.addColorStop(0, "rgba(0,0,0,0.45)");
      grad.addColorStop(1, "rgba(0,0,0,0.8)");
      octx.fillStyle = grad;
      octx.fillRect(0, captionY, OUT_W, captionBoxH + 80);

      // text
      octx.font = "bold 56px Arial";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      const text = (typeof getCaption === "function") ? getCaption() : captionText.textContent;
      const maxWidth = OUT_W - 120;
      const lines = wrapText(octx, text, maxWidth);
      const lineH = 64;
      const startY = captionY + (captionBoxH + 80 - lines.length*lineH)/2 + 10;

      octx.strokeStyle = "#000";
      octx.lineWidth = 10;
      for (let i=0;i<lines.length;i++) {
        const y = startY + i*lineH;
        octx.strokeText(lines[i], OUT_W/2, y);
      }
      octx.fillStyle = "#fff";
      for (let i=0;i<lines.length;i++) {
        const y = startY + i*lineH;
        octx.fillText(lines[i], OUT_W/2, y);
      }

      drawId = requestAnimationFrame(loop);
    }
    loop();
  }
  function stopDrawLoop() { if (drawId) cancelAnimationFrame(drawId); drawId = 0; }
  function wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------- video switching (random intervals & random seek) ----------
  let videoSwitcher = null;
  function startRandomVideoSwitching() {
    if (videoSwitcher) clearTimeout(videoSwitcher);
    function scheduleNext() {
      const t = VIDEO_SWITCH_MIN + Math.floor(Math.random()*(VIDEO_SWITCH_MAX - VIDEO_SWITCH_MIN));
      videoSwitcher = setTimeout(() => {
        const v = VIDEOS[Math.floor(Math.random()*VIDEOS.length)];
        topVideo.src = fullUrl(v);
        topVideo.addEventListener('loadedmetadata', function setRand() {
          try {
            const maxStart = Math.max(0.1, (topVideo.duration || 3) - 0.6);
            topVideo.currentTime = Math.random()*maxStart;
          } catch(e){}
          topVideo.removeEventListener('loadedmetadata', setRand);
        });
        topVideo.play().catch(()=>{ topVideo.muted = true; topVideo.play().catch(()=>{}); });
        scheduleNext();
      }, t);
    }
    scheduleNext();
  }
  function stopRandomVideoSwitching() { if (videoSwitcher) clearTimeout(videoSwitcher); videoSwitcher = null; }

  // ---------- play facts (chunks + tts) ----------
  async function playFactSequence(factsArray, selectedVoiceKey) {
    for (let i=0;i<factsArray.length;i++) {
      const fact = factsArray[i];
      const chunks = chunkText(fact);
      for (let j=0;j<chunks.length;j++) {
        captionText.textContent = chunks[j];
        const p = speakChunkWithVoice(chunks[j], selectedVoiceKey);
        const t = new Promise(r => setTimeout(r, MIN_CHUNK_MS));
        await Promise.all([p,t]);
        await new Promise(r => setTimeout(r, 120));
      }
      await new Promise(r => setTimeout(r, 250));
    }
    captionText.textContent = "Complete";
  }

  // ---------- generate & export handler ----------
  let running = false;
  generateBtn.addEventListener("click", async () => {
    if (running) return;
    running = true;
    generateBtn.disabled = true;
    downloadBtn.disabled = true;
    status.textContent = "Requesting tab capture (choose This tab + Share audio)...";

    // ask user to share tab (needed to capture TTS audio)
    let displayStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (e) {
      status.textContent = "Permission denied or unsupported.";
      console.error(e);
      generateBtn.disabled = false;
      running = false;
      return;
    }

    const audioTracks = displayStream.getAudioTracks();
    displayStream.getVideoTracks().forEach(t => t.stop());
    if (!audioTracks || audioTracks.length === 0) {
      status.textContent = "No tab audio detected. Ensure you selected 'This tab' and enabled 'Share audio'.";
    }

    status.textContent = "Preparing recording...";
    startDrawLoop(() => captionText.textContent);

    // combine canvas stream + tab audio
    const canvasStream = offCanvas.captureStream(30);
    const combined = new MediaStream();
    canvasStream.getVideoTracks().forEach(t => combined.addTrack(t));
    audioTracks.forEach(t => combined.addTrack(t));
    if (combined.getAudioTracks().length === 0) {
      const ac = new AudioContext();
      const dst = ac.createMediaStreamDestination();
      const osc = ac.createOscillator();
      osc.frequency.value = 0;
      osc.connect(dst);
      osc.start();
      combined.addTrack(dst.stream.getAudioTracks()[0]);
    }

    // recorder
    let recorder;
    let chunks = [];
    try {
      recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp8,opus' });
    } catch (e) {
      recorder = new MediaRecorder(combined);
    }
    recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };

    // pick facts & start
    const chosenFacts = pickUniqueFacts(FACTS_PER_SHORT);
    recorder.start(1000);
    status.textContent = "Recording... generating narration";

    // start random video switching
    startRandomVideoSwitching();

    const selectedKey = (voiceSelect.value === "google-uk-male") ? "uk" : "us";
    await playFactSequence(chosenFacts, selectedKey);

    // finalize recording
    await new Promise(r => setTimeout(r, 700));
    stopRandomVideoSwitching();
    speechSynthesis.cancel();
    recorder.stop();

    // wait for recorder to finalize
    await new Promise(resolve => {
      recorder.onstop = resolve;
      setTimeout(resolve, 4000);
    });

    const webmBlob = new Blob(chunks, { type: 'video/webm' });
    const webmUrl = URL.createObjectURL(webmBlob);

    status.textContent = "Converting to MP4 in-browser (ffmpeg.wasm)...";

    // convert webm -> mp4 with ffmpeg.wasm
    try {
      const { createFFmpeg, fetchFile } = FFmpeg;
      const ffmpeg = createFFmpeg({ log: false });
      await ffmpeg.load();

      await ffmpeg.FS('writeFile', 'input.webm', await fetchFile(webmBlob));
      await ffmpeg.run('-i', 'input.webm', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', 'output.mp4');
      const data = ffmpeg.FS('readFile', 'output.mp4');
      const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
      const mp4Url = URL.createObjectURL(mp4Blob);

      downloadBtn.disabled = false;
      downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = mp4Url;
        a.download = `short_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };

      status.textContent = "Conversion complete — MP4 ready. Click Download.";

      try { ffmpeg.FS('unlink', 'input.webm'); ffmpeg.FS('unlink', 'output.mp4'); } catch(e){}
      URL.revokeObjectURL(webmUrl);
    } catch (err) {
      console.error("ffmpeg conversion failed", err);
      const wUrl = URL.createObjectURL(webmBlob);
      downloadBtn.disabled = false;
      downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = wUrl;
        a.download = `short_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      status.textContent = "Conversion failed — provided WebM instead.";
    }

    // cleanup
    audioTracks.forEach(t => t.stop());
    stopDrawLoop();
    generateBtn.disabled = false;
    running = false;
  });

  // small preview helper
  window.ytg_preview = async () => {
    const chosen = pickUniqueFacts(FACTS_PER_SHORT);
    startDrawLoop(() => captionText.textContent);
    startRandomVideoSwitching();
    await playFactSequence(chosen, 'us');
    stopRandomVideoSwitching();
    stopDrawLoop();
  };
});
