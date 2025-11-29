/* script.js — full client-side BrainRotter app
   Features:
   - 1080x1920 canvas rendering (scaled for preview)
   - Toggle layouts: split (video top, captions bottom) or overlay (full-screen captions)
   - Large story library: choose genre + length, randomize, edit prompt
   - Font/color/size/animation customization
   - Upload video or use demo procedural loops
   - SpeechSynthesis preview
   - Upload/record audio to embed in export (recommended for reliable audio)
   - Reveal image fade + WebAudio synth ambience (merged into export if recorded/uploaded)
   - Export .webm (fast). Optional MP4 conversion via ffmpeg.wasm (on-demand)
*/

// ---- DOM ----
const canvas = document.getElementById('renderCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

const themeSelect = document.getElementById('themeSelect');
const layoutSelect = document.getElementById('layoutSelect');

const videoUpload = document.getElementById('videoUpload');
const demoClipSelect = document.getElementById('demoClipSelect');
const randomizeBtn = document.getElementById('randomizeBtn');

const divider = document.getElementById('divider');
const storyPrompt = document.getElementById('storyPrompt');
const fontSelect = document.getElementById('fontSelect');
const fontColor = document.getElementById('fontColor');
const animSelect = document.getElementById('animSelect');
const fontSize = document.getElementById('fontSize');
const emojiInput = document.getElementById('emojiInput');
const categoryFilter = document.getElementById('categoryFilter');
const lengthFilter = document.getElementById('lengthFilter');

const newStoryBtn = document.getElementById('newStoryBtn');
const regenBtn = document.getElementById('regenBtn');
const ttsBtn = document.getElementById('ttsBtn');

const revealImg = document.getElementById('revealImg');

const audioUpload = document.getElementById('audioUpload');
const recordBtn = document.getElementById('recordBtn');
const stopRecBtn = document.getElementById('stopRecBtn');

const exportBtn = document.getElementById('exportBtn');
const useMp4Checkbox = document.getElementById('useMp4');

const voiceSelect = document.getElementById('voiceSelect');
const playbackRate = document.getElementById('playbackRate');

const toggleWatermark = document.getElementById('toggleWatermark');
const toggleRevealAudio = document.getElementById('toggleRevealAudio');
const randomClipsAllowed = document.getElementById('randomClipsAllowed');

const fxGlitch = document.getElementById('fxGlitch');
const fxZoom = document.getElementById('fxZoom');
const fxBass = document.getElementById('fxBass');

const helpBtn = document.getElementById('helpBtn');

// ---- State ----
let topVideo = null;
let topVideoURL = null;
let dividerPct = 0.58;
let currentStoryObj = null;
let audioCtx = null;
let recordedAudioBuffer = null;
let micRecorder = null;
let micStream = null;
let revealNodes = null;
let ffmpegLoaded = false;

// ---- Utilities ----
const choose = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

// ---- Populate categories ----
function populateCategoryFilter(){
  const cats = window.BR_STORIES.categories();
  categoryFilter.innerHTML = '<option value="any">Any genre</option>';
  cats.forEach(c => {
    const opt = document.createElement('option'); opt.value = c; opt.textContent = c;
    categoryFilter.appendChild(opt);
  });
}
populateCategoryFilter();

// ---- Populate voices for TTS preview ----
function updateVoices(){
  const vs = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  vs.forEach((v,i)=> {
    const opt = document.createElement('option'); opt.value = i; opt.textContent = `${v.name} — ${v.lang}`;
    voiceSelect.appendChild(opt);
  });
  if(vs.length===0){
    const opt = document.createElement('option'); opt.textContent = 'Default Browser Voice';
    voiceSelect.appendChild(opt);
  }
}
window.speechSynthesis.onvoiceschanged = updateVoices;
updateVoices();

// ---- Demo loop generator (procedural) ----
function makeDemoLoop(type='slime'){
  const c = document.createElement('canvas');
  c.width = 720; c.height = 1280;
  const g = c.getContext('2d');
  let t = 0;
  function frame(){
    g.fillStyle = type==='slime' ? '#05121a' : '#071018';
    g.fillRect(0,0,c.width,c.height);
    for(let i=0;i<12;i++){
      const x = (i*200 + t*8) % (c.width+200) - 100;
      const r = 40 + Math.sin((t+i)/6)*18;
      g.beginPath();
      g.fillStyle = `hsla(${(i*45+t*2)%360},80%,60%,0.85)`;
      g.arc(x, c.height/2 + Math.sin(i+t/7)*40, Math.abs(r), 0, Math.PI*2);
      g.fill();
    }
    t++;
    requestAnimationFrame(frame);
  }
  frame();
  const stream = c.captureStream(30);
  const mr = new MediaRecorder(stream);
  let chunks = [];
  mr.ondataavailable = e => chunks.push(e.data);
  mr.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.src = url; v.loop=true; v.muted=true; v.autoplay=true; v.playsInline=true;
    v.play().catch(()=>{});
    topVideo = v;
    topVideoURL = url;
    chunks = [];
  };
  mr.start();
  setTimeout(()=> mr.stop(), 1200);
}

