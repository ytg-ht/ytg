/* script.js — rebuilt BrainRotter app
   - big center video preview (canvas)
   - right-side controls (story, caption timing, voice, export)
   - captions appear N words at a time with pop-in animation
   - ElevenLabs optional integration (user provides API key)
   - local assets support (assets/videos/*.mp4) + procedural demos
   - export .webm and optional MP4 conversion (ffmpeg.wasm)
*/

// ---------- DOM ----------
const sourceVideo = document.getElementById('sourceVideo');
const canvas = document.getElementById('renderCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

const revealImg = document.getElementById('revealImg');

const demoClip = document.getElementById('demoClip');
const localClip = document.getElementById('localClip');
const videoUpload = document.getElementById('videoUpload');
const randomAll = document.getElementById('randomAll');

const genreSelect = document.getElementById('genreSelect');
const lengthSelect = document.getElementById('lengthSelect');
const storyPrompt = document.getElementById('storyPrompt');
const fontSelect = document.getElementById('fontSelect');
const fontSize = document.getElementById('fontSize');
const fontColor = document.getElementById('fontColor');

const wordsPerChunk = document.getElementById('wordsPerChunk');
const chunkSpeed = document.getElementById('chunkSpeed');
const captionAnim = document.getElementById('captionAnim');

const newStoryBtn = document.getElementById('newStoryBtn');
const regenBtn = document.getElementById('regenBtn');
const previewCaptions = document.getElementById('previewCaptions');

const voiceProvider = document.getElementById('voiceProvider');
const elevenForm = document.getElementById('elevenForm');
const elevenKey = document.getElementById('elevenKey');
const elevenVoice = document.getElementById('elevenVoice');
const fetchElevenPreview = document.getElementById('fetchElevenPreview');

const previewVoiceBtn = document.getElementById('previewVoice');
const playbackRate = document.getElementById('playbackRate');
const embedTTS = document.getElementById('embedTTS');

const audioUpload = document.getElementById('audioUpload');
const recordVoice = document.getElementById('recordVoice');
const stopRecord = document.getElementById('stopRecord');

const watermarkToggle = document.getElementById('watermarkToggle');
const mp4Toggle = document.getElementById('mp4Toggle');
const exportBtn = document.getElementById('exportBtn');

const helpBtn = document.getElementById('helpBtn');
const themeSelect = document.getElementById('themeSelect');

// ---------- state ----------
let topVideoElement = null;
let topVideoBlobURL = null;
let proceduralMode = true;
let dividerPct = 0.58;
let currentStory = null;
let audioCtx = null;
let recordedAudioBuffer = null;
let mediaRecorder = null;
let micStream = null;
let revealNodes = null;
let ffmpegLoaded = false;
let ttsAudioBuffer = null; // buffer fetched from ElevenLabs if used

// ---------- helpers ----------
const choose = a => a[Math.floor(Math.random()*a.length)];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

// ---------- local video library (names you should add into assets/videos/) ----------
// Put your real slime videos in /assets/videos/ and they will appear in the "Local clip" select.
// Example filenames to add: assets/videos/slime1.mp4, assets/videos/slime2.mp4, assets/videos/soap1.mp4
const LOCAL_LIBRARY = [
  { id: 'slime1', title: 'Slime 1', src: 'assets/videos/slime1.mp4' },
  { id: 'slime2', title: 'Slime 2', src: 'assets/videos/slime2.mp4' },
  { id: 'soap1', title: 'Soap Cut', src: 'assets/videos/soap1.mp4' },
  { id: 'sand1', title: 'Kinetic Sand', src: 'assets/videos/sand1.mp4' }
];

// populate local clip select
(function populateLocal(){
  localClip.innerHTML = '<option value="">— local asset —</option>';
  LOCAL_LIBRARY.forEach(it => {
    const o=document.createElement('option'); o.value=it.src; o.textContent=it.title; localClip.appendChild(o);
  });
})();

// ---------- procedural demo loops (fallback) ----------
function makeProcedural(type='slime_proc'){
  const off = document.createElement('canvas');
  off.width = 720; off.height = 1280;
  const g = off.getContext('2d'); let t=0;
  function frame(){
    g.fillStyle = (type==='slime_proc') ? '#05121a' : '#081018';
    g.fillRect(0,0,off.width,off.height);
    for(let i=0;i<14;i++){
      const x = (i*160 + t*6) % (off.width+240) - 120;
      const r = 40 + Math.sin((t+i)/7)*18;
      g.beginPath();
      g.fillStyle = `hsla(${(i*30+t*3)%360},80%,60%,0.85)`;
      g.arc(x, off.height/2 + Math.sin(i + t/10)*46, Math.abs(r), 0, Math.PI*2);
      g.fill();
    }
    t++;
    requestAnimationFrame(frame);
  }
  frame();

  // make a short video blob via captureStream + MediaRecorder
  const stream = off.captureStream(30);
  const mr = new MediaRecorder(stream);
  let chunks = [];
  mr.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    if(topVideoBlobURL) URL.revokeObjectURL(topVideoBlobURL);
    topVideoBlobURL = URL.createObjectURL(blob);
    sourceVideo.src = topVideoBlobURL;
    sourceVideo.loop = true; sourceVideo.muted = true; sourceVideo.play().catch(()=>{});
    topVideoElement = sourceVideo;
    proceduralMode = true;
  };
  mr.start();
  setTimeout(()=> mr.stop(), 1300);
}

