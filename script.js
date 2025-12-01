/* script.js
   - Requires facts.js (global `facts` array)
   - Uses browser SpeechSynthesis (speaks full fact naturally)
   - Shows captions in 5-word chunks while speech plays
   - Play = preview (no recording). Download = record + convert to mp4 via ffmpeg.wasm
   - When downloading you must choose "This tab" and enable "Share audio"
*/

console.log("YT Short Generator — exportable version loaded");

const BASE = location.origin + location.pathname.replace(/\/[^/]*$/, '/') ; // base path for relative media
const VIDEOS = ["media/slime1.mp4","media/slime2.mp4","media/slime3.mp4","media/slime4.mp4","media/soap1.mp4"];

const voiceSelect = document.getElementById('voiceSelect');
const generateBtn = document.getElementById('generateBtn');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const status = document.getElementById('status');

const bgVideo = document.getElementById('bgVideo');
const captionText = document.getElementById('captionText');

if (!window.facts || !Array.isArray(facts) || facts.length < 7) {
  status.textContent = "facts.js missing or too small — add facts";
  generateBtn.disabled = true;
}

let preparedFacts = []; // 7 facts for current short
let playing = false;
let stopRequested = false;
const FACTS_PER_SHORT = 7;
const CHUNK_WORDS = 5;
const WORD_MS = 375; // estimate ms per word for caption timing (used only as estimate)

