document.getElementById("send").addEventListener("click", async () => {
  const input = document.getElementById("input").value;

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: input }]
    })
  });

  const data = await response.json();
  document.getElementById("output").textContent = data.reply;
});
