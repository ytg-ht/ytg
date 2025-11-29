/* script.js — full working BrainRotter app (light UI) */

// ---- DOM ----
const canvas = document.getElementById('renderCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

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
const useMp4 = document.getElementById('useMp4');

const voiceSelect = document.getElementById('voiceSelect');
const playbackRate = document.getElementById('playbackRate');

const toggleWatermark = document.getElementById('toggleWatermark');
const toggleRevealAudio = document.getElementById('toggleRevealAudio');
const randomClipsAllowed = document.getElementById('randomClipsAllowed');

const fxGlitch = document.getElementById('fxGlitch');
const fxZoom = document.getElementById('fxZoom');
const fxBass = document.getElementById('fxBass');

const helpBtn = document.getElementById('helpBtn');

// ---- state ----
let topVideo = null, topVideoURL = null;
let dividerPct = 0.58;
let currentStoryObj = null;
let audioCtx = null;
let recordedAudioBuffer = null;
let micRecorder = null, micStream = null;
let revealNodes = null;

// small helpers
const choose = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

// ---- populate categories ----
(function populateCategories(){
  const cats = window.BR_STORIES.categories();
  categoryFilter.innerHTML = '<option value="any">Any genre</option>';
  cats.forEach(c => { const opt = document.createElement('option'); opt.value=c; opt.textContent=c; categoryFilter.appendChild(opt); });
})();
(function populateLengths(){
  lengthFilter.value = 'any';
})();

// ---- voices ----
function updateVoices(){
  const vs = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  vs.forEach((v,i)=> { const o=document.createElement('option'); o.value=i; o.textContent=`${v.name} — ${v.lang}`; voiceSelect.appendChild(o); });
  if(vs.length===0){ const o=document.createElement('option'); o.textContent='Default browser voice'; voiceSelect.appendChild(o); }
}
window.speechSynthesis.onvoiceschanged = updateVoices;
updateVoices();

// ---- demo loops (procedural) ----
function makeDemoLoop(type='slime'){
  const c = document.createElement('canvas'); c.width=720; c.height=1280;
  const g = c.getContext('2d'); let t=0;
  function frame(){
    g.fillStyle = type==='slime' ? '#07121a' : '#071018';
    g.fillRect(0,0,c.width,c.height);
    for(let i=0;i<12;i++){
      const x = (i*140 + t*6) % (c.width+200) - 100;
      const r = 40 + Math.sin((t+i)/6)*14;
      g.beginPath(); g.fillStyle = `hsla(${(i*30+t*3)%360},80%,60%,0.85)`; g.arc(x,c.height/2 + Math.sin(i+t/9)*40,Math.abs(r),0,Math.PI*2); g.fill();
    }
    t++;
    requestAnimationFrame(frame);
  }
  frame();
  const stream = c.captureStream(30);
  const mr = new MediaRecorder(stream);
  let chunks=[];
  mr.ondataavailable = e => chunks.push(e.data);
  mr.onstop = () => {
    const blob = new Blob(chunks,{type:'video/webm'}); const url = URL.createObjectURL(blob);
    const v = document.createElement('video'); v.src=url; v.loop=true; v.muted=true; v.autoplay=true; v.playsInline=true; v.play().catch(()=>{});
    topVideo = v; topVideoURL = url; chunks=[];
  };
  mr.start();
  setTimeout(()=> mr.stop(), 1200);
}
makeDemoLoop('slime');

// ---- uploads ----
videoUpload.addEventListener('change', e=>{
  const f = e.target.files[0];
  if(!f) return;
  if(topVideoURL) URL.revokeObjectURL(topVideoURL);
  topVideoURL = URL.createObjectURL(f);
  const v = document.createElement('video'); v.src = topVideoURL; v.loop=true; v.muted=true; v.autoplay=true; v.playsInline=true;
  v.play().catch(()=>{});
  topVideo = v;
});
demoClipSelect.addEventListener('change', e=>{
  if(demoClipSelect.value === 'slime') makeDemoLoop('slime');
  if(demoClipSelect.value === 'cut') makeDemoLoop('cut');
});

// ---- audio upload / record for embedding ----
audioUpload.addEventListener('change', async e=>{
  const f = e.target.files[0]; if(!f) return;
  const ab = await f.arrayBuffer(); const ac = new (window.AudioContext||window.webkitAudioContext)();
  recordedAudioBuffer = await ac.decodeAudioData(ab);
  alert('Audio loaded — will be embedded on export.');
});

recordBtn.addEventListener('click', async ()=>{
  try { micStream = await navigator.mediaDevices.getUserMedia({ audio:true }); }
  catch(e){ alert('Mic permission denied'); return; }
  micRecorder = new MediaRecorder(micStream); let chunks=[];
  micRecorder.ondataavailable = ev => { if(ev.data && ev.data.size) chunks.push(ev.data); };
  micRecorder.onstop = async ()=> {
    const blob = new Blob(chunks,{type:'audio/webm'}); const ab = await blob.arrayBuffer();
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    recordedAudioBuffer = await ac.decodeAudioData(ab);
    alert('Recording ready for export.');
    micStream.getTracks().forEach(t=>t.stop()); micStream=null;
  };
  micRecorder.start(); recordBtn.disabled=true; stopRecBtn.disabled=false;
});
stopRecBtn.addEventListener('click', ()=> { if(micRecorder && micRecorder.state==='recording') micRecorder.stop(); recordBtn.disabled=false; stopRecBtn.disabled=true; });

// ---- story generation ----
function setStory(obj){
  if(!obj) { storyPrompt.value = "No story"; return; }
  storyPrompt.value = obj.lines.join("\n");
  currentStoryObj = obj;
}
function generateStory(usePrompt=false){
  const cat = categoryFilter.value || 'any';
  const len = lengthFilter.value || 'any';
  let s = window.BR_STORIES.getRandomStory(cat, len);
  if(!s) s = window.BR_STORIES.getRandomStory('any','any');
  setStory(s);
  // reveal logic for certain genres: small chance
  if(toggleRevealAudio && toggleRevealAudio.checked && Math.random() > 0.5){
    scheduleReveal();
  } else {
    revealImg.classList.remove('show');
  }
}
newStoryBtn.addEventListener('click', ()=> generateStory(false));
regenBtn.addEventListener('click', ()=> generateStory(true));
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

// ---- TTS preview ----
function playTTS(text){
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const vs = window.speechSynthesis.getVoices();
    if(vs.length && voiceSelect.value !== '') u.voice = vs[voiceSelect.value] || vs[0];
    u.rate = parseFloat(playbackRate.value) || 1.0;
    window.speechSynthesis.speak(u);
  } catch(e){ console.warn('TTS error', e); }
}
ttsBtn.addEventListener('click', ()=> playTTS(storyPrompt.value || ''));

