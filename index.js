// index.js (Replit-ready)
const express = require("express");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
const app = express();
const PORT = process.env.PORT || 5000;

// --- CORS for browser clients (Flutter web) ---
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, xi-api-key");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.get("/", (_req, res) => res.send("TTS server is running!"));

app.get("/tts", async (req, res) => {
  try {
    const text = (req.query.text || "").toString();
    if (!text.trim()) return res.status(400).send("No text provided");

    const voiceId = req.query.voice || "21m00Tcm4TlvDq8ikWAM"; // default voice

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVEN_API_KEY,
        "accept": "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.85 },
      }),
    });

    if (!r.ok) {
      const msg = await r.text();
      return res.status(500).send(`ElevenLabs error: ${msg}`);
    }

    res.setHeader("Content-Type", "audio/mpeg");
    r.body.pipe(res);

  } catch (e) {
    res.status(500).send(String(e));
  }
});

app.listen(PORT, () => console.log(`✅ TTS server running on ${PORT}`));