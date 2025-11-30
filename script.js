// script.js — BrainRotter facts mode
// NOTE: For highest-quality exported voice, use ElevenLabs. Paste API key + voice id and click "Fetch TTS".
// Browser TTS will be used as fallback for preview only.

const canvas = document.getElementById('renderCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const sourceVideo = document.getElementById('sourceVideo');
const captionOverlay = document.getElementById('captionOverlay');
const revealImg = document.getElementById('revealImg');

// UI elements
const factsCount = document.getElementById('factsCount');
const factsSource = document.getElementById('factsSource');
const factsEditor = document.getElementById('factsEditor');
const newFactsBtn = document.getElementById('newFactsBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const previewCaptionsBtn = document.getElementById('previewCaptionsBtn');

const fontSelect = document.getElementById('fontSelect');
const fontSizeInput = document.getElementById('fontSize');

const voiceProvider = document.getElementById('voiceProvider');
const elevenBox = document.getElementById('elevenBox');
const elevenApiKey = document.getElementById('elevenApiKey');
const elevenVoiceId = document.getElementById('elevenVoiceId');
const fetchTTSBtn = document.getElementById('fetchTTSBtn');
const previewVoiceBtn = document.getElementById('previewVoiceBtn');
const playbackRate = document.getElementById('playbackRate');
const embedTTS = document.getElementById('embedTTS');
const exportBtn = document.getElementById('exportBtn');

let audioCtx = null;
let fetchedAudioBuffers = []; // array of AudioBuffer for current facts (if fetched)
let currentFacts = [];
let playingSeq = false;

// helper
const choose = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp = (a,b,c) => Math.max(b, Math.min(c, a));

// procedural slime demo (renders moving blobs to a hidden canvas, captured to a looping blob)
function makeProceduralSlime(){
  const off = document.createElement('canvas');
  off.width = 720; off.height = 1280;
  const g = off.getContext('2d');
  let t = 0;
  function frame(){
    // background
    g.fillStyle = '#041018';
    g.fillRect(0,0,off.width,off.height);
    // blobs
    for(let i=0;i<14;i++){
      const x = (i*140 + t*6) % (off.width + 240) - 120;
      const r = 40 + Math.sin((t+i)/6)*18;
      g.beginPath();
      g.fillStyle = `hsla(${(i*24 + t*3) % 360},80%,60%,0.9)`;
      g.arc(x, off.height/2 + Math.sin(i + t/9) * 46, Math.abs(r), 0, Math.PI*2);
      g.fill();
    }
    t++;
    requestAnimationFrame(frame);
  }
  frame();

  // convert to short looping video blob
  const stream = off.captureStream(30);
  const mr = new MediaRecorder(stream);
  let chunks = [];
  mr.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    const blob = new Blob(chunks, { type:'video/webm' });
    const url = URL.createObjectURL(blob);
    sourceVideo.src = url; sourceVideo.loop = true; sourceVideo.muted = true; sourceVideo.play().catch(()=>{});
  };
  mr.start();
  setTimeout(()=> mr.stop(), 1200);
}
makeProceduralSlime();

// drawing loop: simply fills canvas with video frame scaled to top area + neutral bottom
let dividerPct = 0.62;
function drawLoop(){
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const topH = Math.floor(canvas.height * dividerPct);

  // draw video scaled to topH
  if(sourceVideo && sourceVideo.readyState >= 2){
    const vw = sourceVideo.videoWidth || sourceVideo.width;
    const vh = sourceVideo.videoHeight || sourceVideo.height;
    const scale = Math.max(canvas.width / vw, topH / vh);
    const sw = vw * scale, sh = vh * scale;
    const sx = (canvas.width - sw)/2, sy = (topH - sh)/2;
    ctx.drawImage(sourceVideo, sx, sy, sw, sh);
  } else {
    ctx.fillStyle = '#eefaff';
    ctx.fillRect(0,0,canvas.width,topH);
  }

  // bottom area (clean white)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, topH, canvas.width, canvas.height - topH);

  requestAnimationFrame(drawLoop);
}
requestAnimationFrame(drawLoop);

// ------------ Facts generation & UI wiring ------------
function populateFactsEditorFromPool(){
  const count = Math.max(1, Math.min(12, parseInt(factsCount.value,10) || 7));
  const pool = factsSource.value || 'random';
  const picked = window.pickFacts(pool, count);
  currentFacts = picked.slice();
  factsEditor.value = picked.join("\n");
  fetchedAudioBuffers = []; // clear any previously fetched audio
}
newFactsBtn.addEventListener('click', populateFactsEditorFromPool);

randomizeBtn.addEventListener('click', ()=>{
  // shuffle facts order or pick anew
  if(currentFacts.length > 0){
    currentFacts = currentFacts.sort(()=>Math.random()-0.5);
    factsEditor.value = currentFacts.join("\n");
    fetchedAudioBuffers = [];
  } else {
    populateFactsEditorFromPool();
  }
});

// when source selection changes, auto fill
factsSource.addEventListener('change', populateFactsEditorFromPool);
window.addEventListener('load', populateFactsEditorFromPool);

// font & size applied to caption overlay
function applyCaptionStyle(){
  captionOverlay.style.fontFamily = fontSelect.value;
  captionOverlay.style.fontSize = (parseInt(fontSizeInput.value,10) || 56) + 'px';
}
fontSelect.addEventListener('change', applyCaptionStyle);
fontSizeInput.addEventListener('input', applyCaptionStyle);
applyCaptionStyle();

// ------------ Caption display & sequencing ------------
// show single fact in overlay (clears previous)
function showFactText(text){
  captionOverlay.innerHTML = '';
  const container = document.createElement('div');
  // split into words for subtle animation
  const words = text.split(/\s+/);
  words.forEach((w, i) => {
    const sp = document.createElement('span');
    sp.className = 'word';
    sp.textContent = w + (i === words.length-1 ? '' : ' ');
    container.appendChild(sp);
    // stagger in
    setTimeout(()=> sp.classList.add('show'), 60 * i);
  });
  captionOverlay.appendChild(container);
}

// play sequence of AudioBuffers or fallback to browser TTS
async function playSequenceWithCaptions(facts, audioBuffers, rate=1){
  if(playingSeq) return;
  playingSeq = true;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  for(let i=0;i<facts.length;i++){
    const fact = facts[i];
    showFactText(fact);
    if(audioBuffers && audioBuffers[i]){
      // play audio buffer
      const src = ac.createBufferSource();
      src.buffer = audioBuffers[i];
      src.playbackRate.value = rate;
      const dest = ac.destination;
      src.connect(dest);
      src.start();
      // wait for end
      await new Promise(res => {
        src.onended = res;
      });
    } else {
      // fallback: browser TTS (not embeddable reliably)
      await speakBrowserTTS(fact, rate);
    }
    // small pause between facts
    await new Promise(r => setTimeout(r, 220));
  }
  captionOverlay.innerHTML = '';
  playingSeq = false;
}

// simple browser TTS promise wrapper
function speakBrowserTTS(text, rate=1){
  return new Promise(res => {
    try{
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = rate;
      utt.onend = () => res();
      window.speechSynthesis.speak(utt);
    }catch(e){
      // if TTS fails, fallback to timed delay estimating ~words*220ms
      const est = Math.max(900, text.split(/\s+/).length * 220);
      setTimeout(res, est);
    }
  });
}

// preview captions button
previewCaptionsBtn.addEventListener('click', async ()=>{
  // use fetchedAudioBuffers if present and length matches; else use browser TTS
  const facts = factsEditor.value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(facts.length === 0){ alert('No facts to preview'); return; }
  const buffers = (fetchedAudioBuffers.length === facts.length) ? fetchedAudioBuffers : null;
  await playSequenceWithCaptions(facts, buffers, parseFloat(playbackRate.value || 1));
});

// ------------ ElevenLabs TTS fetch per fact ------------

function ensureAudioCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// fetch audio buffer for a single fact using ElevenLabs.
// ElevenLabs endpoint (example) expects POST to /v1/text-to-speech/{voice_id} with {text}.
// The response should be audio/mpeg. This code decodes it into AudioBuffer.
async function fetchElevenFactTTS(factText, apiKey, voiceId){
  if(!apiKey || !voiceId) throw new Error('Missing ElevenLabs API key or voice id');
  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({ text: factText })
  });
  if(!resp.ok){
    const txt = await resp.text();
    throw new Error(`ElevenLabs error ${resp.status}: ${txt}`);
  }
  const ab = await resp.arrayBuffer();
  const ac = ensureAudioCtx();
  const buf = await ac.decodeAudioData(ab);
  return buf;
}