// ---- reveal images (embedded SVG data URIs) ----
const MEMES = [
  `data:image/svg+xml;utf8,
  <svg xmlns='http://www.w3.org/2000/svg' width='1080' height='600'><rect width='100%' height='100%' fill='%23f6f8fb'/><text x='540' y='160' font-size='64' font-family='Impact,Arial' text-anchor='middle' fill='%230a1220'>BRAINROT REVEAL</text><text x='540' y='360' font-size='28' text-anchor='middle' fill='%237c3aed'>Wait for the punchline...</text></svg>`,
  `data:image/svg+xml;utf8,
  <svg xmlns='http://www.w3.org/2000/svg' width='1080' height='600'><rect width='100%' height='100%' fill='%23fff'/><text x='540' y='160' font-size='48' font-family='Arial' text-anchor='middle' fill='%230a1220'>WHAT THEY DIDN'T EXPECT</text><text x='540' y='360' font-size='24' text-anchor='middle' fill='%230a1220'>...then it got weird</text></svg>`
];

// ---- reveal synth ----
function ensureAudioCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
function startRevealSynth(){
  const ac = ensureAudioCtx();
  stopRevealSynth();
  const dest = ac.createMediaStreamDestination();
  const o1 = ac.createOscillator(); o1.type='sawtooth'; o1.frequency.value = 60 + Math.random()*30;
  const g1 = ac.createGain(); g1.gain.value = 0.06;
  o1.connect(g1).connect(dest); g1.connect(ac.destination);
  const bufferSize = ac.sampleRate * 1.0; const buff = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const d = buff.getChannelData(0); for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*0.2;
  const src = ac.createBufferSource(); src.buffer = buff; src.loop = true;
  const bp = ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2;
  src.connect(bp).connect(dest); bp.connect(ac.destination);
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.25; const lg = ac.createGain(); lg.gain.value = 300;
  lfo.connect(lg).connect(bp.frequency);
  o1.start(); src.start(); lfo.start();
  revealNodes = { o1, src, lfo, dest };
  setTimeout(()=> stopRevealSynth(), 4200);
  return dest;
}
function stopRevealSynth(){
  if(!revealNodes) return;
  try{ revealNodes.o1.stop(); }catch(e){} try{ revealNodes.src.stop(); }catch(e){} try{ revealNodes.lfo.stop(); }catch(e){}
  revealNodes = null;
}

