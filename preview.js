// preview.js (runs in preview.html)
(function(){
  const satisfyVideo = document.getElementById('satisfyVideo');
  const captionText = document.getElementById('captionText');
  let playlist = [];
  let settings = {};
  let bgMusic = null;
  let ttsVoice = null;

  // notify opener that popup is ready
  function post(msg){ if (window.opener && !window.opener.closed) window.opener.postMessage(msg, '*'); }
  window.addEventListener('load', ()=> post({ type:'popup-ready' }));

  // load voice preference robustly
  function loadVoices(force){
    const pick = () => {
      const vs = speechSynthesis.getVoices() || [];
      // force male/female if requested
      if (force === 'male') {
        ttsVoice = vs.find(v => /Google UK.*Male/i.test(v.name)) || vs.find(v=>v.lang && v.lang.startsWith('en-GB')) || vs[0] || null;
      } else if (force === 'female') {
        ttsVoice = vs.find(v => /Google UK.*Female/i.test(v.name)) || vs.find(v=>v.lang && v.lang.startsWith('en-GB')) || vs[0] || null;
      } else {
        ttsVoice = vs.find(v => /Google UK.*Male/i.test(v.name)) || vs.find(v => /Google UK.*Female/i.test(v.name)) ||
                   vs.find(v=>/Google UK/i.test(v.name)) || vs.find(v=>v.lang && v.lang.startsWith('en-GB')) || vs[0] || null;
      }
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
  }

  // message receiver
  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (d.type === 'load-playlist') {
      playlist = d.playlist || [];
      settings = d.settings || {};
      if (settings.bgMusicUrl) {
        bgMusic = new Audio(settings.bgMusicUrl);
        bgMusic.loop = true; bgMusic.volume = 0.45; bgMusic.crossOrigin = "anonymous";
      }
      loadVoices(settings.voiceForce || 'auto');
    } else if (d.type === 'start-playback') {
      if (playlist && playlist.length) {
        playAllFacts(playlist, settings).then(()=> post({ type:'playback-done' }));
      } else {
        post({ type:'playback-done' });
      }
    }
  });

  // caption autofit to avoid clipping and max 2 lines
  function autoFit(textEl){
    // set initial size
    let size = 36;
    textEl.style.fontSize = size + 'px';
    const parentH = textEl.parentElement.clientHeight - 16;
    let attempts = 0;
    while ((textEl.scrollHeight > parentH || textEl.offsetHeight > parentH) && attempts < 14) {
      size = Math.max(14, size - 2);
      textEl.style.fontSize = size + 'px';
      attempts++;
    }
  }

  // show caption with fade
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

  // split into ~6-word chunks for display only
  function splitChunks(text, size=6){
    const words = text.trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (let i=0;i<words.length;i+=size) out.push(words.slice(i,i+size).join(' '));
    return out;
  }

  // play one fact (speak whole sentence; update captions during speech)
  function playFact(fact, opts){
    return new Promise(async (resolve) => {
      // choose random video for this fact
      if (opts.videoList && opts.videoList.length) {
        satisfyVideo.src = opts.videoList[Math.floor(Math.random()*opts.videoList.length)];
        try { await satisfyVideo.play(); } catch(e){}
      }
      // prepare chunks
      const chunks = splitChunks(fact, opts.captionWords || 6);
      if (chunks.length === 0) chunks.push(fact);
      // ensure first chunk visible
      showCaption(chunks[0]);

      // start music
      if (bgMusic) {
        try { await bgMusic.play(); } catch(e){}
      }

      // build utterance for entire fact
      const utt = new SpeechSynthesisUtterance(fact);
      if (ttsVoice) utt.voice = ttsVoice;
      utt.rate = opts.ttsRate || 1.3;
      utt.onboundary = (ev) => {
        if (ev.charIndex === undefined || ev.charIndex === null) return;
        // map charIndex to chunk index
        let acc = 0;
        for (let i=0;i<chunks.length;i++){
          const start = acc;
          const end = acc + chunks[i].length + 1;
          if (ev.charIndex >= start && ev.charIndex < end) {
            showCaption(chunks[i]);
            break;
          }
          acc = end;
        }
      };

      // fallback if onboundary doesn't fire: timed approximation
      let fallbackTimers = [];
      utt.onstart = () => {
        setTimeout(() => {
          // if onboundary fired already, we don't schedule fallback
          if (typeof utt.onboundary === 'function' && utt.onboundary === null) return;
          // estimate utterance duration by words/sec (fallback)
          const words = fact.trim().split(/\s+/).length;
          const wps = 4.8 * (utt.rate || 1.0);
          const estMs = Math.max(400, Math.round((words / wps) * 1000));
          const per = Math.max(120, Math.floor(estMs / chunks.length));
          for (let i=0;i<chunks.length;i++){
            const t = i * per;
            fallbackTimers.push(setTimeout(()=> showCaption(chunks[i]), t));
          }
        }, 120);
      };

      utt.onend = () => {
        fallbackTimers.forEach(t=>clearTimeout(t));
        // ensure last chunk shown
        showCaption(chunks[chunks.length-1] || fact);
        setTimeout(()=> {
          // small breathing room before resolve (caller adds interFact gap)
          resolve();
        }, 0);
      };

      utt.onerror = (e) => {
        console.error('TTS error', e);
        resolve();
      };

      // speak
      speechSynthesis.cancel();
      speechSynthesis.speak(utt);
    });
  }

  // play all facts sequentially with interFact gap
  async function playAllFacts(list, opts){
    for (let i=0;i<list.length;i++){
      await playFact(list[i], opts);
      // gap after each fact
      await new Promise(r => setTimeout(r, (opts.interFactGap || 700)));
    }
    // stop music & video
    if (bgMusic) try { bgMusic.pause(), bgMusic.currentTime = 0; } catch(e){}
    try { satisfyVideo.pause(), satisfyVideo.currentTime = 0; } catch(e){}
  }

})();