// fetch TTS for all facts in editor, store in fetchedAudioBuffers
fetchTTSBtn.addEventListener('click', async ()=>{
  const key = elevenApiKey.value.trim();
  const vid = elevenVoiceId.value.trim();
  if(!key || !vid){ alert('Paste ElevenLabs API key and voice id'); return; }
  const facts = factsEditor.value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(facts.length === 0){ alert('No facts to fetch'); return; }
  fetchedAudioBuffers = [];
  fetchTTSBtn.disabled = true; fetchTTSBtn.textContent = 'Fetching...';
  try{
    for(let i=0;i<facts.length;i++){
      const f = facts[i];
      const buf = await fetchElevenFactTTS(f, key, vid);
      fetchedAudioBuffers.push(buf);
      // small delay to avoid spamming API too quickly
      await new Promise(r => setTimeout(r, 180));
    }
    alert('Fetched TTS audio for all facts. You can preview or export with embedded audio.');
  }catch(err){
    console.error(err);
    alert('TTS fetch error: ' + err.message);
    fetchedAudioBuffers = [];
  } finally {
    fetchTTSBtn.disabled = false; fetchTTSBtn.textContent = 'Fetch TTS for current facts';
  }
});

// preview voice sync button: if fetched audio exists, use it; else use browser TTS
document.getElementById('previewVoiceBtn').addEventListener('click', async ()=>{
  const facts = factsEditor.value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(facts.length === 0){ alert('No facts to preview'); return; }
  const buffers = (fetchedAudioBuffers.length === facts.length) ? fetchedAudioBuffers : null;
  await playSequenceWithCaptions(facts, buffers, parseFloat(playbackRate.value || 1));
});