/* ---------------- voices ---------------- */
function populateVoices() {
  const voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  voices.forEach(v => {
    // show English voices primarily, but keep others if you want
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} ${v.lang ? '('+v.lang+')':''}`;
    voiceSelect.appendChild(opt);
  });
  // choose default if available
  if (voiceSelect.options.length) voiceSelect.selectedIndex = 0;
}
speechSynthesis.onvoiceschanged = populateVoices;
populateVoices();

/* ---------- helpers ---------- */
function pickUniqueFacts(n) {
  const KEY = 'ytg_used_v2';
  let used = [];
  try { used = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e){ used = []; }
  const pool = [];
  for (let i=0;i<facts.length;i++) if (!used.includes(i)) pool.push(i);
  if (pool.length < n) { used = []; localStorage.setItem(KEY, JSON.stringify(used)); pool.length=0; for (let i=0;i<facts.length;i++) pool.push(i); }
  const chosenIdx = [];
  for (let i=0;i<n;i++) {
    const idx = Math.floor(Math.random()*pool.length);
    const pick = pool.splice(idx,1)[0];
    chosenIdx.push(pick);
    used.push(pick);
  }
  try { localStorage.setItem(KEY, JSON.stringify(used)); } catch(e){}
  return chosenIdx.map(i => facts[i]);
}

function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i=0;i<words.length;i+=CHUNK_WORDS) chunks.push(words.slice(i,i+CHUNK_WORDS).join(' '));
  return chunks;
}

function setCaption(text) {
  captionText.classList.remove('fade-in'); // reset animation
  void captionText.offsetWidth;
  captionText.textContent = text;
  captionText.classList.add('fade-in');
}

/* ---------- video switching (random start and interval) ---------- */
let switchTimer = null;
function startRandomVideoSwitching() {
  stopRandomVideoSwitching();
  function switchNow() {
    const v = VIDEOS[Math.floor(Math.random()*VIDEOS.length)];
    bgVideo.src = BASE + v.replace(/^\//,'');
    bgVideo.addEventListener('loadedmetadata', function onMeta() {
      try { bgVideo.currentTime = Math.random() * Math.max(0.1, (bgVideo.duration||4) - 1.0); } catch(e){}
      bgVideo.removeEventListener('loadedmetadata', onMeta);
    });
    bgVideo.play().catch(()=>{});
    const interval = 1500 + Math.floor(Math.random()*1700);
    switchTimer = setTimeout(switchNow, interval);
  }
  switchNow();
}
function stopRandomVideoSwitching() {
  if (switchTimer) { clearTimeout(switchTimer); switchTimer = null; }
}

/* ---------- TTS: speak full fact naturally ---------- */
function speakFullFact(text, voiceName) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voiceName) {
      const v = speechSynthesis.getVoices().find(x => x.name === voiceName);
      if (v) u.voice = v;
    }
    u.rate = 1.0;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

/* ---------- Playback: show 5-word chunks while speech plays ---------- */
async function playPrepared(voiceName) {
  if (!preparedFacts.length) return;
  playing = true;
  stopRequested = false;
  playBtn.disabled = true;
  stopBtn.disabled = false;
  generateBtn.disabled = true;
  downloadBtn.disabled = true;
  status.textContent = "Playing preview...";

  // start switching videos
  startRandomVideoSwitching();

  for (let i=0;i<preparedFacts.length;i++) {
    if (stopRequested) break;
    const fact = preparedFacts[i];
    const chunks = chunkText(fact);
    // estimate speech length using words * WORD_MS (approx)
    const totalWords = fact.split(/\s+/).filter(Boolean).length;
    const estMs = Math.max(800, Math.round(totalWords * WORD_MS));
    // start speaking entire fact (no mid-sentence pauses)
    const tts = speakFullFact(fact, voiceName);
    // display chunks proportionally
    const chunkWordCounts = chunks.map(c => c.split(/\s+/).length);
    const totalChunkWords = chunkWordCounts.reduce((a,b)=>a+b, totalWords);
    const chunkDurations = chunkWordCounts.map(cnt => Math.max(250, Math.round(estMs * (cnt/totalChunkWords))));
    for (let j=0;j<chunks.length;j++) {
      if (stopRequested) break;
      setCaption(chunks[j]);
      await new Promise(r => setTimeout(r, chunkDurations[j]));
    }
    // ensure TTS finished before continuing (safety)
    await tts;
    // short pause between facts
    await new Promise(r => setTimeout(r, 360));
  }

  // done
  stopRequested = true;
  stopRandomVideoSwitching();
  bgVideo.pause();
  setCaption("✔ Done!");
  playing = false;
  playBtn.disabled = false;
  stopBtn.disabled = true;
  generateBtn.disabled = false;
  downloadBtn.disabled = false;
  status.textContent = "Preview finished — Download available";
}

/* ---------- Generate handler ---------- */
generateBtn.addEventListener('click', () => {
  preparedFacts = pickUniqueFacts(FACTS_PER_SHORT);
  setCaption("Short prepared — press Play");
  status.textContent = "Short prepared";
  playBtn.disabled = false;
  downloadBtn.disabled = true;
});

/* ---------- Play / Stop ---------- */
playBtn.addEventListener('click', async () => {
  if (playing) return;
  const selVoice = voiceSelect.value || null;
  await playPrepared(selVoice);
});
stopBtn.addEventListener('click', () => {
  stopRequested = true;
  speechSynthesis.cancel();
  stopRandomVideoSwitching();
  bgVideo.pause();
  setCaption("Stopped");
  playBtn.disabled = false;
  stopBtn.disabled = true;
  generateBtn.disabled = false;
  status.textContent = "Stopped";
});

/* ---------- Download (record + ffmpeg convert) ---------- */
downloadBtn.addEventListener('click', async () => {
  if (!preparedFacts.length) return;
  // Ask user to share tab + audio
  status.textContent = "Requesting screen capture — choose THIS TAB and enable 'Share audio'";
  let dispStream;
  try {
    dispStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  } catch (e) {
    status.textContent = "Capture permission denied";
    console.error(e);
    return;
  }

  // stop any previous media tracks
  dispStream.getVideoTracks().forEach(t => t.stop());

  const audioTracks = dispStream.getAudioTracks();
  if (!audioTracks || audioTracks.length===0) {
    status.textContent = "No tab audio detected — ensure you selected 'This tab' and enabled audio";
  }

  status.textContent = "Recording short (this tab audio)... preparing";

  // Render captions + video to offscreen canvas
  const OUT_W = 720, OUT_H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W; canvas.height = OUT_H;
  const ctx = canvas.getContext('2d');

  // draw loop
  let drawId = null;
  function drawFrame() {
    // background (video)
    ctx.fillStyle = "#000"; ctx.fillRect(0,0,OUT_W,OUT_H);
    // draw video frame scaled cover
    if (bgVideo.readyState >= 2 && bgVideo.videoWidth) {
      const scale = Math.max(OUT_W/bgVideo.videoWidth, OUT_H/bgVideo.videoHeight);
      const nw = bgVideo.videoWidth * scale, nh = bgVideo.videoHeight * scale;
      const dx = (OUT_W - nw)/2, dy = (OUT_H - nh)/2;
      try { ctx.drawImage(bgVideo, dx, dy, nw, nh); } catch(e){}
    }
    // caption box (bottom)
    const captionBoxH = 220;
    const captionY = OUT_H - captionBoxH - 60;
    const grad = ctx.createLinearGradient(0,captionY,0,OUT_H);
    grad.addColorStop(0,"rgba(0,0,0,0.45)"); grad.addColorStop(1,"rgba(0,0,0,0.9)");
    ctx.fillStyle = grad; ctx.fillRect(0, captionY, OUT_W, captionBoxH + 80);

    // caption text
    ctx.font = "bold 56px system-ui, -apple-system, 'Segoe UI', Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const txt = captionText.textContent || "";
    // wrap into two lines if needed
    const maxW = OUT_W - 120;
    const words = txt.split(' ');
    // simple wrap
    let lines = [];
    let cur = "";
    for (let w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    const startY = captionY + (captionBoxH + 80)/2 - ((lines.length-1)*36);
    ctx.lineWidth = 12; ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    for (let i=0;i<lines.length;i++) {
      const y = startY + i*72;
      ctx.strokeText(lines[i], OUT_W/2, y);
      ctx.fillText(lines[i], OUT_W/2, y);
    }

    drawId = requestAnimationFrame(drawFrame);
  }

  // start drawing & prepare combined stream
  drawFrame();
  const canvasStream = canvas.captureStream(30);
  const combined = new MediaStream();
  canvasStream.getVideoTracks().forEach(t => combined.addTrack(t));
  audioTracks.forEach(t => combined.addTrack(t));
  // if no audio track present, create silent track
  if (combined.getAudioTracks().length === 0) {
    const ac = new AudioContext();
    const dst = ac.createMediaStreamDestination();
    const osc = ac.createOscillator();
    osc.frequency.value = 0; osc.connect(dst); osc.start();
    combined.addTrack(dst.stream.getAudioTracks()[0]);
  }

  // record to webm
  let chunks = [];
  let recorder;
  try { recorder = new MediaRecorder(combined, { mimeType: 'video/webm;codecs=vp8,opus' }); }
  catch(e) { recorder = new MediaRecorder(combined); }
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };

  // Start playback + speaking same as preview but recorded
  // Start recorder then start playback sequence (same logic as playPrepared)
  recorder.start(1000);
  status.textContent = "Recording... Playing facts and capturing audio";

  // start video switching & play
  startRandomVideoSwitching();

  // speak facts & display chunks — but here we must ensure TTS audio is captured by shared tab audio
  const selVoice = voiceSelect.value || null;
  for (let i=0;i<preparedFacts.length;i++) {
    if (!recorder || recorder.state === "inactive") break;
    const fact = preparedFacts[i];
    const chunks = chunkText(fact);
    const totalWords = fact.split(/\s+/).filter(Boolean).length;
    const estMs = Math.max(900, Math.round(totalWords * WORD_MS));
    const chunkWordCounts = chunks.map(c => c.split(/\s+/).length);
    const totalChunkWords = chunkWordCounts.reduce((a,b)=>a+b, totalWords);
    const chunkDurations = chunkWordCounts.map(cnt => Math.max(250, Math.round(estMs * (cnt/totalChunkWords))));
    // start TTS
    const ttsP = speakFullFact(fact, selVoice);
    // animate captions
    for (let j=0;j<chunks.length;j++) {
      captionText.classList.remove('fade-in'); void captionText.offsetWidth;
      captionText.textContent = chunks[j];
      captionText.classList.add('fade-in');
      await new Promise(r => setTimeout(r, chunkDurations[j]));
    }
    await ttsP;
    await new Promise(r => setTimeout(r, 360));
  }

  // finalize recording
  await new Promise(r => setTimeout(r, 700));
  stopRandomVideoSwitching();
  speechSynthesis.cancel();

  recorder.stop();

  // wait for stop
  await new Promise(resolve => {
    recorder.onstop = resolve;
    setTimeout(resolve, 4000);
  });

  // build webm blob
  const webm = new Blob(chunks, { type: 'video/webm' });
  status.textContent = "Converting to MP4 (in-browser)... This may take some time";

  try {
    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();

    await ffmpeg.FS('writeFile', 'input.webm', await fetchFile(webm));
    await ffmpeg.run('-i','input.webm','-c:v','libx264','-preset','veryfast','-crf','28','-c:a','aac','-b:a','128k','output.mp4');
    const data = ffmpeg.FS('readFile','output.mp4');
    const mp4blob = new Blob([data.buffer], {type:'video/mp4'});
    const url = URL.createObjectURL(mp4blob);

    downloadBtn.disabled = false;
    downloadBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `short_${Date.now()}.mp4`;
      document.body.appendChild(a); a.click(); a.remove();
    };

    status.textContent = "Conversion done — click Download";
  } catch (err) {
    console.error("ffmpeg failed", err);
    status.textContent = "Conversion failed — fallback: download WebM";
    const url = URL.createObjectURL(webm);
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => {
      const a = document.createElement('a');
      a.href = url; a.download = `short_${Date.now()}.webm`; document.body.appendChild(a); a.click(); a.remove();
    };
  } finally {
    // cleanup
    if (drawId) cancelAnimationFrame(drawId);
    // stop audio tracks from dispStream
    audioTracks.forEach(t => t.stop());
    status.textContent = "Ready";
  }
});

/* ---------- init: prepare voices and UI ---------- */
(function init() {
  // preload video size
  bgVideo.width = 360; bgVideo.height = 640;
  // default UI state
  playBtn.disabled = true;
  stopBtn.disabled = true;
  downloadBtn.disabled = true;
  status.textContent = "Ready — Generate a Short";

  // allow stop button to be enabled when playing
  playBtn.addEventListener('click', () => { stopBtn.disabled = false; });
})();
