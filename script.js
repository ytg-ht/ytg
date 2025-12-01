/* Final script.js
 - Expects facts.js to define: const facts = [ ... ]
 - Voice selection: English voices only (user picks Google US/UK if available)
 - Caption chunks: default 5 words per chunk (user editable)
 - Uses videos array (your hosted media links)
 - Download visual-only WebM (1080x1920 target)
*/

/* ---------- CONFIG ---------- */
const videos = [
  "https://ytg-ht.github.io/ytg/media/slime1.mp4",
  "https://ytg-ht.github.io/ytg/media/slime2.mp4",
  "https://ytg-ht.github.io/ytg/media/slime3.mp4",
  "https://ytg-ht.github.io/ytg/media/slime4.mp4",
  "https://ytg-ht.github.io/ytg/media/soap5.mp4"
];

/* ---------- DOM ---------- */
const videoEl = document.getElementById("satisfy-video");
const captionOverlay = document.getElementById("captionOverlay");
const generateBtn = document.getElementById("generateBtn");
const nextVideoBtn = document.getElementById("nextVideoBtn");
const factsCountInput = document.getElementById("factsCount");
const factsCountVal = document.getElementById("factsCountVal");
const wordsPerChunkInput = document.getElementById("wordsPerChunk");
const chunkMsInput = document.getElementById("chunkMs");
const voiceSelect = document.getElementById("voiceSelect");
const previewVoiceBtn = document.getElementById("previewVoice");
const downloadVisualBtn = document.getElementById("downloadVisual");

/* UI sync */
factsCountInput.addEventListener('input', ()=> factsCountVal.textContent = factsCountInput.value);

/* ---------- facts pool ---------- */
if(!window.facts || !Array.isArray(facts) || facts.length === 0){
  captionOverlay.textContent = "No facts loaded — add facts.js";
  console.warn("facts.js missing or empty");
}
let remaining = [];
function refillPool(){ remaining = [...Array(facts.length).keys()]; shuffle(remaining); }
function popFact(){ if(remaining.length===0) refillPool(); return facts[remaining.pop()]; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }

/* ---------- voice handling ---------- */
let englishVoices = [];
function loadVoiceOptions(){
  const all = speechSynthesis.getVoices() || [];
  englishVoices = all.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'))
                     .sort((a,b)=> (/google/i.test(a.name)?0:1) - (/google/i.test(b.name)?0:1));
  voiceSelect.innerHTML = '';
  // preferred entries first if present
  const preferred = ['Google UK English Male','Google US English','Google US English','Google UK English'];
  preferred.forEach(name=>{
    const found = englishVoices.find(v=>v.name.toLowerCase().includes(name.toLowerCase()));
    if(found){
      const opt = document.createElement('option'); opt.value = found.name; opt.textContent = `${found.name} — ${found.lang}`;
      voiceSelect.appendChild(opt);
    }
  });
  // then all others
  englishVoices.forEach(v=>{
    if([...voiceSelect.options].some(o=>o.value===v.name)) return;
    const opt = document.createElement('option'); opt.value = v.name; opt.textContent = `${v.name} — ${v.lang}`;
    voiceSelect.appendChild(opt);
  });
}
speechSynthesis.onvoiceschanged = loadVoiceOptions;
loadVoiceOptions();

previewVoiceBtn.addEventListener('click', ()=> {
  speakText("Did you know this is a voice preview.");
});

