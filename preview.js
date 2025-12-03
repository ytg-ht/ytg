// preview.js - popup preview player
(function(){
  const videoTop = document.getElementById('videoTop');
  const videoBottom = document.getElementById('videoBottom');
  const captionText = document.getElementById('captionText');

  let playlist = [];
  let settings = {};
  let bgMusic = null;
  let ttsVoice = null;

  function post(msg){ if (window.opener && !window.opener.closed) window.opener.postMessage(msg,'*'); }
  window.addEventListener('load', ()=> post({ type:'popup-ready' }));

  function chooseVoice(force){
    const vs = speechSynthesis.getVoices() || [];
    if (force === 'male') return vs.find(v=>/Google UK.*Male/i.test(v.name)) || vs[0] || null;
    if (force === 'female') return vs.find(v=>/Google UK.*Female/i.test(v.name)) || vs[0] || null;
    return vs.find(v=>/Google UK.*Male/i.test(v.name)) || vs.find(v=>/Google UK.*Female/i.test(v.name)) || vs[0] || null;
  }

  window.addEventListener('message', (ev)=> {
    const d = ev.data || {};
    if (d.type === 'load-playlist') {
      playlist = d.playlist || [];
      settings = d.settings || {};
      if (settings.bgMusicUrl) {
        bgMusic = new Audio(settings.bgMusicUrl);
        bgMusic.loop = true;
        bgMusic.volume = settings.musicVolume || 0.15;
        bgMusic.crossOrigin = "anonymous";
      }
      ttsVoice = chooseVoice(settings.voiceForce);
      speechSynthesis.onvoiceschanged = ()=> { ttsVoice = chooseVoice(settings.voiceForce); };
    } else if (d.type === 'start-playback') {
      if (!playlist || !playlist.length) { post({ type:'playback-done' }); return; }
      playSequence(playlist, settings).then(()=> post({ type:'playback-done' }));
    }
  });

  function splitChunks(text, size=10){
    const ws = text.trim().split(/\s+/).filter(Boolean);
    const out=[];
    for (let i=0;i<ws.length;i+=size) out.push(ws.slice(i,i+size).join(' '));
    return out;
  }

  function autoFit(el){
    let size = 44;
    el.style.fontSize = size + 'px';
    const maxH = el.parentElement.clientHeight - 18;
    let attempts = 0;
    while ((el.scrollHeight > maxH || el.offsetHeight > maxH) && attempts < 12) {
      size = Math.max(16, size - 2);
      el.style.fontSize = size + 'px';
      attempts++;
    }
  }

  function showCaption(txt){
    captionText.classList.remove('in','out');
    captionText.classList.add('out');
    setTimeout(()=> {
      captionText.textContent = txt;
      autoFit(captionText);
      captionText.classList.remove('out');
      captionText.classList.add('in');
    }, 60);
  }

  async function preloadAndCrossfade(nextSrc, crossMs=500){
    const top = videoTop;
    const bot = videoBottom;
    bot.src = nextSrc; bot.muted = true;
    try { await bot.play(); bot.pause(); bot.currentTime = 0; } catch(e){}
    bot.style.transition = `opacity ${crossMs}ms ease`;
    top.style.transition = `opacity ${crossMs}ms ease`;
    bot.style.opacity = 0; bot.style.zIndex = 1; top.style.zIndex = 2;
    bot.muted = false; bot.play().catch(()=>{});
    await new Promise(r=>setTimeout(r,40));
    bot.style.opacity = 1; top.style.opacity = 0;
    await new Promise(r=>setTimeout(r,crossMs+40));
    top.pause(); top.style.opacity = 0;
    const tmp = top.src; top.src = bot.src; bot.src = tmp;
    top.style.opacity = 1; bot.style.opacity = 0; bot.pause();
    try { top.play(); } catch(e){}
  }

  function speakAndUpdate(fact, opts){
    return new Promise(async (resolve) => {
      const chunks = splitChunks(fact, opts.captionWords || 10);
      if (!chunks.length) chunks.push(fact);
      showCaption(chunks[0]);
      if (bgMusic) try { await bgMusic.play(); } catch(e){}
      const utt = new SpeechSynthesisUtterance(fact);
      if (ttsVoice) utt.voice = ttsVoice;
      utt.rate = opts.ttsRate || 0.85;
      utt.onboundary = (ev) => {
        if (ev.charIndex === undefined || ev.charIndex === null) return;
        let acc = 0;
        for (let i=0;i<chunks.length;i++){
          const s = acc; const e = acc + chunks[i].length + 1;
          if (ev.charIndex >= s && ev.charIndex < e) { showCaption(chunks[i]); break; }
          acc = e;
        }
      };
      let timers = [];
      utt.onstart = () => {
        setTimeout(()=> {
          // fallback timed updates
          const words = fact.trim().split(/\s+/).length;
          const wps = 4.8 * (utt.rate || 1.0);
          const estMs = Math.max(400, Math.round((words / wps) * 1000));
          const per = Math.max(120, Math.floor(estMs / chunks.length));
          for (let i=0;i<chunks.length;i++) timers.push(setTimeout(()=>showCaption(chunks[i]), i * per));
        }, 120);
      };
      utt.onend = () => { timers.forEach(t=>clearTimeout(t)); showCaption(chunks[chunks.length-1] || fact); resolve(); };
      utt.onerror = (e) => { console.error('TTS error',e); resolve(); };
      speechSynthesis.cancel(); speechSynthesis.speak(utt);
    });
  }

  async function playSequence(list, opts={}){
    const vids = opts.videoList || [];
    const first = vids[Math.floor(Math.random()*vids.length)];
    videoTop.src = first; videoTop.muted = true;
    try { await videoTop.play(); } catch(e){}
    for (let i=0;i<list.length;i++){
      await speakAndUpdate(list[i], opts);
      await new Promise(r=>setTimeout(r, opts.interFactGap || 700));
      if (i < list.length -1) {
        const next = vids[Math.floor(Math.random()*vids.length)];
        await preloadAndCrossfade(next, opts.crossfadeMs || 500);
      }
    }
    if (bgMusic) try { bgMusic.pause(), bgMusic.currentTime = 0; } catch(e){}
    try { videoTop.pause(), videoTop.currentTime = 0; } catch(e){}
  }

})();