// ------------ Export: record canvas + (embedded) TTS audio stream ------------
async function buildMergedStreamForExport(durationMs = 1000 * Math.max(5, currentFacts.length * 2.2)){
  // canvas stream
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);

  // prefer embedded fetched audio buffers if user checked embedTTS and we have them
  if(embedTTS.checked && fetchedAudioBuffers.length > 0){
    const ac = ensureAudioCtx();
    const dest = ac.createMediaStreamDestination();
    // schedule each buffer to play immediately one after another
    let start = ac.currentTime + 0.2;
    for(let i=0;i<fetchedAudioBuffers.length;i++){
      const src = ac.createBufferSource();
      src.buffer = fetchedAudioBuffers[i];
      src.connect(dest);
      src.start(start);
      start += (fetchedAudioBuffers[i].duration + 0.15);
    }
    // copy video + audio tracks into merged stream
    const merged = new MediaStream();
    canvasStream.getVideoTracks().forEach(t => merged.addTrack(t));
    dest.stream.getAudioTracks().forEach(t => merged.addTrack(t));
    return { stream: merged, approxDuration: start * 1000 - ac.currentTime * 1000 + 300 };
  }

  // else fallback: no embedded audio; export video-only
  return { stream: canvasStream, approxDuration: durationMs };
}

