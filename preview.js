// preview.js (runs inside preview.html)
(function () {
  const videoTop = document.getElementById('videoTop');
  const videoBottom = document.getElementById('videoBottom');
  const captionText = document.getElementById('captionText');

  let playlist = [];
  let settings = {};
  let bgMusic = null;
  let ttsVoice = null;
  let isPlaying = false;

  // notify opener that popup is ready
  function post(msg) { if (window.opener && !window.opener.closed) window.opener.postMessage(msg, '*'); }
  window.addEventListener('load', () => post({ type: 'popup-ready' }));

  // pick TTS voice robustly (Google UK male default)
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
        bgMusic.volume = 0.15; // quieter music as requested
        bgMusic.crossOrigin = "anonymous";
      }
      // wait for voices
      const pick = () => {
        ttsVoice = chooseVoice(settings.voiceForce || 'auto');
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    } else if (d.type === 'start-playback') {
      if (!playlist || playlist.length === 0) {
        post({ type: 'playback-done' });
        return;
      }
      // start the full sequence
      playSequence(playlist, settings).then(() => {
        post({ type: 'playback-done' });
      });
    }
  });

  // helper: split fact into display chunks (~captionWords)
  function splitChunks(text, size = 10) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const out = [];
    for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(' '));
    return out;
  }

  // auto-fit caption to avoid clipping (reduce font-size)
  function autoFit(el) {
    let size = 32;
    el.style.fontSize = size + 'px';
    const parentH = el.parentElement.clientHeight - 14;
    let attempts = 0;
    while ((el.scrollHeight > parentH || el.offsetHeight > parentH) && attempts < 12) {
      size = Math.max(14, size - 2);
      el.style.fontSize = size + 'px';
      attempts++;
    }
  }

  // show caption with fade
  function showCaption(text) {
    captionText.classList.remove('in', 'out');
    captionText.classList.add('out');
    setTimeout(() => {
      captionText.textContent = text;
      autoFit(captionText);
      captionText.classList.remove('out');
      captionText.classList.add('in');
    }, 60);
  }

  // crossfade helper: preload next into hidden video element (bottom), then fade in
  // We always keep top video visible; bottom is used to preload and then fade to top.
  async function preloadAndCrossfade(nextSrc, crossMs = 500) {
    // Decide which element is currently visible at full opacity
    // We'll use videoTop as current, videoBottom as preloader; after fade, swap roles.
    const top = videoTop;
    const bot = videoBottom;

    // prepare loader (bot)
    bot.src = nextSrc;
    bot.currentTime = 0;
    bot.muted = true; // start silent until crossfade
    // ensure bot is ready to play
    try {
      await bot.play();
      bot.pause(); // load frames and decode
      bot.currentTime = 0;
    } catch (e) {
      // play() may be blocked — still try to set src and wait for canplay
    }

    // To crossfade: set bot opacity 0 -> 1 while top fades 1 -> 0
    bot.style.transition = `opacity ${crossMs}ms ease`;
    top.style.transition = `opacity ${crossMs}ms ease`;
    bot.style.opacity = 0;
    // ensure bot is visible in DOM stacking beneath top. We'll put bot behind top via z-index.
    bot.style.zIndex = 1;
    top.style.zIndex = 2;

    // ready to play bot for real (unmute) slightly before fade
    bot.muted = false;
    bot.play().catch(()=>{ /* ignore autoplay block if any */ });

    // start crossfade
    // small delay to let frames be ready
    await new Promise(r => setTimeout(r, 40));
    bot.style.opacity = 1;
    top.style.opacity = 0;

    // wait for transition
    await new Promise(r => setTimeout(r, crossMs + 40));

    // after fade: pause previous (top), swap roles by swapping src values and styles
    top.pause();
    top.style.opacity = 0;
    // swap sources so top element always points to current visible
    const tmpSrc = top.src;
    top.src = bot.src;
    bot.src = tmpSrc;

    // reset styles: top becomes visible
    top.style.opacity = 1;
    bot.style.opacity = 0;
    bot.pause();
    // ensure top plays continuously
    try { top.play(); } catch(e){}
  }

  // speak full fact while updating captions (onboundary + fallback)
  function speakAndUpdateCaptions(fact, opts) {
    return new Promise(async (resolve) => {
      const chunks = splitChunks(fact, opts.captionWords || 10);
      if (chunks.length === 0) chunks.push(fact);
      // show first chunk
      showCaption(chunks[0]);

      // start music (if present)
      if (bgMusic) {
        try { await bgMusic.play(); } catch (e) { /* play may be blocked until user interaction */ }
        bgMusic.volume = 0.15;
      }

      // utterance for whole fact
      const utt = new SpeechSynthesisUtterance(fact);
      if (ttsVoice) utt.voice = ttsVoice;
      utt.rate = opts.ttsRate || 0.85;
      utt.pitch = 1.0;

      // onboundary to sync chunks (charIndex)
      let usedBoundary = false;
      const charStarts = [];
      let acc = 0;
      for (let i = 0; i < chunks.length; i++) {
        charStarts.push(acc);
        acc += chunks[i].length + 1;
      }

      utt.onboundary = (ev) => {
        if (ev.charIndex === undefined || ev.charIndex === null) return;
        usedBoundary = true;
        const ci = ev.charIndex;
        for (let i = 0; i < charStarts.length; i++) {
          const s = charStarts[i];
          const e = (i + 1 < charStarts.length) ? charStarts[i + 1] : Infinity;
          if (ci >= s && ci < e) {
            showCaption(chunks[i]);
            break;
          }
        }
      };

      // fallback timed sync if no boundary events
      let timers = [];
      utt.onstart = () => {
        setTimeout(() => {
          if (usedBoundary) return;
          // estimate duration by words per second
          const words = fact.trim().split(/\s+/).length;
          const wps = 4.8 * (utt.rate || 1.0);
          const estMs = Math.max(400, Math.round((words / wps) * 1000));
          const per = Math.max(120, Math.floor(estMs / chunks.length));
          for (let i = 0; i < chunks.length; i++) {
            timers.push(setTimeout(() => showCaption(chunks[i]), i * per));
          }
        }, 120);
      };

      utt.onend = () => {
        timers.forEach(t => clearTimeout(t));
        // show last chunk
        showCaption(chunks[chunks.length - 1] || fact);
        resolve();
      };

      utt.onerror = (e) => {
        console.error('TTS error', e);
        resolve();
      };

      speechSynthesis.cancel();
      speechSynthesis.speak(utt);
    });
  }

  // play entire playlist (7 facts) with crossfade video switching between facts
  async function playSequence(list, opts = {}) {
    isPlaying = true;
    const videoList = opts.videoList || [];
    // pick initial video and play it in the top element
    const firstVideo = videoList[Math.floor(Math.random() * videoList.length)];
    videoTop.src = firstVideo;
    videoTop.muted = false;
    try { await videoTop.play(); } catch (e) { /* may be blocked until recording user action */ }

    for (let i = 0; i < list.length; i++) {
      const fact = list[i];
      // preload next video (choose next random) but do not disturb current top
      const nextVideo = videoList[Math.floor(Math.random() * videoList.length)];
      // preload & crossfade 1s before next fact (as requested). We crossfade AFTER speech or just before next fact plays?
      // We want same video for the entire fact stream, but you asked: "1s before new video plays, preload it under and then swap".
      // We'll crossfade at the end of this iteration preparing for the next fact (if there is one).
      await speakAndUpdateCaptions(fact, opts);
      // inter-fact gap
      await new Promise(r => setTimeout(r, opts.interFactGap || 700));

      // if there's a next fact, preload then crossfade so next fact starts on the new clip
      if (i < list.length - 1) {
        // preload next into bottom and crossfade
        await preloadAndCrossfade(nextVideo, opts.crossfadeMs || 500);
      }
    }

    // finish: stop music/video
    if (bgMusic) try { bgMusic.pause(), bgMusic.currentTime = 0; } catch (e) {}
    try { videoTop.pause(); videoTop.currentTime = 0; } catch (e) {}
    isPlaying = false;
  }

})();