// ---- reveal schedule ----
function scheduleReveal(){
  revealImg.src = choose(MEMES);
  revealImg.classList.add('show');
  if(toggleRevealAudio.checked) startRevealSynth();
  setTimeout(()=> { revealImg.classList.remove('show'); stopRevealSynth(); }, 4200);
}

// ---- drawing ----
function wrapText(ctx, text, maxWidth){
  if(!text) return []; const words = text.split(' '); const lines = []; let cur = words[0]||'';
  for(let i=1;i<words.length;i++){ const w=words[i]; if(ctx.measureText(cur+' '+w).width < maxWidth) cur += ' '+w; else { lines.push(cur); cur = w; } }
  lines.push(cur); return lines.slice(0,10);
}

function drawLoop(){
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  const topH = Math.floor(canvas.height * dividerPct); const bottomH = canvas.height - topH;

  // top area (video/demo)
  if(topVideo && topVideo.readyState >= 2){
    const vw = topVideo.videoWidth || topVideo.width, vh = topVideo.videoHeight || topVideo.height;
    const scale = Math.max(canvas.width / vw, topH / vh); const sw = vw * scale, sh = vh * scale;
    const sx = (canvas.width - sw)/2, sy = (topH - sh)/2; ctx.drawImage(topVideo, sx, sy, sw, sh);
  } else {
    ctx.fillStyle = '#eef7ff'; ctx.fillRect(0,0,canvas.width,topH);
    const t = Date.now()/600;
    for(let i=0;i<12;i++){ const x = (i*120 + t*60) % canvas.width; const r = 60 + Math.sin((t+i)/8)*10; ctx.beginPath(); ctx.fillStyle = `hsla(${(i*30+t)%360},70%,55%,0.06)`; ctx.arc(x, topH/2 + Math.sin(i + t/10)*40, r, 0, Math.PI*2); ctx.fill(); }
  }

  if(layoutSelect.value === 'split'){ ctx.fillStyle = '#ffffff'; ctx.fillRect(0, topH, canvas.width, bottomH); }

  // captions
  const fsz = parseInt(fontSize.value,10) || 56; ctx.textAlign = 'center';
  ctx.font = `700 ${fsz}px ${fontSelect.value || 'Inter'}`; ctx.fillStyle = fontColor.value || '#111827';
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, fsz/12);

  const text = storyPrompt.value.trim() || 'Press New Story';
  const lines = wrapText(ctx, text, canvas.width - 160);
  const anim = animSelect.value; const t = Date.now()/1000;
  let baseY = layoutSelect.value === 'split' ? topH + 100 : canvas.height/2 - (lines.length * fsz)/2;

  for(let i=0;i<lines.length;i++){
    let dx = 0, dy = 0;
    if(anim === 'bounce') dy = Math.sin(t*4 + i) * 8;
    if(anim === 'zoom') ctx.font = `700 ${Math.floor(fsz*(1 + Math.sin(t*2 + i)/12))}px ${fontSelect.value}`;
    if(anim === 'shake') dx = (Math.random() - 0.5) * 6;
    const y = baseY + i*(fsz + 12) + dy;
    ctx.strokeText(lines[i], canvas.width/2 + dx, y);
    ctx.fillText(lines[i], canvas.width/2 + dx, y);
  }

  // watermark
  if(toggleWatermark.checked){
    ctx.globalAlpha = 0.95; ctx.font = '700 28px Inter'; ctx.fillStyle = '#111827'; ctx.fillText('BrainRotter', canvas.width - 260, canvas.height - 40); ctx.globalAlpha = 1;
  }

  requestAnimationFrame(drawLoop);
}
requestAnimationFrame(drawLoop);

// ---- divider drag ----
let dragging = false;
divider.addEventListener('pointerdown', e=>{ dragging=true; divider.setPointerCapture(e.pointerId); });
window.addEventListener('pointerup', ()=> dragging=false);
window.addEventListener('pointermove', e=> { if(!dragging) return; const rect = document.querySelector('.phone').getBoundingClientRect(); const y = e.clientY - rect.top; dividerPct = clamp(y / rect.height, 0.22, 0.78); });

