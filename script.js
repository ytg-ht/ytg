// script.js — Playable short with whole-fact TTS + sliding 5-word captions
console.log("YT Short generator (playable) loaded");

(function () {
  // DOM
  const voiceSelect = document.getElementById("voiceSelect");
  const generateBtn = document.getElementById("generateBtn");
  const playBtn = document.getElementById("playBtn");
  const stopBtn = document.getElementById("stopBtn");
  const status = document.getElementById("status");
  const videoEl = document.getElementById("bgVideo");
  const laneA = document.getElementById("laneA");
  const laneB = document.getElementById("laneB");

  // config
  const BASE = "https://ytg-ht.github.io/ytg/"; // site root
  const VIDEOS = [
    "media/slime1.mp4",
    "media/slime2.mp4",
    "media/slime3.mp4",
    "media/slime4.mp4",
    "media/soap1.mp4"
  ];
  const FACTS_PER_SHORT = 7;
  const CHUNK_WORDS = 5;          // caption chunk size
  const AVG_WPM = 160;            // words per minute for estimate (used to sync captions)
  const WORD_MS = 60000 / AVG_WPM; // ms per word (digit-by-digit: 60,000 / 160 = 375 ms/word)
  // note: to be safe, use 375ms/word as base (rounded)
  const MS_PER_WORD = Math.round(60000 / AVG_WPM); // 375

  // local state
  let usedSet = new Set();
  const KEY_USED = 'ytg_used_v1';
  try {
    const raw = localStorage.getItem(KEY_USED);
    if (raw) usedSet = new Set(JSON.parse(raw));
  } catch(e) { usedSet = new Set(); }

  let preparedFacts = [];   // array of chosen facts for current short
  let playing = false;
  let stopRequested = false;
  let currentVoiceName = null;

  // populate voice dropdown with all voices
  function loadVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = "";
    voices.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = `${v.name} ${v.lang ? '(' + v.lang + ')' : ''}`;
      voiceSelect.appendChild(opt);
    });
    // if none available yet, add placeholder
    if (voices.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No voices available yet";
      voiceSelect.appendChild(opt);
    } else {
      // pick a reasonable default: prefer en-US or en-GB
      const preferred = voices.find(v => /en-?us/i.test(v.lang)) || voices[0];
      voiceSelect.value = preferred.name;
    }
    currentVoiceName = voiceSelect.value;
  }
  speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();

  // helpers: save used set
  function saveUsed() {
    try { localStorage.setItem(KEY_USED, JSON.stringify(Array.from(usedSet))); } catch(e){}
  }

  // pick N unique facts (global non-repeat)
  function pickUniqueFacts(n) {
    // make pool of unused indices
    const pool = [];
    for (let i=0;i<facts.length;i++) if (!usedSet.has(i)) pool.push(i);
    if (pool.length < n) {
      usedSet.clear();
      saveUsed();
      for (let i=0;i<facts.length;i++) pool.push(i);
    }
    const chosen = [];
    for (let i=0;i<n;i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const pick = pool.splice(idx,1)[0];
      chosen.push(pick);
      usedSet.add(pick);
    }
    saveUsed();
    return chosen.map(i => facts[i]);
  }

  // split text into 5-word chunks
  function chunkText(text) {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i=0;i<words.length;i+=CHUNK_WORDS) {
      chunks.push(words.slice(i, i+CHUNK_WORDS).join(" "));
    }
    return chunks;
  }

  // utility to set caption lanes with sliding animation
  // newText will slide up into view, oldText slides up/out
  // we alternate lanes A/B
  let activeLane = 'A';
  function slideCaption(newText) {
    const inLane = activeLane === 'A' ? laneA : laneB;
    const outLane = activeLane === 'A' ? laneB : laneA;

    // put new text off-screen below and visible hidden
    inLane.textContent = newText;
    inLane.classList.remove('hidden');
    // ensure outLane is visible (if any)
    outLane.classList.remove('hidden');

    // animate: set outLane to translateY(-30px) + fade out, inLane from +30 -> 0
    outLane.style.transform = 'translateY(-30px)';
    outLane.style.opacity = '0';
    inLane.style.transform = 'translateY(0)'; // reset
    inLane.style.opacity = '1';

    // after animation, hide outLane and reset transform
    setTimeout(() => {
      outLane.classList.add('hidden');
      outLane.style.transform = '';
      outLane.style.opacity = '';
    }, 350);

    // toggle active
    activeLane = activeLane === 'A' ? 'B' : 'A';
  }

  // speak an entire fact (no mid-sentence pause) and return promise resolved when TTS done
  function speakFullFact(text, voiceName) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      if (voiceName) {
        const v = speechSynthesis.getVoices().find(x => x.name === voiceName);
        if (v) u.voice = v;
      }
      // small safety handlers
      u.onend = () => resolve();
      u.onerror = () => resolve();
      // speak
      speechSynthesis.speak(u);
    });
  }

  // Play preparedFacts: video switching runs independently, TTS speaks whole fact, captions slide chunk-by-chunk
  async function playPrepared(voiceName) {
    if (!preparedFacts || preparedFacts.length === 0) return;
    playing = true;
    stopRequested = false;
    playBtn.disabled = true;
    stopBtn.disabled = false;
    generateBtn.disabled = true;
    status.textContent = "Playing...";

    // start random video switching (independent)
    let switcher = null;
    function scheduleSwitch() {
      const t = 1500 + Math.random()*1500; // 1.5s - 3s
      switcher = setTimeout(() => {
        if (stopRequested) return;
        const v = VIDEOS[Math.floor(Math.random()*VIDEOS.length)];
        videoEl.src = BASE + v;
        videoEl.play().catch(()=>{});
        scheduleSwitch();
      }, t);
    }
    // kick off with first video (random)
    videoEl.src = BASE + VIDEOS[Math.floor(Math.random()*VIDEOS.length)];
    // try random starting point when metadata loads
    videoEl.addEventListener('loadedmetadata', function setRand() {
      try {
        videoEl.currentTime = Math.random() * Math.max(0.1, (videoEl.duration || 3) - 1.0);
      } catch(e){}
      videoEl.removeEventListener('loadedmetadata', setRand);
    });
    videoEl.play().catch(()=>{});
    scheduleSwitch();

    // for each fact:
    for (let i=0;i<preparedFacts.length;i++) {
      if (stopRequested) break;
      const fact = preparedFacts[i];
      // estimate total speech duration = words * MS_PER_WORD
      const words = fact.split(/\s+/).filter(Boolean).length;
      const estMs = words * MS_PER_WORD;

      // split into chunks and compute chunk durations proportionally
      const chunks = chunkText(fact);
      const chunkWordCounts = chunks.map(c => c.split(/\s+/).filter(Boolean).length);
      const totalWords = chunkWordCounts.reduce((a,b)=>a+b,0) || words;
      const chunkDurations = chunkWordCounts.map(cnt => Math.max(200, Math.round(estMs * (cnt / totalWords)))); // min 200ms

      // start speaking the whole fact (no mid pauses)
      const ttsPromise = speakFullFact(fact, voiceName);

      // animate chunks based on estimated chunk durations
      for (let j=0;j<chunks.length;j++) {
        if (stopRequested) break;
        slideCaption(chunks[j]);
        await new Promise(res => setTimeout(res, chunkDurations[j]));
      }

      // wait for either TTS to finish or short safety (if TTS longer than est, await it)
      await Promise.race([ttsPromise, new Promise(r => setTimeout(r, estMs + 300))]);

      // small pause between facts
      await new Promise(r => setTimeout(r, 350));
    }

    // finished or stopped
    stopRequested = true;
    clearTimeout(switcher);
    videoEl.pause();
    captionTextClear();
    playing = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
    generateBtn.disabled = false;
    status.textContent = "Finished";
  }

  // clear both lanes
  function captionTextClear() {
    laneA.textContent = "";
    laneB.textContent = "";
    laneA.classList.add('hidden');
    laneB.classList.add('hidden');
  }

  // GENERATE: prepare 7 unique facts but do not auto play
  generateBtn.addEventListener('click', () => {
    try {
      preparedFacts = pickUniqueFacts(FACTS_PER_SHORT);
      captionTextClear();
      // preload a random video frame (paused)
      const v = VIDEOS[Math.floor(Math.random()*VIDEOS.length)];
      videoEl.src = BASE + v;
      videoEl.addEventListener('loadedmetadata', function one() {
        try {
          videoEl.currentTime = Math.random() * Math.max(0.1, (videoEl.duration || 3) - 1.0);
        } catch(e){}
        videoEl.pause();
        videoEl.removeEventListener('loadedmetadata', one);
      });
      status.textContent = "Short prepared — press Play to watch";
      playBtn.disabled = false;
      stopBtn.disabled = true;
    } catch (err) {
      console.error(err);
      status.textContent = "Error preparing short";
    }
  });

  // PLAY
  playBtn.addEventListener('click', async () => {
    if (!preparedFacts || preparedFacts.length === 0) {
      status.textContent = "Press Generate first";
      return;
    }
    currentVoiceName = voiceSelect.value || null;
    await playPrepared(currentVoiceName);
  });

  // STOP
  stopBtn.addEventListener('click', () => {
    stopRequested = true;
    speechSynthesis.cancel();
    videoEl.pause();
    captionTextClear();
    status.textContent = "Stopped";
    playBtn.disabled = false;
    stopBtn.disabled = true;
    generateBtn.disabled = false;
  });

  // helper: pickUniqueFacts uses global facts — ensure it exists
  if (!window.facts || !Array.isArray(facts) || facts.length === 0) {
    status.textContent = "facts.js missing or empty — add your facts array";
    generateBtn.disabled = true;
    playBtn.disabled = true;
  }

})();
