// preview.js (runs inside preview.html)
const satisfyVideo = document.getElementById('satisfyVideo');
const captionText = document.getElementById('captionText');

let playlist = [];
let settings = {};
let bgMusic = null;
let ttsVoice = null;

function postToOpener(msg){
  if (window.opener && !window.opener.closed) window.opener.postMessage(msg, '*');
}

window.addEventListener('load', () => {
  postToOpener({ type: 'popup-ready' });
});

// receive playlist from opener
window.addEventListener('message', (ev) => {
  const d = ev.data || {};
  if (d.type === 'load-playlist') {
    playlist = d.playlist || [];
    settings = d.settings || {};
    // prepare video source list and music
    if (settings.bgMusicUrl) {
      bgMusic = new Audio(settings.bgMusicUrl);
      bgMusic.loop = true;
      bgMusic.volume = 0.45;
      bgMusic.crossOrigin = "anonymous";
    }
    // attempt to load voices
    loadVoices();
  } else if (d.type === 'start-playback') {
    if (playlist && playlist.length) {
      playAllFacts(playlist, settings).then(()=> {
        postToOpener({ type: 'playback-done' });
      });
    }
  }
});

function loadVoices(){
  const load = () => {
    const vs = speechSynthesis.getVoices() || [];
    ttsVoice = vs.find(v => /Google UK.*Male/i.test(v.name))
             || vs.find(v => /Google UK.*Female/i.test(v.name))
             || vs.find(v => /Google UK/i.test(v.name))
             || vs.find(v => v.lang && v.lang.startsWith('en-GB'))
             || vs[0] || null;
  };
  load();
  speechSynthesis.onvoiceschanged = load;
}

// split fact into small caption chunks (approx 6 words)
function splitChunks(text, size=6){
  const words = text.trim().split(/\s+/);
  const out = [];
  for (let i=0;i<words.length;i+=size) out.push(words.slice(i,i+size).join(' '));
  return out;
}

// display a caption chunk with fade transition
function showCaption(text){
  captionText.classList.remove('in','out');
  captionText.classList.add('out');
  // small delay for fade out
  setTimeout(()=> {
    captionText.textContent = text;
    captionText.classList.remove('out');
    captionText.classList.add('in');
  }, 40);
}

// play one fact: speak whole fact and sync caption chunk changes
function playFactText(fact, opts = {}) {
  return new Promise(async (resolve) => {
    // set video to a random satisfying clip for this fact
    if (opts.videoList && opts.videoList.length) {
      const v = opts.videoList[Math.floor(Math.random() * opts.videoList.length)];
      satisfyVideo.src = v;
      try { await satisfyVideo.play(); } catch(e){}
    }
    // prepare caption chunks
    const chunks = splitChunks(fact, opts.captionWords || 6);
    // ensure initial caption shown
    showCaption(chunks[0] || fact);

    // start background music (if present)
    if (bgMusic) {
      try { await bgMusic.play(); } catch(e){}
    }

    // create utterance for whole fact
    const utt = new SpeechSynthesisUtterance(fact);
    if (ttsVoice) utt.voice = ttsVoice;
    utt.rate = opts.ttsRate || 1.3;
    utt.pitch = 1.0;

    // if onboundary exists, we'll use it to sync chunk changes based on charIndex/word events
    let usedBoundary = false;
    const charIndices = []; // chunk start char indices
    let acc = 0;
    for (const c of chunks) { charIndices.push(acc); acc += c.length + 1; } // approximate char index positions

    // onboundary handler (fires with event.charIndex when available)
    utt.onboundary = (ev) => {
      // many browsers emit 'word' boundaries with charIndex
      if (!ev.charIndex && ev.charIndex !== 0) return;
      usedBoundary = true;
      // pick chunk index where charIndex >= chunkStart && < nextStart
      for (let i = 0; i < charIndices.length; i++) {
        const start = charIndices[i];
        const end = (i+1 < charIndices.length) ? charIndices[i+1] : Infinity;
        if (ev.charIndex >= start && ev.charIndex < end) {
          // display that chunk
          showCaption(chunks[i]);
          break;
        }
      }
    };

    // fallback: estimate timing if onboundary doesn't fire
    let fallbackTimerHandles = [];
    let fallbackStarted = false;
    const startTime = performance.now();
    utt.onstart = () => {
      // if onboundary doesn't trigger quickly, schedule fallback timed updates
      setTimeout(()=> {
        if (usedBoundary) return; // boundary works
        fallbackStarted = true;
        // estimate utterance duration by using average words/sec.
        const words = fact.trim().split(/\s+/).length;
        // estimate words per second ~ 4.8 at rate 1.0, scale by utt.rate
        const wps = 4.8 * (utt.rate || 1.0);
        const estDur = Math.max(0.5, words / wps) * 1000; // ms
        // divide estimated duration among chunks (but keep 0.7s gap AFTER utterance will be enforced by caller)
        const per = Math.max(150, Math.floor(estDur / Math.max(1, chunks.length)));
        // schedule chunk changes
        for (let i = 0; i < chunks.length; i++) {
          const t = i * per;
          const h = setTimeout(()=> showCaption(chunks[i]), t);
          fallbackTimerHandles.push(h);
        }
      }, 120); // wait 120ms to see if boundary appears
    };

    utt.onend = () => {
      // clear fallback timers
      fallbackTimerHandles.forEach(h=>clearTimeout(h));
      // ensure last chunk visible
      showCaption(chunks[chunks.length-1] || fact);
      // small pause (we will resolve after extra gap by caller)
      resolve();
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

// play all facts sequentially; keep 0.7s gap after each fact
async function playAllFacts(list, opts = {}) {
  for (let i = 0; i < list.length; i++) {
    const fact = list[i];
    await playFactText(fact, opts);
    // wait 700ms gap (interFact gap)
    await new Promise(r => setTimeout(r, opts.interChunkGap || 700));
  }
  // stop music and video after done
  if (bgMusic) try { bgMusic.pause(); bgMusic.currentTime = 0; } catch(e){}
  try { satisfyVideo.pause(); satisfyVideo.currentTime = 0; } catch(e){}
}
