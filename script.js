console.log("YT Short generator loaded");

const videoElement = document.getElementById("bgVideo");
const captionText = document.getElementById("captionText");
const generateBtn = document.getElementById("generateBtn");
const voiceSelect = document.getElementById("voiceSelect");

let usedFacts = new Set();
let voices = [];

const videos = [
  "media/slime1.mp4",
  "media/slime2.mp4",
  "media/slime3.mp4",
  "media/slime4.mp4",
  "media/soap1.mp4"
];

// Load voices when available
speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

// Pick a unused random fact
function getUniqueFact() {
  if (usedFacts.size >= facts.length) usedFacts.clear();

  let fact;
  do {
    fact = facts[Math.floor(Math.random() * facts.length)];
  } while (usedFacts.has(fact));

  usedFacts.add(fact);
  return fact;
}

// Split captions into chunks of 5 words
function chunkText(text) {
  const words = text.split(" ");
  const result = [];
  for (let i = 0; i < words.length; i += 5) {
    result.push(words.slice(i, i + 5).join(" "));
  }
  return result;
}

// Speak synced to captions
async function speakFact(fact) {
  let chunks = chunkText(fact);

  for (const piece of chunks) {
    captionText.textContent = piece;
    let msg = new SpeechSynthesisUtterance(piece);
    msg.voice = voices.find(v => v.name === voiceSelect.value);
    msg.rate = 1;

    speechSynthesis.speak(msg);

    await new Promise(res => {
      msg.onend = res;
    });
  }
}

async function generateShort() {
  // Random video selection + random start time
  const videoPath = videos[Math.floor(Math.random() * videos.length)];
  videoElement.src = videoPath;
  videoElement.onloadedmetadata = () => {
    const randomTime = Math.random() * (videoElement.duration - 10);
    videoElement.currentTime = Math.max(0, randomTime);
    videoElement.play();
  };

  // Speak 7 unique facts
  for (let i = 0; i < 7; i++) {
    let fact = getUniqueFact();
    await speakFact(fact);
  }

  captionText.textContent = "Done!";
}

generateBtn.onclick = () => {
  speechSynthesis.cancel();
  generateShort();
};