// default demo
makeDemoLoop('slime');

// ---- Handle uploads ----
videoUpload.addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  if(topVideoURL) URL.revokeObjectURL(topVideoURL);
  topVideoURL = URL.createObjectURL(f);
  const v = document.createElement('video');
  v.src = topVideoURL; v.loop=true; v.muted=true; v.autoplay=true; v.playsInline=true;
  v.play().catch(()=>{});
  topVideo = v;
});

demoClipSelect.addEventListener('change', e=>{
  if(demoClipSelect.value === 'slime') makeDemoLoop('slime');
  else if(demoClipSelect.value === 'cut') makeDemoLoop('cut');
});

// ---- Audio upload / record (for embedding into export) ----
audioUpload.addEventListener('change', async e=>{
  const f = e.target.files[0];
  if(!f) return;
  const ab = await f.arrayBuffer();
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  recordedAudioBuffer = await ac.decodeAudioData(ab);
  alert('Audio loaded — it will be merged into export when you export.');
});

recordBtn.addEventListener('click', async ()=>{
  try{
    micStream = await navigator.mediaDevices.getUserMedia({ audio:true });
  } catch(e){
    alert('Mic permission denied.');
    return;
  }
  micRecorder = new MediaRecorder(micStream);
  let chunks = [];
  micRecorder.ondataavailable = ev => { if(ev.data && ev.data.size) chunks.push(ev.data); };
  micRecorder.onstop = async ()=>{
    const blob = new Blob(chunks, { type:'audio/webm' });
    const ab = await blob.arrayBuffer();
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    recordedAudioBuffer = await ac.decodeAudioData(ab);
    alert('Recording ready for export.');
    micStream.getTracks().forEach(t=>t.stop());
    micStream = null;
  };
  micRecorder.start();
  recordBtn.disabled = true; stopRecBtn.disabled = false;
});
stopRecBtn.addEventListener('click', ()=>{ if(micRecorder && micRecorder.state==='recording') micRecorder.stop(); recordBtn.disabled=false; stopRecBtn.disabled=true; });

// ---- Story generation / UI wiring ----
function setStoryIntoPrompt(obj){
  if(!obj) { storyPrompt.value = "No story available"; return; }
  storyPrompt.value = obj.lines.join("\n");
  currentStoryObj = obj;
}
function generateStory(usePrompt=false){
  const cat = categoryFilter.value || 'any';
  const len = lengthFilter.value || 'any';
  const s = window.BR_STORIES.getRandomStory(cat, len) || window.BR_STORIES.getRandomStory('any','any');
  if(!s) return;
  setStoryIntoPrompt(s);
  // schedule reveal if brainrot-like genres
  if(cat === 'any' ? (s.genre && s.genre.toLowerCase().includes('brainrot') || s.genre.toLowerCase().includes('petty')) : s.genre){
    // small chance to trigger reveal
    setTimeout(()=> {
      revealImg.src = choose(window.BR_MEMES);
      if(toggleRevealAudio.checked) startRevealSynth();
      revealImg.classList.add('show');
      setTimeout(()=> { revealImg.classList.remove('show'); stopRevealSynth(); }, 4200);
    }, 900);
  } else {
    revealImg.classList.remove('show');
    stopRevealSynth();
  }
}
newStoryBtn.addEventListener('click', ()=> generateStory(false));
regenBtn.addEventListener('click', ()=> generateStory(true));

