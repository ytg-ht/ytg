/* script.js
  - Requires facts.js (must define `facts` array)
  - Expects media files under /media/ (served from your GitHub Pages root)
  - Records canvas+tab audio to webm, then converts to MP4 using ffmpeg.wasm
  - Video behavior: changes randomly every few seconds (independent of facts), starts at random positions
  - Captions are chunked (5 words) and synced to browser TTS; voice options map to browser voices
*/

console.log("YT Short generator (MP4) loaded");

window.addEventListener("load", async () => {
  if (!window.facts || !Array.isArray(facts) || facts.length === 0) {
    alert("facts.js missing or empty. Add your facts array before script.js");
    throw new Error("Missing facts");
  }

  /* ---------- CONFIG ---------- */
  const BASE = "https://ytg-ht.github.io/ytg/"; // your base URL
  const VIDEOS = [
    "media/slime1.mp4",
    "media/slime2.mp4",
    "media/slime3.mp4",
    "media/slime4.mp4",
    "media/soap1.mp4"
  ];
  const FACTS_PER_SHORT = 7;
  const CHUNK_WORDS = 5;
  const MIN_CHUNK_MS = 650;
  const VIDEO_SWITCH_MS = 2000 + Math.floor(Math.random()*1500); // random-ish interval (will randomize again each switch)

  /* ---------- DOM ---------- */
  const topVideo = document.getElementById("topVideo");
  const captionText = document.getElementById("captionText");
  const generateBtn = document.getElementById("generateBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const voiceSelect = document.getElementById("voiceSelect");
  const status = document.getElementById("status");

  /* ---------- Helpers: voices ---------- */
  let browserVoices = [];
  function refreshVoices() {
    browserVoices = speechSynthesis.getVoices();
    // try to map the two desired choices to best matches
    // google voice names vary; we map by lang + keywords
    const us = browserVoices.find(v => /en-?us/i.test(v.lang) || /google us english/i.test(v.name));
    const ukMale = browserVoices.find(v => (/en-?gb|en-?uk/i.test(v.lang) && /male/i.test(v.name)) || /british male/i.test(v.name) || /google uk english male/i.test(v.name));
    // fallback picks
    const fallbackUs = browserVoices.find(v => /en/i.test(v.lang)) || browserVoices[0];
    const fallbackUk = browserVoices.find(v => /en/i.test(v.lang) && v !== fallbackUs) || fallbackUs;

    voiceSelect.dataset.us = (us && us.name) || (fallbackUs && fallbackUs.name) || "";
    voiceSelect.dataset.uk = (ukMale && ukMale.name) || (fallbackUk && fallbackUk.name) || "";
  }
  speechSynthesis.onvoiceschanged = refreshVoices;
  refreshVoices();

  /* ---------- Utilities ---------- */
  function fullUrl(p) {
    if (/^https?:\/\//.test(p)) return p;
    return BASE + p.replace(/^\//, "");
  }

  function pickUniqueFacts(n) {
    // simple reservoir with localStorage persistence to avoid repeats across runs
    const KEY = "ytg_used_v1";
    let used = [];
    try { used = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch(e){}
    // build pool of unused indices
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
      const name = which === "us" ? voiceSelect.dataset.us : voiceSelect.dataset.uk;
      const v = speechSynthesis.getVoices().find(x => x.name === name);
      if (v) u.voice = v;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      u.rate = 1.0;
      speechSynthesis.speak(u);
    });
  }

  /* ---------- Offscreen rendering for clean capture ---------- */
  const OUT_W = 720, OUT_H = 1280;
  const offCanvas = document.createElement("canvas");
  offCanvas.width = OUT_W;
  offCanvas.height = OUT_H;
  const octx = offCanvas.getContext("2d");

  // draw loop that paints video frame + caption into the offscreen canvas
  let drawId = 0;
  let getCurrentCaption = () => captionText.textContent;
  function startDrawLoop() {
    if (drawId) cancelAnimationFrame(drawId);
    function loop() {
      // draw video (cover top)
      octx.clearRect(0,0,OUT_W,OUT_H);
      const videoAreaH = Math.floor(OUT_H * 1.0); // full video visually, captions overlayed at bottom
      if (topVideo.videoWidth && topVideo.videoHeight) {
        const scale = Math.max(OUT_W / topVideo.videoWidth, videoAreaH / topVideo.videoHeight);
        const nw = topVideo.videoWidth * scale, nh = topVideo.videoHeight * scale;
        const dx = (OUT_W - nw) / 2, dy = 0;
        try { octx.drawImage(topVideo, dx, dy, nw, nh); } catch(e){}
      } else {
        octx.fillStyle = "#111";
        octx.fillRect(0,0,OUT_W,videoAreaH);
      }
      // caption overlay at bottom
      const captionBoxH = Math.floor(OUT_H * 0.18);
      const captionY = OUT_H - captionBoxH - 60;
      const grad = octx.createLinearGradient(0, captionY, 0, OUT_H);
      grad.addColorStop(0, "rgba(0,0,0,0.45)");
      grad.addColorStop(1, "rgba(0,0,0,0.8)");
      octx.fillStyle = grad;
      octx.fillRect(0, captionY, OUT_W, captionBoxH + 80);

      // text styling (big bold center, black outline via shadow)
      octx.fillStyle = "#fff";
      octx.font = "bold 56px Arial";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      // text outline via multiple shadows: use stroke for clarity
      const text = (typeof getCurrentCaption === "function") ? getCurrentCaption() : captionText.textContent;
      const maxWidth = OUT_W - 80;
      const lines = wrapText(octx, text, maxWidth);
      const lineH = 64;
      const startY = captionY + (captionBoxH + 80 - lines.length*lineH)/2 + 10;
      octx.fillStyle = "#000";
      octx.lineWidth = 10;
      octx.strokeStyle = "#000";
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
  function stopDrawLoop() { if (drawId) cancelAnimationFrame(drawId); drawId=0; }

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

  /* ---------- Video random switcher (independent) ---------- */
  let videoSwitcher = null;
  function startRandomVideoSwitching() {
    if (videoSwitcher) clearInterval(videoSwitcher);
    // switch interval randomized each time between 1.5s and 3s
    videoSwitcher = setInterval(() => {
      const v = VIDEOS[Math.floor(Math.random()*VIDEOS.length)];
      const url = fullUrl(v);
      topVideo.src = url;
      // attempt to start at a random time shortly after metadata available
      topVideo.addEventListener('loadedmetadata', function setRand() {
        try {
          const maxStart = Math.max(0.1, (topVideo.duration || 3) - 0.6);
          topVideo.currentTime = Math.random() * maxStart;
        } catch(e){}
        topVideo.removeEventListener('loadedmetadata', setRand);
      });
      topVideo.play().catch(()=>{ topVideo.muted = true; topVideo.play().catch(()=>{}); });
    }, 1500 + Math.floor(Math.random()*1700));
  }
  function stopRandomVideoSwitching() { if (videoSwitcher) clearInterval(videoSwitcher); videoSwitcher = null; }

  /* ---------- Sequence runner (facts -> chunks -> speak) ---------- */
  async function playFactSequence(factsArray, selectedVoiceKey) {
    for (let i=0;i<factsArray.length;i++) {
      const fact = factsArray[i];
      const chunks = chunkText(fact);
      for (let j=0;j<chunks.length;j++) {
        captionText.textContent = chunks[j];
        // speak chunk and also enforce minimum duration
        const p = speakChunkWithVoice(chunks[j], selectedVoiceKey);
        const t = new Promise(r => setTimeout(r, MIN_CHUNK_MS));
        await Promise.all([p,t]);
        await new Promise(r => setTimeout(r, 120));
      }
      await new Promise(r => setTimeout(r, 250));
    }
    captionText.textContent = "Complete";
  }

  /* ---------- RECORD + CONVERT TO MP4 ---------- */
  generateBtn.addEventListener("click", generateAndExport);

  async function generateAndExport() {
    downloadBtn.disabled = true;
    status.textContent = "Requesting tab capture (choose This tab + Share audio)...";
    let displayStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (e) {
      status.textContent = "Permission denied or unsupported.";
      console.error(e);
      return;
    }
    // keep audio tracks, stop video track from display (we only need audio)
    const audioTracks = displayStream.getAudioTracks();
    displayStream.getVideoTracks().forEach(t => t.stop());

    if (!audioTracks || audioTracks.length === 0) {
      status.textContent = "No tab audio detected. Ensure you selected 'This tab' and enabled 'Share audio'.";
    }

    status.textContent = "Preparing recording (this may take a moment)...";

    // start drawing to offscreen canvas
    startDrawLoop();

    // capture canvas stream
    const canvasStream = offCanvas.captureStream(30);
    const combined = new MediaStream();
    canvasStream.getVideoTracks().forEach(t => combined.addTrack(t));
    audioTracks.forEach(t => combined.addTrack(t));

    if (combined.getAudioTracks().length === 0) {
      // create silent audio to avoid MediaRecorder rejection
      const ac = new AudioContext();
      const dst = ac.createMediaStreamDestination();
      const osc = ac.createOscillator();
      osc.frequency.value = 0;
      osc.connect(dst);
      osc.start();
      combined.addTrack(dst.stream.getAudioTracks()[0]);
    }

    // record to webm
    let recorder;
    let chunks = [];
    try {
      recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp8,opus' });
    } catch (e) {
      recorder = new MediaRecorder(combined);
    }

    recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };

    const chosenFacts = pickUniqueFacts(FACTS_PER_SHORT);
    // start recording
    recorder.start(1000);
    status.textContent = "Recording... playing facts & generating narration";

    // start random video switching independently
    startRandomVideoSwitching();

    // choose voice
    const selectedKey = (voiceSelect.value === "google-uk-male") ? "uk" : "us";

    // play facts and TTS (this uses browser speech synthesis)
    await playFactSequence(chosenFacts, selectedKey);

    // small delay to ensure audio flush
    await new Promise(r => setTimeout(r, 700));

    // stop switcher and speech
    stopRandomVideoSwitching();
    speechSynthesis.cancel();

    // stop recorder
    recorder.stop();

    // wait for recorder to finalize
    await new Promise(resolve => {
      recorder.onstop = resolve;
      // safety: also resolve after 3s in case onstop doesn't fire
      setTimeout(resolve, 4000);
    });

    // build webm blob
    const webmBlob = new Blob(chunks, { type: 'video/webm' });
    const webmUrl = URL.createObjectURL(webmBlob);

    status.textContent = "Converting to MP4 in-browser (this uses ffmpeg.wasm and may take ~10-40s depending on device)...";

    // convert to mp4 with ffmpeg.wasm
    try {
      const { createFFmpeg, fetchFile } = FFmpeg;
      const ffmpeg = createFFmpeg({ log: true });
      await ffmpeg.load();

      // write input
      await ffmpeg.FS('writeFile', 'input.webm', await fetchFile(webmBlob));
      // run conversion (copy codecs)—use libx264
      await ffmpeg.run('-i', 'input.webm', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '128k', 'output.mp4');
      const data = ffmpeg.FS('readFile', 'output.mp4');
      const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
      const mp4Url = URL.createObjectURL(mp4Blob);

      // enable download
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
      // cleanup
      ffmpeg.FS('unlink', 'input.webm');
      ffmpeg.FS('unlink', 'output.mp4');
      // revoke webm URL
      URL.revokeObjectURL(webmUrl);
    } catch (err) {
      console.error("ffmpeg conversion failed", err);
      // fallback: offer webm download
      downloadBtn.disabled = false;
      const wUrl = URL.createObjectURL(webmBlob);
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

    // stop any capture tracks
    audioTracks.forEach(t => t.stop());
    stopDrawLoop();
  }

  /* ---------- END ---------- */
});