exportBtn.addEventListener('click', async ()=>{
  exportBtn.disabled = true; exportBtn.textContent = 'Preparing...';
  // capture current facts from editor
  const facts = factsEditor.value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(facts.length === 0){ alert('No facts to export'); exportBtn.disabled = false; exportBtn.textContent = 'Export .webm'; return; }
  // set currentFacts for overlay timing
  currentFacts = facts.slice();

  // before exporting, start showing captions synced while we record
  // Build merged stream
  const { stream, approxDuration } = await buildMergedStreamForExport(Math.max(5000, facts.length * 2000));
  let mime = 'video/webm; codecs=vp9';
  if(!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm; codecs=vp8';
  if(!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';

  const recorderChunks = [];
  let mr;
  try{
    mr = new MediaRecorder(stream, { mimeType: mime });
  }catch(e){
    alert('Export not supported: ' + e.message);
    exportBtn.disabled = false; exportBtn.textContent = 'Export .webm';
    return;
  }

  mr.ondataavailable = ev => { if(ev.data && ev.data.size) recorderChunks.push(ev.data); };
  mr.onstop = async ()=>{
    const blob = new Blob(recorderChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `brainrot_facts_${Date.now()}.webm`; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    exportBtn.disabled = false; exportBtn.textContent = 'Export .webm';
  };

  // Start recording and also play captions + audio (if available)
  mr.start();
  exportBtn.textContent = 'Recording...';

  // Start sequence: if fetchedAudioBuffers present and embedded, they already scheduled inside buildMergedStreamForExport
  // But we still must display captions in sync for the duration we expect
  // We'll show each caption for the corresponding audio duration (if fetchedBuffers), else estimate time
  if(embedTTS.checked && fetchedAudioBuffers.length === facts.length && fetchedAudioBuffers.length > 0){
    // show captions timed to buffer durations
    const ac = ensureAudioCtx();
    let tNow = ac.currentTime + 0.2;
    for(let i=0;i<facts.length;i++){
      const duration = fetchedAudioBuffers[i].duration * 1000;
      // schedule caption display
      setTimeout(() => showFactText(facts[i]), Math.round((tNow - ac.currentTime) * 1000));
      tNow += fetchedAudioBuffers[i].duration + 0.12;
    }
  } else {
    // no embedded audio: show each fact for ~2.2s
    let offset = 0;
    for(let i=0;i<facts.length;i++){
      setTimeout(()=> showFactText(facts[i]), offset);
      offset += 2200;
    }
  }

  // stop recorder after approxDuration
  setTimeout(()=> {
    try{ mr.stop(); }catch(e){}
    captionOverlay.innerHTML = '';
  }, Math.max(approxDuration, 2500));
});

// small helper to show a fact immediately (used in export timing)
function showFactText(text){
  captionOverlay.innerHTML = '';
  const wrapper = document.createElement('div');
  const words = text.split(/\s+/);
  words.forEach((w,i)=>{
    const s = document.createElement('span');
    s.className = 'word';
    s.textContent = w + (i===words.length-1 ? '' : ' ');
    wrapper.appendChild(s);
    setTimeout(()=> s.classList.add('show'), 40*i);
  });
  captionOverlay.appendChild(wrapper);
}

// ---------- quick UX: update editor when facts count changes ----------
factsCount.addEventListener('change', ()=> populateFactsEditorFromPool());
function populateFactsEditorFromPool(){
  const n = Math.max(1, Math.min(12, parseInt(factsCount.value,10) || 7));
  const pool = factsSource.value || 'random';
  const arr = window.pickFacts(pool, n);
  currentFacts = arr.slice();
  factsEditor.value = arr.join("\n");
  fetchedAudioBuffers = [];
}
populateFactsEditorFromPool();

// show small reveal occasionally (fun)
function smallReveal(){
  revealImg.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='600'><rect width='100%' height='100%' fill='%23f6f8fb'/><text x='540' y='160' font-size='44' font-family='Impact,Arial' text-anchor='middle' fill='%230a1220'>FACTS</text><text x='540' y='360' font-size='20' text-anchor='middle' fill='%237c3aed'>Wait for the good one</text></svg>`;
  revealImg.classList.add('show');
  setTimeout(()=> revealImg.classList.remove('show'), 1500);
}
setInterval(smallReveal, 14_000);

// keyboard: space preview captions
document.body.addEventListener('keydown', (e) => {
  if(e.code === 'Space') { e.preventDefault(); previewCaptionsBtn.click(); }
});
