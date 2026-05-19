// YouTube key (safe if restricted)
const YT_KEY = "YOUR_YOUTUBE_KEY_HERE";

// Vercel backend URL
const GROQ_API_URL = "https://psalmsound-pwa-z5rq.vercel.app/api/chat";

// Chat history
let chatHistory = [];

// DOM elements
const aiInput = document.getElementById("aiInput");
const aiSend = document.getElementById("aiSend");
const chatBox = document.getElementById("chatBox");

// Add message to UI
function addMsg(text, sender) {
  const div = document.createElement("div");
  div.className = sender;
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

// Send message to AI
async function sendAI() {
  const text = aiInput.value.trim();
  if (!text) return;

  aiInput.value = "";
  aiSend.disabled = true;

  addMsg(text, "user");
  chatHistory.push({ role: "user", content: text });

  const thinking = addMsg("Searching the scriptures...", "ai");

  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory })
    });

    const data = await res.json();
    thinking.remove();

    const reply = data.reply || "No response available right now.";
    addMsg(reply, "ai");

    chatHistory.push({ role: "assistant", content: reply });

  } catch (err) {
    thinking.remove();
    addMsg("Error connecting to scripture assistant.", "ai");
  }

  aiSend.disabled = false;
}

// Button click
aiSend.addEventListener("click", sendAI);

// Enter key
aiInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendAI();
});
