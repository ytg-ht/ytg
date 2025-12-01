let currentFactIndex = 0;
let factInterval;

// Convert YouTube URLs to embed version
function formatYouTubeURL(url) {
    if (url.includes("watch?v=")) {
        return url.replace("watch?v=", "embed/");
    }
    return url;
}

// Change facts every 3 seconds
function startFactRotation() {
    clearInterval(factInterval);

    factInterval = setInterval(() => {
        currentFactIndex = (currentFactIndex + 1) % window.facts.length;
        document.getElementById("factText").textContent = window.facts[currentFactIndex];
    }, 3000);
}

// Load video + first fact
document.getElementById("generateBtn").addEventListener("click", () => {
    let url = document.getElementById("videoUrl").value;
    if (!url) return alert("Paste a YouTube link!");

    const formattedUrl = formatYouTubeURL(url);
    const videoFrame = document.getElementById("videoFrame");
    videoFrame.src = formattedUrl;

    currentFactIndex = 0;
    document.getElementById("factText").textContent = window.facts[currentFactIndex];

    clearInterval(factInterval);
});

// Play button starts both video and facts
document.getElementById("playBtn").addEventListener("click", () => {
    document.getElementById("videoFrame").src += "?autoplay=1";
    startFactRotation();
});
