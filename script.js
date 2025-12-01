console.log("Short Generator Loaded ✔");

// Elements
const video = document.getElementById("bgVideo");
const captionText = document.getElementById("captionText");
const bgMusic = document.getElementById("bgMusic");
const generateBtn = document.getElementById("generateBtn");
const playBtn = document.getElementById("playBtn");
const voiceSelect = document.getElementById("voiceSelect");

// Your videos
const videos = [
  "media/slime1.mp4",
  "media/slime2.mp4",
  "media/slime3.mp4",
  "media/slime4.mp4",
  "media/soap1.mp4"
];

if (!window.facts || window.facts.length < 7) {
  alert("⚠ facts.js missing or too short!");
  throw new Error("facts not found");
}

let shortFacts = [];
let currentFact = 0;
let currentVideo = 0;
let playing = false;

// Populate voices after load
speechSynthesis.onvoiceschanged = () => {
  voiceSelect.innerHTML = "";
  speechSynthesis.getVoices().forEach(v => {
    if (v.lang.startsWith("en")) {
      let opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = v.name;
      voiceSelect.appendChild(opt);
    }
  });
};

// Split caption into bigger chunks (7 words)
function chunkText(text, size = 7) {
  const words = text.split(" ");
  const out = [];
  for (let i = 0; i < words.length; i += size) {
    out.push(words.slice(i, i + size).join(" "));
  }
  return out;
}

// Generate new short
generateBtn.onclick = () => {
  shortFacts = [];
  const used = new Set();
  while (shortFacts.length < 7) {
    const i = Math.floor(Math.random() * facts.length);
    if (!used.has(i)) {
      used.add(i);
      shortFacts.push(chunkText(facts[i]));
    }
  }
  currentFact = 0;
  currentVideo = 0;
  captionText.textContent = "Ready!";
  playBtn.disabled = false;
};

// Play generated short
playBtn.onclick = () => {
  if (!shortFacts.length) return;
  playing = true;
  currentFact = 0;
  currentVideo = 0;
  bgMusic.src = "media/music.mp3"; // You add this file
  bgMusic.play();
  playNext();
};

// Show next fact + switch video
function playNext() {
  if (!playing || currentFact >= shortFacts.length) {
    playing = false;
    bgMusic.pause();
    return;
  }

  const captionParts = shortFacts[currentFact];
  let partIndex = 0;

  // Switch video smoothly
  video.style.opacity = 0;
  setTimeout(() => {
    currentVideo = (currentVideo + 1) % videos.length;
    video.src = videos[currentVideo];
    video.play();
    video.style.opacity = 1;
  }, 200);

  // Show next chunk of words every 2 seconds
  const interval = setInterval(() => {
    captionText.textContent = captionParts[partIndex];
    partIndex++;

    if (partIndex >= captionParts.length) {
      clearInterval(interval);
      currentFact++;
      setTimeout(playNext, 2000);
    }

  }, 2000);
}