// start default procedural slime
makeProcedural('slime_proc');

// ---------- UI wiring: demo/local/upload selection ----------
demoClip.addEventListener('change', e=>{
  if(!demoClip.value) return;
  makeProcedural(demoClip.value);
});

localClip.addEventListener('change', e=>{
  const v = localClip.value;
  if(!v) return;
  proceduralMode = false;
  if(topVideoBlobURL) { try { URL.revokeObjectURL(topVideoBlobURL); } catch(_){} }
  sourceVideo.src = v;
  sourceVideo.loop = true; sourceVideo.muted = true;
  sourceVideo.play().catch(()=>{});
  topVideoElement = sourceVideo;
});

videoUpload.addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  proceduralMode = false;
  if(topVideoBlobURL) try{ URL.revokeObjectURL(topVideoBlobURL) } catch(_) {}
  topVideoBlobURL = URL.createObjectURL(f);
  sourceVideo.src = topVideoBlobURL; sourceVideo.loop=true; sourceVideo.muted=true; sourceVideo.play().catch(()=>{});
  topVideoElement = sourceVideo;
});

randomAll.addEventListener('click', ()=> {
  // random story + clip
  const cats = window.BR_STORIES.categories();
  genreSelect.value = choose(cats);
  lengthSelect.value = choose(['short','medium','long']);
  // pick a random local clip if available
  const r = choose(LOCAL_LIBRARY);
  if(r) localClip.value = r.src, localClip.dispatchEvent(new Event('change'));
  generateStory(false);
});

// ---------- story generation ----------
function fillGenreOptions(){
  const cats = window.BR_STORIES.categories();
  genreSelect.innerHTML = '<option value="any">Any</option>';
  cats.forEach(c => { const o=document.createElement('option'); o.value=c; o.textContent=c; genreSelect.appendChild(o); });
}
fillGenreOptions();

function setStoryToPrompt(obj){
  if(!obj){ storyPrompt.value = "No story." ; return; }
  storyPrompt.value = obj.lines.join(' ');
  currentStory = obj;
}
function generateStory(usePrompt=false){
  const cat = genreSelect.value || 'any';
  const len = lengthSelect.value || 'any';
  let s = window.BR_STORIES.getRandomStory(cat, len) || window.BR_STORIES.getRandomStory('any','any');
  if(!s) { storyPrompt.value = "No stories found"; return; }
  setStoryToPrompt(s);
  // small chance show reveal
  if(Math.random() > 0.65){
    scheduleReveal();
  }
}
newStoryBtn.addEventListener('click', ()=> generateStory(false));
regenBtn.addEventListener('click', ()=> generateStory(true));

// init
generateStory(false);

