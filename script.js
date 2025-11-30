// script.js — BrainRotter simplified modern build
// Requires facts.js earlier (window.pickFacts)

// ---------- DOM ----------
const canvas = document.getElementById('renderCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const sourceVideo = document.getElementById('sourceVideo');
const captionOverlay = document.getElementById('captionOverlay');
const revealImg = document.getElementById('revealImg');

const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');
const closeSidebar = document.getElementById('closeSidebar');

const videoSelect = document.getElementById('videoSelect');
const generateBtn = document.getElementById('generateBtn');
const exportBtn = document.getElementById('exportBtn');

const factsSource = document.getElementById('factsSource');
const factsCount = document.getElementById('factsCount');
const factsEditor = document.getElementById('factsEditor');
const fetchTTSBtn = document.getElementById('fetchTTSBtn');
const previewBtn = document.getElementById('previewBtn');
const randomFactsBtn = document.getElementById('randomFactsBtn');

const voiceProvider = document.getElementById('voiceProvider');
const elevenApiKey = document.getElementById('elevenApiKey');
const elevenVoiceId = document.getElementById('elevenVoiceId');
const playbackRate = document.getElementById('playbackRate');
const embedTTS = document.getElementById('embedTTS');

// small helpers
const choose = (a) => a[Math.floor(Math.random()*a.length)];
let audioCtx = null;
function ensureAudioCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }

// ---------- UI: sidebar toggle ----------
toggleSidebar.addEventListener('click', ()=> {
  sidebar.classList.toggle('collapsed');
});
closeSidebar && closeSidebar.addEventListener('click', ()=> sidebar.classList.add('collapsed'));

// ---------- load local video assets (if any) ----------
async function scanLocalVideos(){
  // We can't read filesystem from browser; but if user added known filenames, list them
  const candidates = [
    'assets/videos/slime1.mp4',
    'assets/videos/slime2.mp4',
    'assets/videos/soap1.mp4',
    'assets/videos/sand1.mp4'
  ];
  videoSelect.innerHTML = `<option value="">Demo slime (built-in)</option>`;
  for(const src of candidates){
    try{
      // quick probe: try to fetch headers (CORS will apply on GitHub Pages but same origin usually works)
      const resp = await fetch(src, { method:'HEAD' });
      if(resp && resp.ok){
        const name = src.split('/').pop();
        const opt = document.createElement('option'); opt.value = src; opt.textContent = name; videoSelect.appendChild(opt);
      }
    }catch(e){
      // ignore — not present or cross-origin blocked
    }
  }
}
scanLocalVideos();

// ---------- procedural demo slime (fallback) ----------
function makeProceduralSlime(){
  const off = document.createElement('canvas');
  off.width = 720; off.height = 1280;
  const g = off.getContext('2d');
  let t=0;
  function frame(){
    g.fillStyle = '#041018'; g.fillRect(0,0,off.width,off.height);
    for(let i=0;i<14;i++){
      const x = (i*140 + t*6) % (off.width+240) - 120;
      const r = 40 + Math.sin((t+i)/6)*18;
      g.beginPath();
      g.fillStyle = `hsla(${(i*24 + t*3)%360},80%,60%,0.95)`;
      g.arc(x, off.height/2 + Math.sin(i + t/9)*46, Math.abs(r), 0, Math.PI*2);
      g.fill();
    }
    t++; requestAnimationFrame(frame);
  }
  frame();

  // create short looped webm blob for video element
  const stream = off.captureStream(30);
  const mr = new MediaRecorder(stream);
  let chunks = [];
  mr.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    const blob = new Blob(chunks, { type:'video/webm' });
    const url = URL.createObjectURL(blob);
    sourceVideo.src = url; sourceVideo.loop = true; sourceVideo.muted = true; sourceVideo.play().catch(()=>{});
  };
  mr.start(); setTimeout(()=> mr.stop(), 1200);
}
makeProceduralSlime();

// if user picks a local video in select
videoSelect.addEventListener('change', (e)=>{
  const v = e.target.value;
  if(!v){ makeProceduralSlime(); return; }
  sourceVideo.src = v; sourceVideo.loop = true; sourceVideo.muted = true; sourceVideo.play().catch(()=>{});
});