// ---- export (canvas + optional audio) ----
async function buildMergedStream(durationMs=5500){
  const fps = 30; const canvasStream = canvas.captureStream(fps);
  if(recordedAudioBuffer){
    const ac = ensureAudioCtx(); const src = ac.createBufferSource(); src.buffer = recordedAudioBuffer;
    const g = ac.createGain(); g.gain.value = 1.0; const dest = ac.createMediaStreamDestination(); src.connect(g).connect(dest);
    src.start(0); setTimeout(()=>{ try{ src.stop(); }catch(e){} }, durationMs+200);
    const merged = new MediaStream(); canvasStream.getVideoTracks().forEach(t=>merged.addTrack(t)); dest.stream.getAudioTracks().forEach(t=>merged.addTrack(t));
    return merged;
  }
  if(revealNodes && revealNodes.dest){
    const merged = new MediaStream(); canvasStream.getVideoTracks().forEach(t=>merged.addTrack(t)); revealNodes.dest.stream.getAudioTracks().forEach(t=>merged.addTrack(t));
    return merged;
  }
  return canvasStream;
}

exportBtn.addEventListener('click', async ()=>{
  exportBtn.disabled = true; exportBtn.textContent = 'Preparing...';
  const stream = await buildMergedStream(5500);
  let options = { mimeType: 'video/webm; codecs=vp9' }; if(!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm; codecs=vp8' };
  if(!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
  const recorded = []; let mr;
  try { mr = new MediaRecorder(stream, options); } catch(e){ alert('Recording not supported: '+e.message); exportBtn.disabled=false; exportBtn.textContent='Export Video'; return; }
  mr.ondataavailable = e => { if(e.data && e.data.size) recorded.push(e.data); };
  mr.onstop = async ()=>{
    const webmBlob = new Blob(recorded, { type:'video/webm' });
    if(useMp4 && useMp4.checked){
      exportBtn.textContent = 'Converting to MP4...';
      try { const mp4 = await convertWebMToMP4(webmBlob); downloadBlob(mp4, `brainrot_${Date.now()}.mp4`); } catch(e){ console.error(e); downloadBlob(webmBlob, `brainrot_${Date.now()}.webm`); alert('MP4 convert failed — WEBM downloaded'); }
      exportBtn.disabled=false; exportBtn.textContent='Export Video';
    } else {
      downloadBlob(webmBlob, `brainrot_${Date.now()}.webm`); exportBtn.disabled=false; exportBtn.textContent='Export Video';
    }
  };
  mr.start(); exportBtn.textContent='Recording...'; setTimeout(()=>{ try{ mr.stop(); }catch(e){} }, 5500);
});

function downloadBlob(blob, name){ const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
async function ensureFFmpeg(){ if(window.FFmpeg && window.FFmpeg.createFFmpeg) return window.FFmpeg; await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://unpkg.com/@ffmpeg/ffmpeg@0.11.12/dist/ffmpeg.min.js'; s.onload=res; s.onerror=()=>rej(new Error('ffmpeg load fail')); document.body.appendChild(s); }); return window.FFmpeg; }
async function convertWebMToMP4(webmBlob){ const FF = await ensureFFmpeg(); const { createFFmpeg } = FF; const ff = createFFmpeg({ log:false }); await ff.load(); ff.FS('writeFile','in.webm', new Uint8Array(await webmBlob.arrayBuffer())); try{ await ff.run('-i','in.webm','-c:v','copy','-c:a','aac','out.mp4'); }catch(e){ await ff.run('-i','in.webm','-c:v','libx264','-preset','fast','-crf','23','-c:a','aac','out.mp4'); } const out = ff.FS('readFile','out.mp4'); ff.FS('unlink','in.webm'); ff.FS('unlink','out.mp4'); return new Blob([out.buffer], { type:'video/mp4' }); }

// ---- small helpers ----
function ensureAudioCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }

// ---- init UI wiring ----
(function init(){
  generateStory(false);
  layoutSelect.addEventListener('change', ()=>{ /* canvas uses layoutSelect.value */ });
  helpBtn.addEventListener('click', ()=> alert('BrainRotter Help:\\n• New Story -> generate; Edit prompt to change text.\\n• Upload or record audio to embed voice in export.\\n• Export creates WEBM; MP4 conversion optional (may be slow).'));
  window.speechSynthesis.onvoiceschanged = ()=> updateVoiceSelect();
  updateVoiceSelect();
})();
function updateVoiceSelect(){ const vs = window.speechSynthesis.getVoices(); voiceSelect.innerHTML=''; vs.forEach((v,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=`${v.name} — ${v.lang}`; voiceSelect.appendChild(o); }); if(vs.length===0){ const o=document.createElement('option'); o.textContent='Browser voice'; voiceSelect.appendChild(o); } }
