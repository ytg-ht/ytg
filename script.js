/* script.js
   Requirements:
   - facts.js must provide `facts` (array of strings)
   - put your media files under /media/ and list them in `VIDEOS` below
*/

console.log("Shorts generator loaded");

if (!window.facts || !Array.isArray(facts) || facts.length === 0) {
  alert("facts.js missing or empty. Add your facts array before script.js");
  throw new Error("Missing facts");
}

/* ---------------- CONFIG ---------------- */
const VIDEOS = [
  "media/slime1.mp4",
  "media/slime2.mp4",
  "media/slime3.mp4",
  "media/slime4.mp4",
  "media/soap1.mp4"
];

// per-fact display duration in seconds
const FACT_DURATION = 3.5; // seconds (tweakable)
// choose 7 facts
const FACT_COUNT = 7;

/* --------- DOM --------- */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const voiceSelect = document.getElementById("voiceSelect");
const generateBtn = document.getElementById("generateBtn");
const previewBtn = document.getElementById("previewBtn");
const status = document.getElementById("status");
const downloads = document.getElementById("downloads");

/* offscreen video element used to draw to canvas */
const videoEl = document.createElement("video");
videoEl.muted = true;
videoEl.playsInline = true;
videoEl.crossOrigin = "anonymous";

/* state */
let voices = [];
let currentSequence = null;

/* populate voices */
function loadVoices() {
  voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = "";
  if (!voices || voices.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No voices available";
    voiceSelect.appendChild(opt);
    return;
  }
  // keep a couple of popular-looking voice names as fallback order
  voices.forEach(v => {
    const o = document.createElement("option");
    o.value = v.name;
    o.textContent = `${v.name} ${v.lang ? "(" + v.lang + ")" : ""}`;
    voiceSelect.appendChild(o);
  });
}
speechSynthesis.onvoiceschanged = loadVoices;
window.addEventListener("load", () => {
  loadVoices();
});