// ---------- drawing canvas (video top, white bottom) ----------
let dividerPct = 0.62;
function drawLoop(){
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const topH = Math.floor(canvas.height * dividerPct);
  if(sourceVideo && sourceVideo.readyState >= 2){
    const vw = sourceVideo.videoWidth || sourceVideo.width, vh = sourceVideo.videoHeight || sourceVideo.height;
    const scale = Math.max(canvas.width / vw, topH / vh);
    const sw = vw * scale, sh = vh * scale; const sx = (canvas.width - sw)/2, sy = (topH - sh)/2;
    ctx.drawImage(sourceVideo, sx, sy, sw, sh);
  } else {
    ctx.fillStyle = '#eefaff'; ctx.fillRect(0,0,canvas.width,topH);
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, topH, canvas.width, canvas.height - topH);
  requestAnimationFrame(drawLoop);
}
requestAnimationFrame(drawLoop);

// ---------- facts generation ----------
function populateFactsEditor(){
  const n = Math.max(3, Math.min(12, parseInt(factsCount.value,10) || 7));
  const pool = factsSource.value || 'random';
  const arr = (pool === 'random') ? pickFacts('random', n) : pickFacts(pool, n);
  factsEditor.value = arr.join("\n");
}
factsCount.addEventListener('change', populateFactsEditor);
factsSource.addEventListener('change', populateFactsEditor);
window.addEventListener('load', populateFactsEditor);

// ---------- caption chunking: show 3 words at a time (pop-in) ----------
function chunkText(text, wordsPer=3){
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  for(let i=0;i<words.length;i+=wordsPer) chunks.push(words.slice(i,i+wordsPer).join(' '));
  return chunks;
}
function showChunk(chunkText){
  captionOverlay.innerHTML = '';
  const wrapper = document.createElement('div');
  const words = chunkText.split(/\s+/);
  words.forEach((w,i)=>{
    const sp = document.createElement('span');
    sp.className = 'word';
    sp.textContent = w + (i===words.length-1 ? '' : ' ');
    wrapper.appendChild(sp);
    setTimeout(()=> sp.classList.add('show'), 50 * i);
  });
  captionOverlay.appendChild(wrapper);
}

// show one fact with chunk timing (used for preview)
async function showFactWithTiming(factText, msPerChunk=2000){
  const chunks = chunkText(factText, 3);
  for(let i=0;i<chunks.length;i++){
    showChunk(chunks[i]);
    await new Promise(r => setTimeout(r, msPerChunk));
  }
}

// ---------- voice handlers ----------
// Browser TTS wrapper (promise)
function speakBrowserTTS(text, rate=1){
  return new Promise(res => {
    try{
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = rate;
      utt.onend = () => res();
      window.speechSynthesis.speak(utt);
    }catch(e){
      const est = Math.max(900, text.split(/\s+/).length * 220);
      setTimeout(res, est);
    }
  });
}