// ---------- caption chunking + display ----------
// We'll create an overlay DOM element (not on canvas) rendered visually over the canvas for crisp pop-in.
// Build a single floating container over the canvas to hold animated words.
const captionContainer = document.createElement('div');
captionContainer.style.position = 'absolute';
captionContainer.style.left = '50%';
captionContainer.style.transform = 'translateX(-50%)';
captionContainer.style.pointerEvents = 'none';
captionContainer.style.width = '86%';
captionContainer.style.textAlign = 'center';
captionContainer.style.bottom = '22%';
captionContainer.style.zIndex = '40';
captionContainer.style.fontWeight = '700';
captionContainer.style.letterSpacing = '-0.5px';
captionContainer.style.fontFamily = 'Inter, Arial, sans-serif';
document.querySelector('.phone').appendChild(captionContainer);

let captionTimer = null;
function chunkText(text, n){
  const words = text.trim().split(/\s+/).filter(Boolean);
  if(words.length===0) return [];
  const chunks = [];
  for(let i=0;i<words.length;i+=n){
    chunks.push(words.slice(i,i+n).join(' '));
  }
  return chunks;
}

function clearCaptionContainer(){
  captionContainer.innerHTML = '';
  captionContainer.style.opacity = '1';
}

function showChunks(text, wordsPer=3, msPerChunk=420, anim='pop'){
  // clear any existing timer
  if(captionTimer) { clearInterval(captionTimer); captionTimer = null; }
  clearCaptionContainer();
  const chunks = chunkText(text, wordsPer);
  let i = 0;
  const showNext = ()=>{
    captionContainer.innerHTML = '';
    if(i >= chunks.length) return;
    const chunk = chunks[i];
    // build span per word for pop-in effect
    const span = document.createElement('div');
    span.style.fontSize = (parseInt(fontSize.value,10) || 56) + 'px';
    span.style.color = fontColor.value || '#111827';
    span.style.display = 'inline-block';
    span.style.lineHeight = '1.05';
    // split words to individual spans
    const words = chunk.split(' ');
    words.forEach((w,j)=>{
      const wspan = document.createElement('span');
      wspan.className = 'caption-word';
      wspan.textContent = w + (j === words.length-1 ? '' : ' ');
      wspan.style.marginRight = '4px';
      // slight stagger for each word
      setTimeout(()=> {
        wspan.classList.add('caption-pop');
      }, 60*j);
      span.appendChild(wspan);
    });
    captionContainer.appendChild(span);
    i++;
  };
  // show first immediately
  showNext();
  captionTimer = setInterval(()=>{
    if(i >= chunks.length){ clearInterval(captionTimer); captionTimer=null; return; }
    showNext();
  }, msPerChunk);
}

// preview captions button
previewCaptions.addEventListener('click', ()=>{
  const words = parseInt(wordsPerChunk.value,10);
  const ms = parseInt(chunkSpeed.value,10);
  const anim = captionAnim.value;
  showChunks(storyPrompt.value || 'No story', words, ms, anim);
});

// ---------- voice playback ----------
// Two modes:
// - Browser TTS via SpeechSynthesis (fast preview, robotic sometimes but immediate)
// - ElevenLabs fetch: downloads an audio file (higher quality). User must paste API key + voice id.
// We will fetch audio into ttsAudioBuffer so it can be embedded in exported video if embedTTS.checked

function ensureAudioCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }

// Browser TTS
function playBrowserTTS(text, rate=1){
  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    window.speechSynthesis.speak(u);
  }catch(e){
    console.warn('Browser TTS error', e);
  }
}