/* helper: pick N random facts (unique if possible) */
function pickFacts(n) {
  const pool = facts.slice();
  const picked = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/* helper: pick a random video file */
function pickVideo() {
  return VIDEOS[Math.floor(Math.random() * VIDEOS.length)];
}

/* draw a single frame: draws current video frame + caption bottom center (TikTok style) */
function drawFrame(caption) {
  // draw video to full canvas (cover)
  const vw = videoEl.videoWidth, vh = videoEl.videoHeight;
  const cw = canvas.width, ch = canvas.height;
  ctx.clearRect(0,0,cw,ch);

  if (vw && vh) {
    // cover logic
    const scale = Math.max(cw / vw, ch / vh);
    const nw = vw * scale, nh = vh * scale;
    const dx = (cw - nw) / 2, dy = (ch - nh) / 2;
    ctx.drawImage(videoEl, dx, dy, nw, nh);
  } else {
    // fallback background
    ctx.fillStyle = "#111";
    ctx.fillRect(0,0,cw,ch);
  }

  // caption background strip
  const padding = 20;
  const maxWidth = cw - padding*2;
  ctx.font = "bold 38px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // wrap text into lines
  const lines = wrapText(ctx, caption, maxWidth);
  const lineHeight = 46;
  const totalHeight = lines.length * lineHeight + padding;
  const boxHeight = totalHeight + 20;
  const boxY = ch - boxHeight - 40;

  // semi-opaque rounded rectangle
  roundRect(ctx, 30, boxY, cw - 60, boxHeight, 18, "rgba(0,0,0,0.55)");

  ctx.fillStyle = "#fff";
  const startY = boxY + padding + (lines.length===1 ? 10 : 0);
  lines.forEach((line, i) => {
    ctx.fillText(line, cw / 2, startY + i * lineHeight);
  });
}

/* wrap text helper */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    const test = current ? current + " " + w : w;
    const width = ctx.measureText(test).width;
    if (width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/* rounded rectangle */
function roundRect(ctx, x, y, w, h, r, fillStyle) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

/* play TTS for a fact and return a promise resolved when finished */
function speakFact(text) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const sel = voiceSelect.value;
    const v = speechSynthesis.getVoices().find(x => x.name === sel);
    if (v) u.voice = v;
    u.rate = 1.0;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

/* render preview sequence (no recording) */
async function runSequence(factsArray, doRecord = false, recorder = null) {
  // pick one random video for entire short for visual consistency, or randomize each fact — you can change
  const videoFile = pickVideo();
  videoEl.src = videoFile;
  await videoEl.play().catch(e => {
    // autoplay may be blocked; try to unmute and play
    console.warn("video play failed, trying again:", e);
    videoEl.muted = true;
    return videoEl.play();
  });

  const fps = 30;
  const frameInterval = 1000 / fps;
  let recordingStopped = false;

  // function to drive canvas frames while the video plays
  let frameTimer = null;
  function startDrawer(currentCaption) {
    if (frameTimer) clearInterval(frameTimer);
    frameTimer = setInterval(() => {
      drawFrame(currentCaption);
    }, frameInterval);
  }

  for (let i = 0; i < factsArray.length; i++) {
    const caption = `Fact ${i+1}: ${factsArray[i]}`;
    startDrawer(caption);

    // play TTS and keep drawing for FACT_DURATION seconds (or until TTS ends)
    // We'll run both but ensure the caption stays for at least FACT_DURATION seconds
    const ttsPromise = speakFact(factsArray[i]);

    // play video from random seek point to add variety
    // if video is shorter than FACT_DURATION, it will loop because videoEl.loop is false here; we may set currentTime
    try {
      const seek = Math.random() * Math.max(0.1, (videoEl.duration || FACT_DURATION) - 0.5);
      videoEl.currentTime = seek;
    } catch (e) {}

    // wait for either duration or TTS, whichever is longer (ensures voice finishes)
    const minWait = FACT_DURATION * 1000;
    const start = performance.now();
    await Promise.race([ttsPromise, new Promise(r => setTimeout(r, minWait))]);
    const elapsed = performance.now() - start;
    if (elapsed < minWait) {
      await new Promise(r => setTimeout(r, minWait - elapsed));
    }

    // small short pause between facts
    await new Promise(r => setTimeout(r, 200));
  }

  // stop drawing
  if (frameTimer) { clearInterval(frameTimer); frameTimer = null; }
  drawFrame("Complete — processing...");

  // ensure speech queue is empty
  speechSynthesis.cancel();

  if (doRecord && recorder) {
    // stop recording (recorder controlled by caller)
    recorder.stop();
    // recorder.onstop handler will handle blob
    // wait small moment to let onstop fire
    await new Promise(r => setTimeout(r, 500));
  }
}

/* ---------- RECORDING FLOW ----------
We will record the canvas (video) plus the tab audio (TTS speech).
Steps:
 1. Ask user to share the tab (getDisplayMedia) - must pick "This tab" and check "Share audio".
 2. Use canvas.captureStream() for video track.
 3. Take audio track(s) from displayStream and combine into a new MediaStream with the canvas video track.
 4. Create MediaRecorder on the combined stream (webm).
 5. Start recording, run the sequence, stop recorder, collect blob, and provide download link.
--------------------------------------*/
async function generateAndRecord() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    alert("Your browser doesn't support getDisplayMedia required for recording. Use Chrome/Edge on desktop.");
    return;
  }

  status.textContent = "Requesting permission to capture this tab's audio... (choose 'This tab' and enable 'Share audio')";
  let displayStream;
  try {
    // ask user to share the current tab with audio
    displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  } catch (err) {
    console.error("getDisplayMedia denied", err);
    status.textContent = "Permission denied or unsupported. Recording canceled.";
    return;
  }

  // stop the display's video track right away (we only need audio from the tab)
  // but we keep audio track(s)
  const audioTracks = displayStream.getAudioTracks();
  // optional: if displayStream includes a video track, stop it
  displayStream.getVideoTracks().forEach(t => t.stop());

  if (audioTracks.length === 0) {
    status.textContent = "No audio track found in captured tab. Make sure you selected 'Share audio'.";
    // continue preview but warn user
  }

  status.textContent = "Preparing canvas recording...";

  const canvasStream = canvas.captureStream(30); // 30fps
  const combined = new MediaStream();

  // add video tracks from canvas
  canvasStream.getVideoTracks().forEach(t => combined.addTrack(t));
  // add audio tracks from display (tab audio)
  audioTracks.forEach(t => combined.addTrack(t));

  // fallback: If no audio tracks, create silent audio track so MediaRecorder doesn't fail
  if (combined.getAudioTracks().length === 0) {
    // create a silent audio track
    const ctx = new AudioContext();
    const dst = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    osc.frequency.value = 0; // silent-ish
    osc.connect(dst);
    osc.start();
    combined.addTrack(dst.stream.getAudioTracks()[0]);
    // stop oscillator after a short time to avoid CPU; we'll leave it running until recording stops
    setTimeout(() => { osc.stop(); }, 1000);
  }

  // prepare recorder
  const options = { mimeType: "video/webm; codecs=vp8,opus" };
  let recordedChunks = [];
  let recorder;
  try {
    recorder = new MediaRecorder(combined, options);
  } catch (err) {
    // try without codecs
    recorder = new MediaRecorder(combined);
  }

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  recorder.onstop = async () => {
    // stop any leftover tracks
    combined.getTracks().forEach(t => t.stop());
    displayStream.getTracks().forEach(t => t.stop());

    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `short_${Date.now()}.webm`;
    a.textContent = "Download recorded short";
    downloads.innerHTML = "";
    downloads.appendChild(a);
    status.textContent = "Recording finished — ready to download.";
  };

  // gather 7 facts and start
  const chosen = pickFacts(FACT_COUNT);
  recordedChunks = [];

  status.textContent = "Recording... play will start momentarily. Speak/Tab audio will be captured.";
  recorder.start(1000); // collect data every second

  // run sequence and recorder will record canvas + tab audio
  await runSequence(chosen, true, recorder);
}

/* ---------- Preview (no recording) ---------- */
async function previewShort() {
  const chosen = pickFacts(FACT_COUNT);
  status.textContent = "Previewing short (no recording).";
  await runSequence(chosen, false, null);
  status.textContent = "Preview complete.";
}

/* ---------- Events ---------- */
generateBtn.addEventListener("click", async () => {
  downloads.innerHTML = "";
  await generateAndRecord();
});

previewBtn.addEventListener("click", async () => {
  await previewShort();
});

/* utility: initial blank frame */
drawFrame("Ready — pick a voice and click Generate & Record Short");
