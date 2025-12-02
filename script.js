// script.js
// Assumes facts.js defines window.facts = [ "..." , ... ]

const videoList = [
  "media/slime1.mp4",
  "media/slime2.mp4",
  "media/slime3.mp4",
  "media/slime4.mp4",
  "media/soap1.mp4"
];

const bgMusicUrl = "https://ytg-ht.github.io/ytg/sound.mp3"; // your uploaded music
const captionWords = 6; // ~6 words per chunk
const interChunkGap = 700; // ms

// DOM
const satisfyVideo = document.getElementById("satisfyVideo");
const captionText = document.getElementById("captionText");
const generateBtn = document.getElementById("generateBtn");
const playBtn = document.getElementById("playBtn");
const downloadBtn = document.getElementById("downloadBtn");

// audio elements - music played via an <audio> so it can be captured by tab recording
const musicAudio = new Audio(bgMusicUrl);
musicAudio.loop = true;
musicAudio.volume = 0.45;
musicAudio.crossOrigin = "anonymous";

// TTS settings
let voices = [];
let ttsVoice = null;
const ttsRate = 1.3; // fast

// state
let currentFact = "";
let chunks = [];
let playing = false;
let stopRequested = false;

// load voices
function loadVoices() {
  voices = speechSynthesis.getVoices() || [];
  // prefer Google UK male then female
  ttsVoice = voices.find(v => /Google UK.*Male/i.test(v.name)) 
           || voices.find(v => /Google UK.*Female/i.test(v.name))
           || voices.find(v => /Google UK/i.test(v.name))
           || voices.find(v => v.lang && v.lang.startsWith('en-GB'))
           || voices[0] || null;
}
speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// util: split fact into chunks (~6 words) and cap to 2 lines (we allow up to 2 chunks shown at once visually)
function splitFact(text, size = captionWords) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i += size) {
    out.push(words.slice(i, i + size).join(' '));
  }
  return out;
}

// pick a random video + fact & prepare chunks
function generateShort() {
  // pick video
  const v = videoList[Math.floor(Math.random() * videoList.length)];
  satisfyVideo.src = v;
  satisfyVideo.load();

  // pick fact
  if (!window.facts || !window.facts.length) {
    currentFact = "Did you know honey never spoils?";
  } else {
    currentFact = window.facts[Math.floor(Math.random() * window.facts.length)];
  }

  chunks = splitFact(currentFact, captionWords);
  captionText.textContent = chunks[0] || "";
  autoFitCaption();
}

// set caption text and auto-scale font-size to avoid overflow or >2 lines
function autoFitCaption() {
  const el = captionText;
  // reset font size
  let size = 36;
  el.style.fontSize = size + "px";
  el.style.lineHeight = 1.05;
  // force to at most 2 lines: we'll check scrollHeight vs clientHeight
  const maxHeight = el.parentElement.clientHeight - 24; // padding safety
  // shrink until fits
  let attempts = 0;
  while ((el.scrollHeight > maxHeight || el.offsetHeight > maxHeight) && attempts < 12) {
    size = Math.max(14, size - 2);
    el.style.fontSize = size + "px";
    attempts++;
  }
}

// play voice for chunks with 0.7s gap between utterances
async function playVoiceSequence() {
  if (!chunks || chunks.length === 0) return;
  if (!ttsVoice) {
    // voices may not be loaded yet; try again
    loadVoices();
    if (!ttsVoice) {
      alert("Voices still loading — try again in a second and refresh if needed.");
      return;
    }
  }

  stopRequested = false;
  playing = true;
  // ensure video is playing (muted video is already loaded). We'll unmute for recording-preview? keep video muted, voice+music are audio.
  satisfyVideo.play().catch(()=>{});

  // Start music
  try { await musicAudio.play(); } catch(e){ /* autoplay may block until user interact */ }

  for (let i = 0; i < chunks.length; i++) {
    if (stopRequested) break;
    const text = chunks[i];
    // show caption instantly
    captionText.textContent = text;
    autoFitCaption();

    // speak it
    await speakChunk(text);

    // wait inter-chunk gap (0.7s)
    await new Promise(r => setTimeout(r, interChunkGap));
  }

  playing = false;
  // stop music (keep music paused so user can hear later if they click play)
  // musicAudio.pause();
}

// speak a single chunk and resolve when utterance ends
function speakChunk(text) {
  return new Promise((resolve, reject) => {
    const utt = new SpeechSynthesisUtterance(text);
    if (ttsVoice) utt.voice = ttsVoice;
    utt.rate = ttsRate;
    utt.pitch = 1.0;
    utt.volume = 1.0;

    utt.onend = () => resolve();
    utt.onerror = (e) => {
      console.error("TTS error", e);
      resolve(); // continue despite errors
    };

    speechSynthesis.cancel();
    speechSynthesis.speak(utt);
  });
}

// Start/Stop controls
generateBtn.addEventListener('click', () => {
  generateShort();
});
playBtn.addEventListener('click', async () => {
  if (playing) {
    // stop
    stopRequested = true;
    speechSynthesis.cancel();
    musicAudio.pause();
    playing = false;
    playBtn.textContent = "Play (voice+music)";
  } else {
    playBtn.textContent = "Stop";
    await playVoiceSequence();
    playBtn.textContent = "Play (voice+music)";
  }
});

// DOWNLOAD (records tab: video + TTS audio + music)
// Approach: use getDisplayMedia to capture this tab (user must choose this tab), record with MediaRecorder
downloadBtn.addEventListener('click', async () => {
  // Informative confirm
  const ok = confirm("Download will record this tab (video + voice + music). When prompted, choose THIS TAB to capture audio. Recording will stop automatically when playback finishes OR you press OK to stop manually.");
  if (!ok) return;

  // Ensure there's a short generated
  if (!satisfyVideo.src) {
    alert("Generate a short first (click Generate) so there's something to record.");
    return;
  }

  // Play video and start TTS/music playback (so capture contains audio)
  // We'll play the voice sequence but we also start recording the tab.
  // Request tab capture (user must select this tab & allow audio)
  try {
    // start the voice/music playback slightly after the recording starts to ensure we capture everything
    const mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    // Create MediaRecorder and capture
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' :
                 MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
    const recorder = new MediaRecorder(mediaStream, { mimeType: mime, videoBitsPerSecond: 3000000 });
    const chunksArr = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunksArr.push(e.data); };

    recorder.onstop = async () => {
      // stop tracks
      mediaStream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksArr, { type: chunksArr[0]?.type || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'short.webm';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    };

    // Start recording
    recorder.start(1000); // collect in 1s intervals

    // Now run the preview playback (voice + music). This will be captured by the recording.
    // Start video + voice sequence
    // Make sure video plays (unmuted if you want the video's audio too — we normally keep video muted as our voice+music are main)
    satisfyVideo.muted = false; // include video audio if any
    await satisfyVideo.play().catch(()=>{});

    // Start voice+music sequence
    stopRequested = false;
    await musicAudio.play().catch(()=>{});
    await playVoiceSequence();

    // Wait small buffer then stop recording
    setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, 800); // small buffer after playback finished
  } catch (err) {
    console.error("Recording failed:", err);
    alert("Recording failed or was canceled. Make sure to choose THIS TAB when prompted and allow audio capture.");
  } finally {
    // reset video mute state
    satisfyVideo.muted = true;
  }
});

// init
generateShort();