// randomizer
randomizeBtn.addEventListener('click', ()=>{
  if(randomClipsAllowed.checked && Math.random()>0.3) makeDemoLoop(choose(['slime','cut']));
  categoryFilter.value = choose(window.BR_STORIES.categories());
  lengthFilter.value = choose(['short','medium','long']);
  fontSelect.value = choose(['Inter','Impact','Arial','Georgia','Courier New']);
  fontColor.value = choose(['#111827','#0b1220','#0a3b4d','#334155']);
  animSelect.value = choose(['static','bounce','zoom','shake']);
  fontSize.value = 56 + Math.floor(Math.random()*24);
  emojiInput.value = choose(['💀','🔥','😂','😭','👀','😳']);
  generateStory(false);
});

// populate filters
(function initFilters(){
  const cats = window.BR_STORIES.categories();
  categoryFilter.innerHTML = '<option value="any">Any genre</option>';
  cats.forEach(c=> { const o=document.createElement('option'); o.value=c; o.textContent=c; categoryFilter.appendChild(o); });
})();

// TTS preview
function playTTS(text){
  try{
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const vs = window.speechSynthesis.getVoices();
    if(vs.length && voiceSelect.value !== '') utt.voice = vs[voiceSelect.value] || vs[0];
    utt.rate = parseFloat(playbackRate.value) || 1.0;
    window.speechSynthesis.speak(utt);
  }catch(e){ console.warn('TTS failed', e); }
}
ttsBtn.addEventListener('click', ()=> playTTS(storyPrompt.value || ''));

// ---- Reveal synth (WebAudio) ----
function ensureAudioCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
function startRevealSynth(){
  const ac = ensureAudioCtx();
  stopRevealSynth();
  const dest = ac.createMediaStreamDestination();
  const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60 + Math.random()*30;
  const g = ac.createGain(); g.gain.value = 0.07;
  const bp = ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1200; bp.Q.value=1.2;
  o.connect(g).connect(bp).connect(dest);
  bp.connect(ac.destination);
  const noiseBuff = ac.createBuffer(1, ac.sampleRate*1, ac.sampleRate);
  const data = noiseBuff.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1)*0.2;
  const ns = ac.createBufferSource(); ns.buffer = noiseBuff; ns.loop = true;
  const ng = ac.createGain(); ng.gain.value = 0.02;
  ns.connect(ng).connect(bp);
  const lfo = ac.createOscillator(); lfo.type='sine'; lfo.frequency.value = 0.25;
  const lg = ac.createGain(); lg.gain.value = 300;
  lfo.connect(lg).connect(bp.frequency);
  o.start(); ns.start(); lfo.start();
  revealNodes = { o, ns, lfo, dest };
  // auto-stop after reveal
  setTimeout(()=> stopRevealSynth(), 4200);
  return dest;
}
function stopRevealSynth(){
  if(!revealNodes) return;
  try{ revealNodes.o.stop(); }catch(e){}
  try{ revealNodes.ns.stop(); }catch(e){}
  try{ revealNodes.lfo.stop(); }catch(e){}
  revealNodes = null;
}

