import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Healthcheck
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Chat-Endpoint
app.post("/api/chat", async (req, res) => {
  const msg = (req.body?.message || "").toString().trim();

  if (!msg) {
    return res.status(400).json({ reply: "Bitte gib eine Nachricht ein." });
  }
  if (!process.env.OPENAI_API_KEY || !process.env.ASSISTANT_ID) {
    return res.status(500).json({ reply: "API-Key oder Assistant-ID fehlt." });
  }

  try {
    // Assistants v2: Thread erstellen
    const threadResp = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: msg }]
      })
    });
    const threadData = await threadResp.json();
    if (!threadData.id) {
      console.error("Thread-Fehler:", threadData);
      return res.status(500).json({ reply: "Thread konnte nicht erstellt werden." });
    }

    // Assistant starten
    const runResp = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/runs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({ assistant_id: process.env.ASSISTANT_ID })
    });
    const runData = await runResp.json();
    if (!runData.id) {
      console.error("Run-Fehler:", runData);
      return res.status(500).json({ reply: "Assistant konnte nicht gestartet werden." });
    }

    // Polling auf Antwort (max. 15 Sekunden)
    let result = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const msgResp = await fetch(`https://api.openai.com/v1/threads/${threadData.id}/messages`, {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "assistants=v2"
        }
      });
      const msgData = await msgResp.json();
      const last = msgData?.data?.find(m => m.role === "assistant" && m?.content?.[0]?.text?.value);
      if (last) {
        result = last.content[0].text.value;
        break;
      }
    }

    if (!result) result = "Ich konnte gerade keine Antwort erzeugen. Versuch es bitte erneut.";
    res.json({ reply: result });
  } catch (err) {
    console.error("Serverfehler:", err);
    res.status(500).json({ reply: "Serverfehler: " + (err?.message || String(err)) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
