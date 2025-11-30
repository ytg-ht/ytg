/* script.js
 - Uses facts (global array) from facts.js
 - Randomizes video list, plays clips back-to-back
 - Generates speech via ElevenLabs if apiKey+voiceId provided (session only)
 - Fallback to browser speechSynthesis if no key provided
 - Captions: display chunked (wordsPerChunk) text while audio plays
*/

// --- CONFIG: your hosted videos (you provided these URLs) ---
const videos = [
  "https://ytg-ht.github.io/ytg/media/soap1.mp4",
  "https://ytg-ht.github.io/ytg/media/slime1.mp4",
  "https://ytg-ht.github.io/ytg/media/slime2.mp4",
  "https://ytg-ht.github.io/ytg/media/slime3.mp4",
  "https://ytg-ht.github.io/ytg/media/slime4.mp4"
];

// DOM
const videoEl = document.getElementById('satisfy-video');
const captionOverlay = document.getElementById('captionOverlay');
const generateBtn = document.getElementById('generateBtn');
const nextVideoBtn = document.getElementById('nextVideoBtn');
const factsCountInput = document.getElementById('factsCount');
const factsCountVal = document.getElementById('factsCountVal');
const wordsPerChunkInput = document.getElementById('wordsPerChunk');
const chunkMsInput = document.getElementById('chunkMs');

const elevenKeyInput = document.getElementById('elevenKey');
const elevenVoiceIdInput = document.getElementById('elevenVoiceId');
const saveElevenBtn = document.getElementById('saveEleven');
const clearElevenBtn = document.getElementById('clearEleven');
const elevenStatus = document.getElementById('elevenStatus');

let sessionElevenKey = null;
let sessionElevenVoiceId = null;

// load saved session (if user earlier saved for session)
if(sessionStorage.getItem('eleven_key')) {
  sessionElevenKey = sessionStorage.getItem('eleven_key');
  sessionElevenVoiceId = sessionStorage.getItem('eleven_vid');
  elevenStatus.textContent = "ElevenLabs key loaded (session)";
  elevenKeyInput.value = "••••••••••";
  elevenVoiceIdInput.value = sessionElevenVoiceId || "";
}

// UI reactive
factsCountInput.addEventListener('input', ()=> factsCountVal.textContent = factsCountInput.value);

// Save / clear key (stored only in sessionStorage)
saveElevenBtn.addEventListener('click', ()=> {
  const k = elevenKeyInput.value.trim();
  const vid = elevenVoiceIdInput.value.trim();
  if(!k || !vid) {
    alert("Paste your ElevenLabs API key and the voice id (voice name).");
    return;
  }
  sessionStorage.setItem('eleven_key', k);
  sessionStorage.setItem('eleven_vid', vid);
  sessionElevenKey = k;
  sessionElevenVoiceId = vid;
  elevenStatus.textContent = "ElevenLabs key saved for this session.";
  // hide key text for safety
  elevenKeyInput.value = "••••••••••";
});
clearElevenBtn.addEventListener('click', ()=> {
  sessionStorage.removeItem('eleven_key');
  sessionStorage.removeItem('eleven_vid');
  sessionElevenKey = null;
  sessionElevenVoiceId = null;
  elevenKeyInput.value = "";
  elevenVoiceIdInput.value = "";
  elevenStatus.textContent = "Cleared.";
});

// --- FACTS utilities ---
// facts[] must be defined in facts.js
if(!window.facts || !Array.isArray(facts) || facts.length === 0){
  captionOverlay.textContent = "No facts loaded — add facts.js";
}