// ElevenLabs helper (optional) — NOTE: user must provide key and voice ID
async function fetchElevenLabsTTS(text, apiKey, voiceId){
  if(!apiKey || !voiceId) throw new Error('Missing ElevenLabs key/voice id');
  // This call uses ElevenLabs v1 tts endpoint. The exact voice IDs vary — user must supply one.
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`;
  const body = text;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: text, voice: voiceId })
  });
  if(!resp.ok) {
    const txt = await resp.text();
    throw new Error('TTS fetch failed: ' + resp.status + ' ' + txt);
  }
  // get arrayBuffer and decode
  const ab = await resp.arrayBuffer();
  const ac = ensureAudioCtx();
  const buf = await ac.decodeAudioData(ab);
  return buf;
}

document.getElementById('voiceProvider').addEventListener('change', e=>{
  if(e.target.value === 'eleven') elevenForm.style.display = 'block'; else elevenForm.style.display = 'none';
});

// fetch ElevenLabs preview button
if(fetchElevenPreview){
  fetchElevenPreview.addEventListener('click', async ()=>{
    const key = elevenKey.value.trim();
    const vid = elevenVoice.value.trim();
    const text = storyPrompt.value;
    if(!key || !vid) { alert('Please paste your ElevenLabs key and voice id'); return; }
    try{
      fetchElevenPreview.disabled = true; fetchElevenPreview.textContent = 'Fetching...';
      const buf = await fetchElevenLabsTTS(text, key, vid);
      ttsAudioBuffer = buf; // store for embedding
      // play buffer quickly
      const ac = ensureAudioCtx();
      const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start();
      setTimeout(()=> { fetchElevenPreview.disabled = false; fetchElevenPreview.textContent = 'Fetch & Preview'; }, 800);
    }catch(err){
      alert('TTS fetch error: ' + err.message);
      fetchElevenPreview.disabled = false; fetchElevenPreview.textContent = 'Fetch & Preview';
    }
  });
}

// preview voice sync button (attempt to sync voice with caption chunks)
// Note: for browser TTS, we simply speak entire text while showing chunks — timing will match roughly
previewVoiceBtn && previewVoiceBtn.addEventListener('click', async ()=>{
  const words = parseInt(wordsPerChunk.value,10);
  const ms = parseInt(chunkSpeed.value,10);
  const text = storyPrompt.value || '';
  // if ElevenLabs selected and ttsAudioBuffer exists and embedTTS checked, use buffer
  if(voiceProvider.value === 'eleven' && ttsAudioBuffer){
    // play buffer and start chunk display simultaneously
    const ac = ensureAudioCtx();
    const src = ac.createBufferSource(); src.buffer = ttsAudioBuffer; src.connect(ac.destination); src.start();
    showChunks(text, words, ms, captionAnim.value);
    return;
  }
  // else use browser TTS + show chunks
  showChunks(text, words, ms, captionAnim.value);
  playBrowserTTS(text, parseFloat(playbackRate.value));
});

// audio upload / record (for embedding)
audioUpload.addEventListener('change', async e=>{
  const f = e.target.files[0];
  if(!f) return;
  const ab = await f.arrayBuffer();
  const ac = ensureAudioCtx();
  recordedAudioBuffer = await ac.decodeAudioData(ab);
  alert('Uploaded audio will be embedded into export.');
});

recordVoice.addEventListener('click', async ()=>{
  try{
    micStream = await navigator.mediaDevices.getUserMedia({ audio:true });
  } catch(e){
    alert('Microphone permission denied.');
    return;
  }
  let chunks = [];
  mediaRecorder = new MediaRecorder(micStream);
  mediaRecorder.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
  mediaRecorder.onstop = async ()=>{
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const ab = await blob.arrayBuffer();
    const ac = ensureAudioCtx();
    recordedAudioBuffer = await ac.decodeAudioData(ab);
    alert('Recording ready for export.');
    micStream.getTracks().forEach(t=>t.stop());
    micStream = null;
  };
  mediaRecorder.start();
  recordVoice.disabled = true; stopRecord.disabled = false;
});
stopRecord.addEventListener('click', ()=>{ if(mediaRecorder && mediaRecorder.state==='recording') mediaRecorder.stop(); recordVoice.disabled=false; stopRecord.disabled=true; });

// ---------- reveal synth ----------
function startRevealSynth(){
  const ac = ensureAudioCtx();
  stopRevealSynth();
  const dest = ac.createMediaStreamDestination();
  const o = ac.createOscillator(); o.type='sawtooth'; o.frequency.value = 70 + Math.random()*40;
  const g = ac.createGain(); g.gain.value = 0.06;
  o.connect(g).connect(dest);
  g.connect(ac.destination);

  const buff = ac.createBuffer(1, ac.sampleRate * 1.0, ac.sampleRate); const d = buff.getChannelData(0);
  for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*0.12;
  const src = ac.createBufferSource(); src.buffer = buff; src.loop = true; src.connect(dest); src.connect(ac.destination);

  const lfo = ac.createOscillator(); lfo.frequency.value = 0.25; const lg = ac.createGain(); lg.gain.value = 300;
  lfo.connect(lg).connect(ac.createBiquadFilter().frequency);

  o.start(); src.start(); lfo.start();
  revealNodes = { o, src, lfo, dest };
  setTimeout(()=> stopRevealSynth(), 4200);
}
function stopRevealSynth(){ if(!revealNodes) return; try{ revealNodes.o.stop(); }catch(e){} try{ revealNodes.src.stop(); }catch(e){} try{ revealNodes.lfo.stop(); }catch(e){} revealNodes=null; }

// reveal scheduling
function scheduleReveal(){
  revealImg.src = choose([ // small built-in SVG reveals
    `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='600'><rect width='100%' height='100%' fill='%23f6f8fb'/><text x='540' y='160' font-size='64' font-family='Impact,Arial' text-anchor='middle' fill='%230a1220'>REVEAL</text><text x='540' y='360' font-size='28' text-anchor='middle' fill='%237c3aed'>wait for it</text></svg>`,
    `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='600'><rect width='100%' height='100%' fill='%23fff'/><text x='540' y='160' font-size='48' font-family='Arial' text-anchor='middle' fill='%230a1220'>WHAT HAPPENED</text><text x='540' y='360' font-size='24' text-anchor='middle' fill='%230a1220'>then it changed</text></svg>`
  ]);
  revealImg.classList.add('show');
  if(watermarkToggle.checked) startRevealSynth();
  setTimeout(()=> { revealImg.classList.remove('show'); stopRevealSynth(); }, 4200);
}

// ---------- drawing to canvas (video + background) ----------
function drawLoop(){
  // background
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const topH = Math.floor(canvas.height * dividerPct);
  const bottomH = canvas.height - topH;

  // draw video area (top part)
  if(topVideoElement && topVideoElement.readyState >= 2){
    const vw = topVideoElement.videoWidth || topVideoElement.width;
    const vh = topVideoElement.videoHeight || topVideoElement.height;
    const scale = Math.max(canvas.width / vw, topH / vh);
    const sw = vw * scale, sh = vh * scale;
    const sx = (canvas.width - sw)/2, sy = (topH - sh)/2;
    ctx.drawImage(topVideoElement, sx, sy, sw, sh);
  } else {
    // procedural background
    ctx.fillStyle = '#f0fbff'; ctx.fillRect(0,0,canvas.width,topH);
    const t = Date.now()/600;
    for(let i=0;i<12;i++){
      const x = (i*120 + t*60) % canvas.width;
      const r = 60 + Math.sin((t+i)/10)*12;
      ctx.beginPath(); ctx.fillStyle = `hsla(${(i*30+t)%360},70%,55%,0.06)`; ctx.arc(x, topH/2 + Math.sin(i + t/8)*40, r, 0, Math.PI*2); ctx.fill();
    }
  }

  // bottom (if using split layout - we always use split look visually)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, topH, canvas.width, bottomH);

  // watermark text drawn in corner when enabled (canvas overlay)
  if(watermarkToggle.checked){
    ctx.font = '700 26px Inter';
    ctx.fillStyle = '#111827';
    ctx.fillText('BrainRotter', canvas.width - 240, canvas.height - 48);
  }

  requestAnimationFrame(drawLoop);
}
requestAnimationFrame(drawLoop);

// ---------- caption container styling apply ----------
function updateCaptionStyle(){
  captionContainer.style.bottom = (canvas.height * (1 - dividerPct) * 0.3) + 'px';
  captionContainer.style.fontFamily = fontSelect.value;
  captionContainer.style.color = fontColor.value;
  captionContainer.style.fontSize = (fontSize.value || 56) + 'px';
}
fontSelect.addEventListener('change', updateCaptionStyle);
fontSize.addEventListener('input', updateCaptionStyle);
fontColor.addEventListener('input', updateCaptionStyle);
updateCaptionStyle();

// ---------- export (canvas capture + optional audio merging) ----------
async function buildMergedStream(durationMs=5500){
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);

  // prioritise recordedAudioBuffer, then ttsAudioBuffer (from Eleven), else return video-only
  if(recordedAudioBuffer){
    const ac = ensureAudioCtx();
    const src = ac.createBufferSource();
    src.buffer = recordedAudioBuffer;
    const dest = ac.createMediaStreamDestination();
    src.connect(dest);
    src.start(0);
    setTimeout(()=>{ try{ src.stop(); }catch(e){} }, durationMs+200);
    const merged = new MediaStream();
    canvasStream.getVideoTracks().forEach(t=> merged.addTrack(t));
    dest.stream.getAudioTracks().forEach(t=> merged.addTrack(t));
    return merged;
  }

  if(embedTTS.checked && ttsAudioBuffer){
    const ac = ensureAudioCtx();
    const src = ac.createBufferSource();
    src.buffer = ttsAudioBuffer;
    const dest = ac.createMediaStreamDestination();
    src.connect(dest);
    src.start(0);
    setTimeout(()=>{ try{ src.stop(); }catch(e){} }, durationMs+200);
    const merged = new MediaStream();
    canvasStream.getVideoTracks().forEach(t=> merged.addTrack(t));
    dest.stream.getAudioTracks().forEach(t=> merged.addTrack(t));
    return merged;
  }

  // fallback: canvas only
  return canvasStream;
}

exportBtn.addEventListener('click', async ()=>{
  exportBtn.disabled = true; exportBtn.textContent = 'Preparing...';
  // show caption sequence while recording
  const words = parseInt(wordsPerChunk.value,10);
  const ms = parseInt(chunkSpeed.value,10);
  showChunksAndMaybeTTS(storyPrompt.value || '', words, ms);

  const stream = await buildMergedStream(5500);
  let options = { mimeType: 'video/webm; codecs=vp9' };
  if(!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm; codecs=vp8' };
  if(!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };

  const recorded = [];
  let mr;
  try{
    mr = new MediaRecorder(stream, options);
  }catch(e){
    alert('MediaRecorder not supported: ' + e.message);
    exportBtn.disabled = false; exportBtn.textContent = 'Export Video';
    return;
  }
  mr.ondataavailable = ev => { if(ev.data && ev.data.size) recorded.push(ev.data); };
  mr.onstop = async () => {
    const blob = new Blob(recorded, { type: 'video/webm' });
    if(mp4Toggle.checked){
      exportBtn.textContent = 'Converting to MP4... (may be slow)';
      try{
        const mp4 = await convertWebMToMP4(blob);
        downloadBlob(mp4, `brainrot_${Date.now()}.mp4`);
      }catch(e){
        console.error(e);
        downloadBlob(blob, `brainrot_${Date.now()}.webm`);
        alert('MP4 conversion failed — saving WEBM instead.');
      } finally {
        exportBtn.disabled=false; exportBtn.textContent='Export Video';
      }
    } else {
      downloadBlob(blob, `brainrot_${Date.now()}.webm`);
      exportBtn.disabled=false; exportBtn.textContent='Export Video';
    }
  };
  mr.start();
  exportBtn.textContent = 'Recording...';
  setTimeout(()=>{ try{ mr.stop(); }catch(e){} }, 5500);
});

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ffmpeg conversion (on-demand)
async function ensureFFmpeg(){
  if(ffmpegLoaded && window.FFmpeg) return window.FFmpeg;
  await new Promise((res,rej)=>{
    const s = document.createElement('script'); s.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.12/dist/ffmpeg.min.js';
    s.onload = res; s.onerror = ()=> rej(new Error('Failed to load ffmpeg')); document.body.appendChild(s);
  });
  ffmpegLoaded = true;
  return window.FFmpeg;
}
async function convertWebMToMP4(webmBlob){
  const FF = await ensureFFmpeg();
  const { createFFmpeg } = FF;
  const ff = createFFmpeg({ log:false });
  await ff.load();
  ff.FS('writeFile','in.webm', new Uint8Array(await webmBlob.arrayBuffer()));
  try{
    await ff.run('-i','in.webm','-c:v','copy','-c:a','aac','out.mp4');
  }catch(e){
    await ff.run('-i','in.webm','-c:v','libx264','-preset','fast','-crf','23','-c:a','aac','out.mp4');
  }
  const out = ff.FS('readFile','out.mp4');
  ff.FS('unlink','in.webm'); ff.FS('unlink','out.mp4');
  return new Blob([out.buffer], { type: 'video/mp4' });
}

// ---------- combined caption + TTS preview helper ----------
function showChunksAndMaybeTTS(text, words, ms){
  // If ElevenLabs ttsAudioBuffer exists & embedTTS checked, play buffer and show chunks
  if(voiceProvider.value === 'eleven' && ttsAudioBuffer && embedTTS.checked){
    const ac = ensureAudioCtx();
    const src = ac.createBufferSource(); src.buffer = ttsAudioBuffer; src.connect(ac.destination); src.start();
    showChunks(text, words, ms, captionAnim.value);
    return;
  }
  // else fallback to browser TTS while showing chunks
  showChunks(text, words, ms, captionAnim.value);
  playBrowserTTS(text, parseFloat(playbackRate.value));
}

// ---------- helper: show chunks (wrapper for caption container) ----------
function showChunks(text, wordsPer, msPer, anim){
  // reuse showChunks function from earlier (caption logic). We'll call preview/display function defined earlier.
  showChunks_core(text, wordsPer, msPer, anim);
}

// We break caption show logic into a core function so we can call it from elsewhere.
let caption_interval = null;
function showChunks_core(text, wordsPer=3, msPer=420, anim='pop'){
  if(caption_interval){ clearInterval(caption_interval); caption_interval = null; }
  captionContainer.innerHTML = '';
  const chunks = chunkTextForScript(text, wordsPer);
  let idx = 0;
  function showOne(){
    captionContainer.innerHTML = '';
    if(idx >= chunks.length) return;
    const block = document.createElement('div');
    block.style.fontSize = (parseInt(fontSize.value,10) || 56) + 'px';
    block.style.color = fontColor.value || '#111827';
    const words = chunks[idx].split(' ');
    words.forEach((w,j) => {
      const sp = document.createElement('span');
      sp.textContent = w + (j===words.length-1 ? '' : ' ');
      sp.className = 'caption-word';
      block.appendChild(sp);
      setTimeout(()=> sp.classList.add('caption-pop'), 60*j);
    });
    captionContainer.appendChild(block);
    idx++;
  }
  showOne();
  caption_interval = setInterval(()=>{
    if(idx >= chunks.length){ clearInterval(caption_interval); caption_interval=null; return; }
    showOne();
  }, msPer);
}

function chunkTextForScript(text, n){
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  for(let i=0;i<words.length;i+=n) chunks.push(words.slice(i,i+n).join(' '));
  return chunks;
}

// ---------- small utilities + init ----------
function ensureAudioCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
function playBrowserTTS(text, rate=1){ try{ window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = rate; window.speechSynthesis.speak(u); }catch(e){ console.warn(e); } }

// preview: fetch eleven + play + set ttsAudioBuffer if embed
fetchElevenPreview && fetchElevenPreview.addEventListener('click', async ()=>{
  const key = elevenKey.value.trim(), vid = elevenVoice.value.trim();
  if(!key || !vid){ alert('Paste your ElevenLabs API key and voice id'); return; }
  try{
    fetchElevenPreview.disabled = true; fetchElevenPreview.textContent = 'Fetching...';
    const buf = await (async ()=>{
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}`, {
        method:'POST',
        headers: { 'xi-api-key': key, 'Accept':'audio/mpeg', 'Content-Type':'application/json' },
        body: JSON.stringify({ text: storyPrompt.value || '', voice: vid })
      });
      if(!resp.ok) throw new Error('TTS failed: ' + resp.status);
      const ab = await resp.arrayBuffer();
      const ac = ensureAudioCtx();
      return await ac.decodeAudioData(ab);
    })();
    ttsAudioBuffer = buf;
    // play
    const ac = ensureAudioCtx(); const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start();
    fetchElevenPreview.disabled=false; fetchElevenPreview.textContent='Fetch & Preview';
  }catch(err){
    alert('ElevenLabs fetch error: ' + err.message);
    fetchElevenPreview.disabled=false; fetchElevenPreview.textContent='Fetch & Preview';
  }
});

// theme
themeSelect.addEventListener('change', e => { document.body.className = e.target.value === 'dark' ? 'dark' : 'light'; });

// help
helpBtn.addEventListener('click', ()=> alert('BrainRotter Help:\\n- Add real MP4s to assets/videos/ and choose them in Local clip.\\n- For high-quality voice use ElevenLabs: paste API key + voice id, fetch and check "Embed TTS".\\n- Use "Preview Captions" to test timing. Export creates a WEBM downloadable file.'));