// ---- Canvas render loop ----
function wrapText(ctx, text, maxWidth){
  if(!text) return [];
  const words = text.split(' ');
  const lines = []; let cur = words[0]||'';
  for(let i=1;i<words.length;i++){
    const w = words[i];
    if(ctx.measureText(cur + ' ' + w).width < maxWidth) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  lines.push(cur);
  return lines.slice(0,10);
}

function drawLoop(){
  // background
  ctx.fillStyle = document.body.classList.contains('dark') ? '#071018' : '#ffffff';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const topH = Math.floor(canvas.height * dividerPct);
  const bottomH = canvas.height - topH;

  // top: video or demo
  if(topVideo && topVideo.readyState >= 2){
    const vw = topVideo.videoWidth || topVideo.width;
    const vh = topVideo.videoHeight || topVideo.height;
    const scale = Math.max(canvas.width / vw, topH / vh);
    const sw = vw * scale, sh = vh * scale;
    const sx = (canvas.width - sw)/2, sy = (topH - sh)/2;
    ctx.drawImage(topVideo, sx, sy, sw, sh);
  } else {
    // procedural bg
    ctx.fillStyle = document.body.classList.contains('dark') ? '#071018' : '#eaf2ff';
    ctx.fillRect(0,0,canvas.width,topH);
    const t = Date.now()/600;
    for(let i=0;i<14;i++){
      const x = (i*120 + t*60) % canvas.width;
      const r = 60 + Math.sin((t+i)/10)*12;
      ctx.beginPath();
      ctx.fillStyle = document.body.classList.contains('dark') ? `hsla(${(i*30+t)%360},60%,60%,0.06)` : `hsla(${(i*30+t)%360},70%,50%,0.06)`;
      ctx.arc(x, topH/2 + Math.sin(i + t/8)*40, r, 0, Math.PI*2); ctx.fill();
    }
  }

  // bottom panel for split mode
  if(layoutSelect.value === 'split'){
    ctx.fillStyle = document.body.classList.contains('dark') ? '#071018' : '#ffffff';
    ctx.fillRect(0, topH, canvas.width, bottomH);
  }

  // captions rendering (layout matters)
  const fsz = parseInt(fontSize.value,10) || 56;
  ctx.textAlign = 'center';
  ctx.font = `700 ${fsz}px ${fontSelect.value || 'Inter'}`;
  ctx.fillStyle = fontColor.value || '#111827';
  ctx.strokeStyle = document.body.classList.contains('dark') ? '#000' : '#ffffff';
  ctx.lineWidth = Math.max(2, fsz/12);

  const text = storyPrompt.value.trim() || "Press New Story";
  const maxWidth = canvas.width - 160;
  const lines = wrapText(ctx, text, maxWidth);
  const anim = animSelect.value;
  const t = Date.now()/1000;

  let baseY;
  if(layoutSelect.value === 'split'){
    baseY = topH + 100;
  } else { // overlay full-screen captions: center
    baseY = canvas.height/2 - (lines.length*fsz)/2;
  }

  for(let i=0;i<lines.length;i++){
    let dx = 0, dy = 0;
    if(anim === 'bounce') dy = Math.sin(t*4 + i)*8;
    if(anim === 'zoom') ctx.font = `700 ${Math.floor(fsz*(1+Math.sin(t*2+i)/12))}px ${fontSelect.value}`;
    if(anim === 'shake') dx = (Math.random()-0.5)*6;
    const y = baseY + i*(fsz + 12) + dy;
    ctx.strokeText(lines[i], canvas.width/2 + dx, y);
    ctx.fillText(lines[i], canvas.width/2 + dx, y);
  }

  // watermark
  if(toggleWatermark.checked){
    ctx.globalAlpha = 0.95;
    ctx.font = '700 30px Inter';
    ctx.fillStyle = document.body.classList.contains('dark') ? '#e6eef8' : '#111827';
    ctx.fillText('BrainRotter', canvas.width - 260, canvas.height - 40);
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(drawLoop);
}
requestAnimationFrame(drawLoop);

// ---- Divider drag within UI overlay (affects dividerPct used by canvas) ----
let dragging = false;
divider.addEventListener('pointerdown', e => { dragging = true; divider.setPointerCapture(e.pointerId); });
window.addEventListener('pointerup', ()=> dragging=false);
window.addEventListener('pointermove', e => {
  if(!dragging) return;
  const rect = document.querySelector('.phone').getBoundingClientRect();
  const y = e.clientY - rect.top;
  dividerPct = clamp(y / rect.height, 0.22, 0.78);
});

// ---- Reveal display control ----
function scheduleRevealNow(){
  revealImg.src = choose(window.BR_MEMES);
  revealImg.classList.add('show');
  if(toggleRevealAudio.checked) startRevealSynth();
  setTimeout(()=>{ revealImg.classList.remove('show'); stopRevealSynth(); }, 4200);
}

// ---- Export flow (canvas + optionally audio merged) ----
async function buildMergedStream(durationMs=5000){
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);

  // If user uploaded/recorded audio buffer, create a MediaStreamDestination to merge
  if(recordedAudioBuffer){
    const ac = ensureAudioCtx();
    const src = ac.createBufferSource();
    src.buffer = recordedAudioBuffer;
    const g = ac.createGain(); g.gain.value = 1.0;
    const dest = ac.createMediaStreamDestination();
    src.connect(g).connect(dest);
    src.start(0);
    setTimeout(()=>{ try{ src.stop(); }catch(e){} }, durationMs+200);
    const merged = new MediaStream();
    canvasStream.getVideoTracks().forEach(t=> merged.addTrack(t));
    dest.stream.getAudioTracks().forEach(t=> merged.addTrack(t));
    return merged;
  }

  // else if revealNodes dest exists, add it
  if(revealNodes && revealNodes.dest){
    const merged = new MediaStream();
    canvasStream.getVideoTracks().forEach(t=> merged.addTrack(t));
    revealNodes.dest.stream.getAudioTracks().forEach(t=> merged.addTrack(t));
    return merged;
  }

  // otherwise return canvas-only
  return canvasStream;
}

exportBtn.addEventListener('click', async ()=>{
  exportBtn.disabled = true;
  exportBtn.textContent = 'Preparing...';
  const durationMs = 5500;
  const merged = await buildMergedStream(durationMs);

  let options = { mimeType: 'video/webm; codecs=vp9' };
  if(!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm; codecs=vp8' };
  if(!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };

  const recorded = [];
  let mr;
  try {
    mr = new MediaRecorder(merged, options);
  } catch(e){
    alert('Recording not supported: ' + e.message);
    exportBtn.disabled = false; exportBtn.textContent = 'Export Video';
    return;
  }
  mr.ondataavailable = e => { if(e.data && e.data.size) recorded.push(e.data); };
  mr.onstop = async ()=>{
    const webmBlob = new Blob(recorded, { type: 'video/webm' });
    if(useMp4Checkbox && useMp4Checkbox.checked){
      exportBtn.textContent = 'Converting to MP4...';
      try {
        const mp4 = await convertWebMToMP4(webmBlob);
        downloadBlob(mp4, `brainrot_${Date.now()}.mp4`);
      } catch(e){
        console.error(e);
        downloadBlob(webmBlob, `brainrot_${Date.now()}.webm`);
        alert('MP4 conversion failed — downloaded WEBM.');
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export Video';
      }
    } else {
      downloadBlob(webmBlob, `brainrot_${Date.now()}.webm`);
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export Video';
    }
  };
  mr.start();
  exportBtn.textContent = 'Recording...';
  setTimeout(()=>{ try{ mr.stop(); }catch(e){} }, 5500);
});

// ---- Download + FFmpeg conversion helpers ----
function downloadBlob(blob, name){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
async function ensureFFmpeg(){
  if(window.FFmpeg && window.FFmpeg.createFFmpeg) return window.FFmpeg;
  await new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.12/dist/ffmpeg.min.js';
    s.onload = res; s.onerror = ()=> rej(new Error('Failed to load ffmpeg'));
    document.body.appendChild(s);
  });
  return window.FFmpeg;
}
async function convertWebMToMP4(webmBlob){
  const FF = await ensureFFmpeg();
  const { createFFmpeg, fetchFile } = FF;
  const ff = createFFmpeg({ log: false });
  await ff.load();
  ff.FS('writeFile', 'in.webm', new Uint8Array(await webmBlob.arrayBuffer()));
  try {
    await ff.run('-i','in.webm','-c:v','copy','-c:a','aac','out.mp4');
  } catch(e){
    await ff.run('-i','in.webm','-c:v','libx264','-preset','fast','-crf','23','-c:a','aac','out.mp4');
  }
  const out = ff.FS('readFile','out.mp4');
  ff.FS('unlink','in.webm'); ff.FS('unlink','out.mp4');
  return new Blob([out.buffer], { type: 'video/mp4' });
}

// ---- small helpers ----
function ensureAudioCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }

