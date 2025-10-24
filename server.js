import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = (req.body?.message || "").toString().slice(0, 2000);

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Du bist der offizielle Chatbot 'VitalFusionHub Experte'. Antworte freundlich, klar und neutral zu VitalCheck, Basisversorgung, Supplements & zur App. Nenne keine Marken, vermeide Gesundheitsversprechen.",
          },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("OpenAI error:", data);
      return res
        .status(400)
        .json({ reply: "Fehler bei der Anfrage an OpenAI." });
    }

    const reply =
      data.choices?.[0]?.message?.content ||
      "Ich konnte gerade keine Antwort erzeugen.";
    res.json({ reply });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ reply: "Serverfehler. Bitte später erneut." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});
