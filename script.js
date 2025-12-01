console.log("YT Shorts Generator Loaded");

const video = document.getElementById("shortVideo");
const captionText = document.getElementById("captionText");

const generateBtn = document.getElementById("generateBtn");
const playBtn = document.getElementById("playBtn");
const downloadBtn = document.getElementById("downloadBtn");
const voiceSelect = document.getElementById("voiceSelect");

if (!Array.isArray(facts) || facts.length < 7) {
  alert("facts.js not found or too small!");
  throw new Error("Missing facts");
}

const satisfyingVideos = [
  "media/slime1.mp4",
  "media/slime2.mp4",
  "media/slime3.mp4",
  "media/slime4.mp4",
  "media/soap1.mp4"
];

let chosenFacts = [];
let currentFactIndex = 0;
let speaking = false;
let fullAudioChunks = [];

// Load available voices
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = "";

  voices.forEach(v => {
    if (v.lang.startsWith("en-") && v.name.includes("Google")) {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelect.appendChild(opt);
    }
  });
}

// Random facts generator
function pickFacts() {
  chosenFacts = [];

  while (chosenFacts.length < 7) {
    const f = facts[Math.floor(Math.random() * facts.length)];
    if (!chosenFacts.includes(f)) chosenFacts.push(f);
  }
}

// Random video & start time
function loadRandomVideo() {
  video.src = satisfyingVideos[Math.floor(Math.random() * satisfyingVideos.length)];
  video.onloadedmetadata = () => {
    const maxStart = Math.max(0, video.duration - 8);
    video.currentTime = Math.random() * maxStart;
  };
  video.pause();
}

function speakFact(index) {
  return new Promise(resolve => {
    const text = chosenFacts[index];
    captionText.textContent = text;

    const msg = new SpeechSynthesisUtterance(text);
    msg.voice = speechSynthesis.getVoices().find(v => v.name === voiceSelect.value);
    msg.rate = 1.02;
    
    msg.onend = () => setTimeout(resolve, 400); // short pause after each fact

    speechSynthesis.speak(msg);
  });
}

async function playShort() {
  playBtn.disabled = true;
  downloadBtn.disabled = true;
  generateBtn.disabled = true;

  video.play();
  speaking = true;

  for (let i = 0; i < chosenFacts.length; i++) {
    currentFactIndex = i;
    await speakFact(i);
  }

  speaking = false;
  captionText.textContent = "✔ Done!";
  video.pause();

  playBtn.disabled = false;
  downloadBtn.disabled = false;
  generateBtn.disabled = false;
}

generateBtn.onclick = () => {
  pickFacts();
  currentFactIndex = 0;
  loadRandomVideo();
  captionText.textContent = "Click Play to watch!";
  playBtn.disabled = false;
  downloadBtn.disabled = true;
};

playBtn.onclick = () => {
  if (speaking) {
    speechSynthesis.cancel();
    video.pause();
    speaking = false;
    playBtn.textContent = "Play";
  } else {
    playBtn.textContent = "Pause";
    playShort();
  }
};

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();