// ---- Setup initial UI state ----
(function init(){
  // initial story
  generateStory(false);
  // theme toggle
  themeSelect.addEventListener('change', e => document.body.className = e.target.value === 'dark' ? 'dark' : 'light');
  // layout toggle handled implicitly by drawLoop (reads layoutSelect.value)
  layoutSelect.addEventListener('change', ()=>{ /* nothing else needed; canvas uses layoutSelect */ });

  // help popup
  helpBtn.addEventListener('click', ()=> alert("BrainRotter Help:\\n- New Story -> generates a story (you can edit).\\n- Upload or record audio to embed voice into exported video.\\n- Export produces a .webm file.\\n- Use MP4 conversion only if you need MP4 (browser will load ffmpeg-wasm)."));

  // tts voices
  window.speechSynthesis.onvoiceschanged = updateVoiceSelect;
  updateVoiceSelect();
})();
function updateVoiceSelect(){
  const vs = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  vs.forEach((v, i) => {
    const opt = document.createElement('option'); opt.value = i; opt.textContent = `${v.name} — ${v.lang}`;
    voiceSelect.appendChild(opt);
  });
  if(vs.length === 0){
    const o = document.createElement('option'); o.textContent = 'Browser default';
    voiceSelect.appendChild(o);
  }
}
