// preview.js (popup)
(function () {
  const videoTop = document.getElementById('videoTop');
  const videoBottom = document.getElementById('videoBottom');
  const captionText = document.getElementById('captionText');

  let playlist = [];
  let settings = {};
  let bgMusic = null;
  let ttsVoice = null;

  // notify opener that popup is ready
  function post(msg) { if (window.opener && !window.opener.closed) window.opener.postMessage(msg, '*'); }
  window.addEventListener('load', () => post({ type: 'popup-ready' }));

  // choose TTS voice
  function chooseVoice(force) {
    const vs = speechSynthesis.getVoices() || [];
    if (force === 'male') {
      return vs.find(v => /Google UK.*Male/i.test(v.name)) || vs.find(v => v.lang && v.lang.startsWith('en-GB')) || vs[0] || null;
    } else if (force === 'female') {
      return vs.find(v => /Google UK.*Female/i.test(v.name)) || vs.find(v => v.lang && v.lang.startsWith('en-GB')) || vs[0] || null;
    } else {
      return vs.find(v => /Google UK.*Male/i.test(v.name)) ||
             vs.find(v => /Google UK.*Female/i.test(v.name)) ||
             vs.find(v => /Google UK/i.test(v.name)) ||
             vs.find(v => v.lang && v.lang.startsWith('en-GB')) ||
             vs[0] || null;
    }
  }

  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (d.type === 'load-playlist') {
      playlist = d.playlist || [];
      settings = d.settings || {};
      if (settings.bgMusicUrl) {
        bgMusic = new Audio(settings.bgMusicUrl);
        bgMusic.loop = true;
        bgMusic.volume = 0.15;
        bgMusic.crossOrigin = "anonymous";
      }
      const pick = () => { ttsVoice = chooseVoice(settings.voiceForce || 'auto'); };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    } else if (d.type === 'start-playback') {
      if (!playlist || playlist.length === 0) {
        post({ type: 'playback-done' });
        return;
      }
      playSequence(playlist, settings).then(()=> post({ type: 'playback-done' }));
    }
  });

  // split text into chunks for display only
  function splitChunks(text, size = 10) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(' '));
    return out;
  }

  // auto fit caption size to avoid overflow
  function autoFit(el) {
    let size = 44; // large for 1080x1920 scale (we preview scaled down in main)
    el.style.fontSize = size + 'px';
    const parentH = el.parentElement.clientHeight - 18;
    let attempts = 0;
    while ((el.scrollHeight > parentH || el.offsetHeight > parentH) && attempts < 14) {
      size = Math.max(18, size - 4);
      el.style.fontSize = size + 'px';
      attempts++;
    }
  }

  function showCaption(text) {
    captionText.classList.remove('in', 'out');
    captionText.classList.add('out');
    setTimeout(()=> {
      captionText.textContent = text;
      autoFit(captionText);
      captionText.classList.remove('out');
      captionText.classList.add('in');
    }, 60);
  }

  // preload next video in bottom and crossfade to it
  async function preloadAndCrossfade(nextSrc, crossMs = 500) {
    const top = videoTop;
    const bot = videoBottom;

    bot.src = nextSrc;
    bot.currentTime = 0;
    bot.muted = true;
    try {
      await bot.play();
      bot.pause();
      bot.currentTime = 0;
    } catch (e) {}

    bot.style.transition = `opacity ${crossMs}ms ease`;
    top.style.transition = `opacity ${crossMs}ms ease`;
    bot.style.opacity = 0;
    bot.style.zIndex = 1;
    top.style.zIndex = 2;

    bot.muted = false;
    bot.play().catch(()=>{});

    await new Promise(r => setTimeout(r, 40));
    bot.style.opacity = 1;
    top.style.opacity = 0;

    await new Promise(r => setTimeout(r, crossMs + 40));

    top.pause();
    top.style.opacity = 0;

    // swap srcs
    const tmp = top.src;
    top.src = bot.src;
    bot.src = tmp;

    // ensure top plays
    top.style.opacity = 1;
    bot.style.opacity = 0;
    bot.pause();
    try { top.play(); } catch(e){}
  }

  // speak and update captions (single utterance per fact)
  function speakAndCaption(fact, opts) {
    return new Promise(async (resolve) => {
      const chunks = splitChunks(fact, opts.captionWords || 10);
      if (!chunks.length) chunks.push(fact);
      showCaption(chunks[0]);

      if (bgMusic) {
        try { await bgMusic.play(); } catch(e) {}
        bgMusic.volume = 0.15;
      }

      const utt = new SpeechSynthesisUtterance(fact);
      if (ttsVoice) utt.voice = ttsVoice;
      utt.rate = opts.ttsRate || 0.85;
      utt.onboundary = (ev) => {
        if (ev.charIndex === undefined || ev.charIndex === null) return;
        let acc = 0;
        for (let i = 0; i < chunks.length; i++) {
          const start = acc;
          const end = acc + chunks[i].length + 1;
          if (ev.charIndex >= start && ev.charIndex < end) {
            showCaption(chunks[i]);
            break;
          }
          acc = end;
        }
      };

      // fallback timed changes if no boundary events
      let timers = [];
      utt.onstart = () => {
        setTimeout(()=> {
          // if boundary fired, skip fallback
          // estimate duration
          if (typeof utt.onboundary === 'function' && utt.onboundary === null) { /* nothing */ }
          const words = fact.trim().split(/\s+/).length;
          const wps = 4.8 * (utt.rate || 1.0);
          const estMs = Math.max(500, Math.round((words / wps) * 1000));
          const per = Math.max(140, Math.floor(estMs / chunks.length));
          for (let i=0;i<chunks.length;i++){
            timers.push(setTimeout(()=> showCaption(chunks[i]), i * per));
          }
        }, 120);
      };

      utt.onend = () => { timers.forEach(t=>clearTimeout(t)); showCaption(chunks[chunks.length-1] || fact); resolve(); };
      utt.onerror = (e) => { console.error('TTS error', e); resolve(); };

      speechSynthesis.cancel();
      speechSynthesis.speak(utt);
    });
  }

  // play all facts; switch video after each fact via crossfade preload (so no flash)
  async function playSequence(list, opts = {}) {
    // pick initial video and play top
    const videoList = opts.videoList || [];
    const first = videoList[Math.floor(Math.random() * videoList.length)];
    videoTop.src = first;
    videoTop.muted = true; // clip has no audio; keep muted
    try { await videoTop.play(); } catch(e) {}

    for (let i = 0; i < list.length; i++) {
      await speakAndCaption(list[i], opts);
      // gap after fact
      await new Promise(r => setTimeout(r, opts.interFactGap || 700));
      if (i < list.length - 1) {
        const next = videoList[Math.floor(Math.random() * videoList.length)];
        await preloadAndCrossfade(next, opts.crossfadeMs || 500);
      }
    }

    if (bgMusic) try { bgMusic.pause(), bgMusic.currentTime = 0; } catch(_) {}
    try { videoTop.pause(); videoTop.currentTime = 0; } catch(_) {}
  }

})();