// create a non-repeating pool and draw from it
let remainingIndices = [];
function refillPool(){
  remainingIndices = [...Array(facts.length).keys()];
  shuffleArray(remainingIndices);
}
function popRandomFact(){
  if(remainingIndices.length === 0) refillPool();
  const idx = remainingIndices.pop();
  return facts[idx];
}
function shuffleArray(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// chunk text into groups of N words
function chunkText(text, n){
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for(let i=0;i<words.length;i+=n){
    chunks.push(words.slice(i, i+n).join(' '));
  }
  return chunks;
}

// --- ElevenLabs TTS function (returns audio Blob) ---
// NOTE: This uses the ElevenLabs API v1 endpoint. You must supply API key & a voice id that you created in ElevenLabs.
// The function returns an audio Blob (mp3) or throws if not available.
async function synthesizeElevenLabs(text){
  if(!sessionElevenKey || !sessionElevenVoiceId) throw new Error('No ElevenLabs key/voice set');

  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(sessionElevenVoiceId)}`;
  const body = {
    text: text,
    model: "eleven_multilingual_v1", // fallback model param — ElevenLabs may accept different names; harmless for most setups
    voice_settings: { stability: 0.6, similarity_boost: 0.7 }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'xi-api-key': sessionElevenKey,
      'Content-Type': 'application/json',
      'Accept': 'application/octet-stream'
    },
    body: JSON.stringify(body)
  });

  if(!res.ok){
    const txt = await res.text();
    throw new Error('ElevenLabs error: ' + res.status + ' — ' + txt);
  }

  const arrayBuffer = await res.arrayBuffer();
  return new Blob([arrayBuffer], { type: 'audio/mpeg' });
}

// fallback browser TTS (returns a Promise that resolves when finished speaking)
function speakBrowserTTS(text, rate=1.0){
  return new Promise((resolve)=>{
    if(!('speechSynthesis' in window)){
      console.warn("Browser TTS not supported");
      resolve();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = 1.0;
    // try to pick a neutral male voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /male|daniel|david|brian/i.test(v.name));
    if(preferred) u.voice = preferred;
    u.onend = ()=> resolve();
    u.onerror = ()=> resolve();
    window.speechSynthesis.speak(u);
  });
}

// plays an Audio element (returns Promise resolving when ended)
function playAudioBlob(blob){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.crossOrigin = 'anonymous';
    a.onended = ()=> { URL.revokeObjectURL(url); resolve(); };
    a.onerror = (e) => { URL.revokeObjectURL(url); console.warn('audio play failed', e); resolve(); };
    a.play().catch(e => { console.warn('audio play error',e); resolve(); });
  });
}

// display chunk text with animation timing
async function showChunksForFact(fact, wordsPerChunk, msPerChunk){
  const chunks = chunkText(fact, wordsPerChunk);
  captionOverlay.textContent = "";
  for(let i=0;i<chunks.length;i++){
    captionOverlay.textContent = chunks[i];
    await new Promise(r => setTimeout(r, msPerChunk));
  }
  // clear small pause
  await new Promise(r => setTimeout(r, 160));
}

// orchestrates speaking a single fact (prefer ElevenLabs if available)
async function playFactWithVoice(fact, wordsPerChunk, msPerChunk){
  // always show chunks synced to msPerChunk (medium pacing)
  // If ElevenLabs is available, synthesize audio and use actual duration to pace chunks.
  if(sessionElevenKey && sessionElevenVoiceId){
    try{
      const blob = await synthesizeElevenLabs(fact);
      // get actual duration by loading into audio
      const aud = document.createElement('audio');
      aud.src = URL.createObjectURL(blob);
      await new Promise((res) => aud.onloadedmetadata = res);
      const duration = aud.duration || ( (fact.split(/\s+/).length * 0.18) * 1000 / 1000 );
      // compute chunk timing so captions spread across audio duration
      const chunks = chunkText(fact, wordsPerChunk);
      const msPer = Math.max(350, Math.round((aud.duration*1000) / Math.max(1, chunks.length)));
      // play audio while showing chunks
      const playPromise = playAudioBlob(blob); // starts playing
      for(let c=0;c<chunks.length;c++){
        captionOverlay.textContent = chunks[c];
        await new Promise(r => setTimeout(r, msPer));
      }
      await playPromise; // wait audio to finish if still playing
      captionOverlay.textContent = "";
      return;
    }catch(err){
      console.warn('ElevenLabs synth failed, falling back to browser TTS', err);
      // fallback to browser TTS below
    }
  }

  // fallback: browser TTS and show chunks timed to a heuristic
  const totalWords = fact.split(/\s+/).length;
  const estTotalMs = Math.max(900, Math.round(totalWords * 350)); // heuristic
  const chunks = chunkText(fact, wordsPerChunk);
  const msPer = Math.max(400, Math.round(estTotalMs / Math.max(1, chunks.length)));

  // start speaking (non-blocking)
  speakBrowserTTS(fact, 1.0);
  for(let c=0;c<chunks.length;c++){
    captionOverlay.textContent = chunks[c];
    await new Promise(r => setTimeout(r, msPer));
  }
  captionOverlay.textContent = "";
}

// orchestrates an entire short: plays n facts, then swaps video
async function playFactsSequence(nFacts=7){
  // pick a video to play while facts run
  const pickVideo = videos[Math.floor(Math.random()*videos.length)];
  videoEl.src = pickVideo;
  // make sure video plays (muted by default in case autoplay rules)
  await videoEl.play().catch(()=>{ /* autoplay blocked */ });

  // non-repeating facts selection
  const wordsPerChunk = parseInt(wordsPerChunkInput.value,10) || 4;
  const msChunkOverride = parseInt(chunkMsInput.value,10) || 900;

  for(let i=0;i<nFacts;i++){
    const fact = popRandomFact();
    // ensure facts start with "Did you know" — auto-insert if not
    const line = fact.toLowerCase().startsWith('did you know') ? fact : ('Did you know ' + fact.replace(/^\s*/,''));
    await playFactWithVoice(line, wordsPerChunk, msChunkOverride);
  }

  // after finishing facts: wait a moment then automatically change to next video (smooth)
  await new Promise(r => setTimeout(r, 350));
  // choose next video and set it ready; the generate button or video end trigger will pick next as desired
  // we intentionally *do not* stop the current video here — user decides next action or we auto-swap if configured
}

// UI wiring
generateBtn.addEventListener('click', async () => {
  generateBtn.disabled = true;
  const n = parseInt(factsCountInput.value,10) || 7;
  await playFactsSequence(n);
  generateBtn.disabled = false;
});

// immediate next video button
nextVideoBtn.addEventListener('click', async () => {
  // stop any ongoing speech
  try{ window.speechSynthesis.cancel(); }catch(e){}
  // fast swap to a new video and clear caption
  captionOverlay.textContent = "";
  videoEl.src = videos[Math.floor(Math.random()*videos.length)];
  await videoEl.play().catch(()=>{});
});

// auto-advance when video ends: if you prefer continuous play of random clips uncomment below
videoEl.addEventListener('ended', () => {
  captionOverlay.textContent = "";
  videoEl.src = videos[Math.floor(Math.random()*videos.length)];
  videoEl.play().catch(()=>{});
});

// initialize pool
refillPool();

// startup: preload one random video so UI feels alive
videoEl.src = videos[Math.floor(Math.random()*videos.length)];
videoEl.load();

// helpful tips
console.log("Script loaded. Facts count:", (window.facts && facts.length) || 0);