function speakText(text, rate=1.0){
  if(!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  const chosen = voiceSelect.value;
  if(chosen){
    const v = speechSynthesis.getVoices().find(x=>x.name===chosen);
    if(v) utter.voice = v;
  }
  utter.rate = rate;
  utter.pitch = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  return utter;
}

/* ---------- chunking & captions ---------- */
function chunkText(text, n){
  let t = text.trim();
  if(!/^did you know/i.test(t)) t = "Did you know " + t.replace(/^\s*/,'');
  const words = t.split(/\s+/).filter(Boolean);
  const chunks = [];
  for(let i=0;i<words.length;i+=n) chunks.push(words.slice(i,i+n).join(' '));
  return chunks;
}

async function showChunksTimed(chunks, msPer){
  captionOverlay.textContent = "";
  for(let i=0;i<chunks.length;i++){
    captionOverlay.textContent = chunks[i];
    await new Promise(r => setTimeout(r, msPer));
  }
  captionOverlay.textContent = "";
}

/* ---------- speaking + sync (heuristic) ---------- */
async function playFact(fact){
  const wordsPerChunk = parseInt(wordsPerChunkInput.value,10) || 5;
  const msOverride = parseInt(chunkMsInput.value,10) || 900;
  const chunks = chunkText(fact, wordsPerChunk);

  // start speaking (non-blocking)
  speakText(fact, 1.0);

  // estimate timing: spread chunks across estimated vocal time
  const totalWords = fact.split(/\s+/).length;
  const estTotalMs = Math.max(900, Math.round(totalWords * 300));
  const msPer = msOverride || Math.max(300, Math.round(estTotalMs / Math.max(1, chunks.length)));

  for(let i=0;i<chunks.length;i++){
    captionOverlay.textContent = chunks[i];
    await new Promise(r => setTimeout(r, msPer));
  }
  captionOverlay.textContent = "";
}

/* ---------- play sequence while video runs ---------- */
async function playFactsSequence(nFacts = 7){
  // pick a random video
  const chosen = videos[Math.floor(Math.random()*videos.length)];
  videoEl.src = chosen;
  try{ await videoEl.play(); }catch(e){ /* autoplay blocked sometimes */ }

  for(let i=0;i<nFacts;i++){
    const f = popFact();
    await playFact(f);
  }
  // small pause, then allow video to continue or user to click next
  await new Promise(r => setTimeout(r, 300));
}

/* ---------- UI wiring ---------- */
generateBtn.addEventListener('click', async ()=> {
  generateBtn.disabled = true;
  try{
    const n = parseInt(factsCountInput.value,10) || 7;
    await playFactsSequence(n);
  }catch(e){ console.error(e); }
  generateBtn.disabled = false;
});

nextVideoBtn.addEventListener('click', ()=>{
  try{ window.speechSynthesis.cancel(); }catch(e){}
  captionOverlay.textContent = '';
  videoEl.src = videos[Math.floor(Math.random()*videos.length)];
  videoEl.play().catch(()=>{});
});

videoEl.addEventListener('ended', ()=>{
  captionOverlay.textContent = '';
  videoEl.src = videos[Math.floor(Math.random()*videos.length)];
  videoEl.play().catch(()=>{});
});

/* ---------- init ---------- */
refillPool();
videoEl.src = videos[Math.floor(Math.random()*videos.length)];
videoEl.load();

/* ---------- Download visual (WebM) ---------- */
downloadVisualBtn.addEventListener('click', async ()=> {
  downloadVisualBtn.disabled = true;
  const targetW = 1080;
  const targetH = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  function drawFrame(){
    // draw video cover-fit
    const vw = videoEl.videoWidth || targetW;
    const vh = videoEl.videoHeight || targetH;
    const scale = Math.max(targetW / vw, targetH / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (targetW - dw)/2;
    const dy = (targetH - dh)/2;
    try { ctx.drawImage(videoEl, dx, dy, dw, dh); } catch(e){}
    // draw caption bubble
    const caption = captionOverlay.textContent || '';
    if(caption){
      const padX = 80;
      ctx.font = '48px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = wrapText(ctx, caption, targetW - padX*2);
      const bubbleH = lines.length * 56 + 32;
      const bubbleW = targetW - 120;
      const bx = targetW/2 - bubbleW/2;
      const by = targetH - bubbleH - 120;
      ctx.fillStyle = 'rgba(0,0,0,0.88)';
      roundRect(ctx, bx, by, bubbleW, bubbleH, 28, true, false);
      ctx.fillStyle = '#fff';
      for(let i=0;i<lines.length;i++){
        ctx.fillText(lines[i], targetW/2, by + 24 + i*56 + 18);
      }
    }
  }

  function wrapText(ctx, text, maxWidth){
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for(const w of words){
      const test = current ? current + ' ' + w : w;
      const wsize = ctx.measureText(test).width;
      if(wsize > maxWidth && current){
        lines.push(current);
        current = w;
      } else current = test;
    }
    if(current) lines.push(current);
    return lines;
  }
  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y,   x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x,   y+h, r);
    ctx.arcTo(x,   y+h, x,   y,   r);
    ctx.arcTo(x,   y,   x+w, y,   r);
    ctx.closePath();
    if(fill) ctx.fill();
    if(stroke) ctx.stroke();
  }

  // draw loop
  let stop = false;
  function drawLoop(){
    drawFrame();
    if(!stop) requestAnimationFrame(drawLoop);
  }
  drawLoop();

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
  const chunks = [];
  recorder.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
  recorder.start();

  const recordDuration = Math.max(5000, Math.min(60000, (videoEl.duration && videoEl.duration*1000) || 20000));
  await new Promise(r => setTimeout(r, recordDuration));
  stop = true;
  recorder.stop();

  await new Promise(res => recorder.onstop = res);

  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'short_visual.webm';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  downloadVisualBtn.disabled = false;
});

console.log("Shorts generator ready. voices loaded:", (speechSynthesis.getVoices()||[]).length);
