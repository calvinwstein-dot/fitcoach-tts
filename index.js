// index.js — FitCoach TTS server (Replit)
// Node 18+, node-fetch v2, express

const express = require("express");
const fetch = require("node-fetch"); // v2 on Replit
const morgan = require("morgan");
const cors = require("cors");

const ELEVEN_API_KEY = "dfd16d29e66b3bd218e543f42a265fe67b55ea14469abb4c79e76c7016277aef";

const DEFAULT_VOICE = process.env.DEFAULT_VOICE || "21m00Tcm4TlvDq8ikWAM"; // change if you like
const DEFAULT_MODEL = process.env.MODEL_ID || "eleven_multilingual_v2";     // stable, natural
const PORT = process.env.PORT || 5000;

const app = express();

// Logging + JSON body support + CORS
app.use(morgan("tiny"));
app.use(express.json({ limit: "1mb" }));
app.use(cors()); // allow all origins by default

// Simple health root
app.get("/", (_req, res) => res.send("TTS server is running!"));

app.get('/3d44', (_req, res) => {
  const k = ELEVEN_API_KEY;
  res.send(`3d44: ${k.slice(-4)}`);
});

// ------------- In-memory LRU-ish cache to save credits ----------------
const CACHE_MAX = 150;              // ~150 clips
const cache = new Map();            // key -> Buffer

function cacheKey(payload) {
  // cache based on text + voice + model + basic voice settings
  const { text, voice_id, model_id, voice_settings } = payload;
  return JSON.stringify({ text, voice_id, model_id, voice_settings });
}
function cacheGet(key) {
  if (!cache.has(key)) return null;
  const buf = cache.get(key);
  // bump to end (recently used)
  cache.delete(key);
  cache.set(key, buf);
  return buf;
}
function cacheSet(key, buf) {
  cache.set(key, buf);
  if (cache.size > CACHE_MAX) {
    // delete oldest
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

// ------------- Helper: call ElevenLabs and return Buffer --------------
async function elevenTTS(payload) {
  if (!ELEVEN_API_KEY) {
    throw new Error("ELEVEN_API_KEY not configured on server.");
  }

  const { voice_id } = payload;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVEN_API_KEY,
      accept: "audio/mpeg",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text: payload.text,
      model_id: payload.model_id || DEFAULT_MODEL,
      voice_settings: payload.voice_settings || { stability: 0.4, similarity_boost: 0.85 },
    }),
  });

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`ElevenLabs error (${r.status}): ${msg}`);
  }

  // Turn the stream into a Buffer so we can cache & set inline headers
  const chunks = [];
  for await (const chunk of r.body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// --------------------- GET /tts (simple) ------------------------------
app.get("/tts", async (req, res) => {
  try {
    const text = (req.query.text || "").toString();
    if (!text.trim()) return res.status(400).send("No text provided");

    const voice_id = (req.query.voice || DEFAULT_VOICE).toString();
    const model_id = (req.query.model || DEFAULT_MODEL).toString();

    const payload = {
      text,
      voice_id,
      model_id,
      voice_settings: {
        stability: Number(req.query.stability ?? 0.4),
        similarity_boost: Number(req.query.similarity ?? 0.85),
      },
    };

    const key = cacheKey(payload);
    let mp3 = cacheGet(key);
    if (!mp3) {
      mp3 = await elevenTTS(payload);
      cacheSet(key, mp3);
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'inline; filename="tts.mp3"');
    res.send(mp3);
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

// --------------------- POST /tts (advanced) ---------------------------
// JSON body: { text, voice_id?, model_id?, voice_settings? }
app.post("/tts", async (req, res) => {
  try {
    const text = (req.body?.text || "").toString();
    if (!text.trim()) return res.status(400).send("No text provided");

    const payload = {
      text,
      voice_id: (req.body.voice_id || DEFAULT_VOICE).toString(),
      model_id: (req.body.model_id || DEFAULT_MODEL).toString(),
      voice_settings: req.body.voice_settings || { stability: 0.4, similarity_boost: 0.85 },
    };

    const key = cacheKey(payload);
    let mp3 = cacheGet(key);
    if (!mp3) {
      mp3 = await elevenTTS(payload);
      cacheSet(key, mp3);
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'inline; filename="tts.mp3"');
    res.send(mp3);
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

// --------------------- GET /voices (optional) -------------------------
// Lists your available voices from ElevenLabs so you can build a picker
app.get("/voices", async (_req, res) => {
  try {
    if (!ELEVEN_API_KEY) throw new Error("Missing ELEVEN_API_KEY");
    const r = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": ELEVEN_API_KEY, accept: "application/json" },
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      throw new Error(`Voices error (${r.status}): ${msg}`);
    }
    const json = await r.json();
    // return a small subset: id + name
    const minimal = (json.voices || []).map(v => ({ id: v.voice_id || v.voice_id || v.id, name: v.name }));
    res.json(minimal);
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

// --------------------- GET /tts/stream --------------------------------
// Streaming TTS endpoint
app.get("/tts/stream", async (req, res) => {
  try {
    const text = (req.query.text || "").toString();
    if (!text.trim()) return res.status(400).send("No text provided");

    const voice_id = (req.query.voice_id || DEFAULT_VOICE).toString();
    const model_id = (req.query.model_id || DEFAULT_MODEL).toString();

    if (!ELEVEN_API_KEY) throw new Error("ELEVEN_API_KEY not configured on server.");

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        accept: "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        model_id: model_id,
        voice_settings: {
          stability: parseFloat(req.query.stability) || 0.4,
          similarity_boost: parseFloat(req.query.similarity_boost) || 0.85
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`ElevenLabs streaming error (${response.status}): ${errorText}`);
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");

    // Stream the response directly to the client
    response.body.pipe(res);

  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

// --------------------- Start server -----------------------------------
app.listen(PORT, () => {
  console.log(`✅ TTS server running on ${PORT}`);
});app.get('/key-tail', (_req, res) => {
  const k = (process.env.ELEVEN_API_KEY || '');
  res.send(`Active key tail: ${k.slice(-4)}`);
});