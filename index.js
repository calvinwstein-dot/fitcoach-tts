// index.js (Replit-ready, with CORS + node-fetch v2)
const express = require("express");
const cors = require("cors");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
const app = express();

// Constants
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL = "eleven_multilingual_v2";

// Simple in-memory cache
const cache = new Map();
function cacheKey(payload) {
  return JSON.stringify(payload);
}
function cacheGet(key) {
  return cache.get(key);
}
function cacheSet(key, value) {
  cache.set(key, value);
}
const PORT = process.env.PORT || 5000;

// --- CORS (keep) ---
app.use(cors()); // allow all origins

app.get("/", (_req, res) => res.send("TTS server is running!"));

// small helper that serves a Buffer as MP3 with Range support
function sendMp3Buffer(req, res, mp3Buffer, filename = 'tts.mp3') {
  res.setHeader('Accept-Ranges', 'bytes');

  const range = req.headers.range;
  const size = mp3Buffer.length;

  if (range) {
    // bytes=start-end
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : size - 1;

    if (isNaN(start) || isNaN(end) || start >= size || end >= size || start > end) {
      res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
      return;
    }
    const chunk = mp3Buffer.slice(start, end + 1);
    res.status(206);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', String(chunk.length));
    res.end(chunk);
    return;
  }

  // full file
  res.status(200);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', String(size));
  res.end(mp3Buffer);
}

// ElevenLabs API function
async function elevenTTS(payload) {
  const { text, voice_id, model_id, voice_settings } = payload;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVEN_API_KEY,
      "accept": "audio/mpeg",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id,
      voice_settings,
    }),
  });

  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`ElevenLabs error: ${msg}`);
  }

  const arrayBuffer = await r.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---- unified GET /tts & GET /tts.mp3 ----
app.get(['/tts', '/tts.mp3'], async (req, res) => {
  try {
    const text = (req.query.text || '').toString();
    if (!text.trim()) return res.status(400).send('No text provided');

    const voice_id = (req.query.voice || DEFAULT_VOICE).toString();
    const model_id = (req.query.model || DEFAULT_MODEL).toString();

    const payload = {
      text,
      model_id,
      voice_settings: {
        stability: Number(req.query.stability ?? 0.4),
        similarity_boost: Number(req.query.similarity ?? 0.85),
      },
    };

    const key = cacheKey(payload);
    let mp3 = cacheGet(key);
    if (!mp3) {
      mp3 = await elevenTTS(payload);   // your existing function
      cacheSet(key, mp3);
    }

    // NOTE filename hint helps some browsers
    sendMp3Buffer(req, res, mp3, 'tts.mp3');
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

app.listen(PORT, () => console.log(`✅ TTS server running on ${PORT}`));