// ElevenLabs helper (returns AudioBuffer)
async function fetchElevenTTS(text, apiKey, voiceId){
  if(!apiKey || !voiceId) throw new Error('Missing ElevenLabs API key or voice id');
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const resp = await fetch(url, {
    method:'POST',
    headers: {
      'Accept':'audio/mpeg',
      'Content-Type':'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({ text })
  });
  if(!resp.ok){
    const txt = await resp.text();
    throw new Error('TTS failed: ' + resp.status + ' ' + txt);
  }
  const ab = await resp.arrayBuffer();
  const ac = ensureAudioCtx();
  return await ac.decodeAudioData(ab);
}

// play AudioBuffer and await end
function playBuffer(buf, rate=1){
  return new Promise(res => {
    const ac = ensureAudioCtx();
    const src = ac.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    src.connect(ac.destination);
    src.onended = res;
    src.start();
  });
}

// fetched buffers for current facts (parallel to facts list)
let fetchedBuffers = [];

// fetch buffers for all facts (click handler)
fetchTTSBtn.addEventListener('click', async ()=>{
  const key = elevenApiKey.value.trim();
  const vid = elevenVoiceId.value.trim();
  if(!key || !vid){ alert('Paste ElevenLabs API key and voice id'); return; }
  const facts = factsEditor.value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(facts.length === 0){ alert('No facts to fetch'); return; }
  fetchedBuffers = [];
  fetchTTSBtn.disabled = true; fetchTTSBtn.textContent = 'Fetching...';
  try{
    for(let i=0;i<facts.length;i++){
      const buf = await fetchElevenTTS(facts[i], key, vid);
      fetchedBuffers.push(buf);
      await new Promise(r => setTimeout(r, 160)); // small throttle
    }
    alert('Fetched audio for all facts. You can preview & export with embedded audio.');
  }catch(err){
    console.error(err); alert('TTS fetch error: ' + err.message);
    fetchedBuffers = [];
  }finally{
    fetchTTSBtn.disabled = false; fetchTTSBtn.textContent = 'Fetch TTS for facts';
  }
});

// preview action: speak + show captions in sync (uses fetchedBuffers if available)
previewBtn.addEventListener('click', async ()=>{
  const facts = factsEditor.value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(facts.length === 0){ alert('No facts to preview'); return; }
  const rate = parseFloat(playbackRate.value || 1);
  // if we have buffers and lengths match, use them
  if(fetchedBuffers.length === facts.length){
    for(let i=0;i<facts.length;i++){
      const buf = fetchedBuffers[i];
      // compute chunk durations: split fact into chunks and divide buffer duration
      const chunks = chunkText(facts[i], 3);
      const msPerChunk = Math.max(500, (buf.duration * 1000) / Math.max(1, chunks.length));
      // start playing buffer (non-blocking) and show chunks timed
      playBuffer(buf, rate);
      for(let c=0;c<chunks.length;c++){
        showChunk(chunks[c]);
        await new Promise(r => setTimeout(r, msPerChunk));
      }
      await new Promise(r => setTimeout(r, 120));
    }
  } else {
    // fallback to browser TTS; show chunks in medium pacing (2s per chunk)
    for(let i=0;i<facts.length;i++){
      const fact = facts[i];
      const p = speakBrowserTTS(fact, rate);
      await showFactWithTiming(fact, 2000);
      await p;
      await new Promise(r => setTimeout(r, 120));
    }
  }
  captionOverlay.innerHTML = '';
});

// randomize facts
randomFactsBtn.addEventListener('click', ()=> populateFactsEditorFromPools());
function populateFactsEditorFromPools(){
  const n = Math.max(3, Math.min(12, parseInt(factsCount.value,10) || 7));
  const pool = factsSource.value || 'random';
  const arr = (pool === 'random') ? pickFacts('random', n) : pickFacts(pool, n);
  factsEditor.value = arr.join("\n");
  fetchedBuffers = [];
}
randomFactsBtn.addEventListener('click', populateFactsEditorFromPools);

// generate button: shows a small loading then auto-previews (with a double-check step)
generateBtn.addEventListener('click', async ()=>{
  generateBtn.disabled = true; generateBtn.textContent = 'Building...';
  // quick "double-check": if Eleven selected but no API key present warn user
  if(voiceProvider.value === 'eleven' && (!elevenApiKey.value.trim() || !elevenVoiceId.value.trim())){
    const ok = confirm('You selected ElevenLabs but did not paste API key/voice id. Continue with Browser TTS?');
    if(!ok){ generateBtn.disabled=false; generateBtn.textContent='Generate Preview'; return; }
  }
  // short debounce loading animation
  await new Promise(r => setTimeout(r, 700));
  // auto-preview (same as previewBtn)
  previewBtn.click();
  generateBtn.disabled=false; generateBtn.textContent='Generate Preview';
});

// export button (records canvas + embeds fetched audio when available)
exportBtn.addEventListener('click', async ()=>{
  exportBtn.disabled = true; exportBtn.textContent = 'Preparing...';
  const facts = factsEditor.value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(facts.length === 0){ alert('No facts to export'); exportBtn.disabled=false; exportBtn.textContent='Export .webm'; return; }

  // build merged stream: canvas video + optional audio stream (fetched buffers) if embed checked
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);
  let mergedStream = canvasStream;
  let approxMs = 2000;
  if(embedTTS.checked && fetchedBuffers.length === facts.length && fetchedBuffers.length > 0){
    const ac = ensureAudioCtx();
    const dest = ac.createMediaStreamDestination();
    let start = ac.currentTime + 0.2;
    for(let i=0;i<fetchedBuffers.length;i++){
      const src = ac.createBufferSource(); src.buffer = fetchedBuffers[i];
      src.connect(dest); src.start(start);
      start += fetchedBuffers[i].duration + 0.12;
    }
    mergedStream = new MediaStream();
    canvasStream.getVideoTracks().forEach(t=>mergedStream.addTrack(t));
    dest.stream.getAudioTracks().forEach(t=>mergedStream.addTrack(t));
    approxMs = Math.round((start - ac.currentTime) * 1000 + 500);
  } else {
    // estimate duration: facts * ~2s per chunk set — rough
    approxMs = Math.max(5000, facts.length * 2200);
  }

  // start MediaRecorder
  let options = { mimeType: 'video/webm; codecs=vp9' };
  if(!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm; codecs=vp8' };
  if(!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };

  const recorded = [];
  let mr;
  try {
    mr = new MediaRecorder(mergedStream, options);
  } catch(e){
    alert('Recording not supported: ' + e.message);
    exportBtn.disabled=false; exportBtn.textContent='Export .webm';
    return;
  }
  mr.ondataavailable = ev => { if(ev.data && ev.data.size) recorded.push(ev.data); };
  mr.onstop = ()=> {
    const blob = new Blob(recorded, { type: options.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `brainrot_facts_${Date.now()}.webm`; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    exportBtn.disabled=false; exportBtn.textContent='Export .webm';
  };

  // start recorder & schedule captions for export
  mr.start();
  exportBtn.textContent = 'Recording...';

  // schedule captions matching buffers if embedded; else approximate chunk timing
  if(embedTTS.checked && fetchedBuffers.length === facts.length){
    const ac = ensureAudioCtx();
    let startTime = ac.currentTime + 220/1000; // small offset
    for(let i=0;i<facts.length;i++){
      const chunks = chunkText(facts[i], 3);
      const msPerChunk = Math.max(600, (fetchedBuffers[i].duration * 1000) / Math.max(1, chunks.length));
      let offset = Math.round((startTime - ac.currentTime) * 1000);
      for(let c=0;c<chunks.length;c++){
        setTimeout(()=> showChunk(chunks[c]), offset);
        offset += msPerChunk;
      }
      startTime += fetchedBuffers[i].duration + 0.12;
    }
    setTimeout(()=> { try{ mr.stop(); }catch(e){} captionOverlay.innerHTML=''; }, approxMs + 400);
  } else {
    // no embedded audio: show chunks approx 2s per chunk
    let offset = 0;
    for(let i=0;i<facts.length;i++){
      const chunks = chunkText(facts[i], 3);
      let innerOff = 0;
      for(let c=0;c<chunks.length;c++){
        setTimeout(()=> showChunk(chunks[c]), offset + innerOff);
        innerOff += 2000;
      }
      offset += Math.max(innerOff, 2200);
    }
    setTimeout(()=> { try{ mr.stop(); }catch(e){} captionOverlay.innerHTML=''; }, offset + 600);
  }
});

// keyboard space => preview
document.body.addEventListener('keydown', (e)=> {
  if(e.code === 'Space'){ e.preventDefault(); previewBtn.click(); }
});

// small reveal every 12s for liveliness
setInterval(()=> {
  revealImg.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='600'><rect width='100%' height='100%' fill='%23f6f8fb'/><text x='540' y='160' font-size='44' font-family='Arial' text-anchor='middle' fill='%230a1220'>FACTS</text><text x='540' y='360' font-size='20' text-anchor='middle' fill='%237c3aed'>fun fact time</text></svg>`;
  revealImg.classList.add('show');
  setTimeout(()=> revealImg.classList.remove('show'), 1000);
}, 12000);

// utility: chunkText used in export scheduling too
function chunkText(text, wordsPer=3){
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  for(let i=0;i<words.length;i+=wordsPer) chunks.push(words.slice(i,i+wordsPer).join(' '));
  return chunks;
}

