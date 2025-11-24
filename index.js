// index.js (Replit-ready, with CORS + node-fetch v2)
const express = require("express");
const cors = require("cors");
const expressWs = require("express-ws");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));
const crypto = require("crypto");
const app = express();

// Add WebSocket support
expressWs(app);

// Constants
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL = "eleven_multilingual_v2";

// Vital API configuration
const VITAL_API_KEY = process.env.VITAL_API_KEY || 'sk_eu_tktCIHP7kL4b-mq7f9wBcOTkvB6w3upLDaCDqshWk-8';
const VITAL_ENVIRONMENT = process.env.VITAL_ENVIRONMENT || 'sandbox';
const VITAL_REGION = process.env.VITAL_REGION || 'eu';

// Store WebSocket connections by userId
const wsConnections = new Map();

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

// API key with fallback
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY || 'dfd16d29e66b3bd218e543f42a265fe67b55ea14469abb4c79e76c7016277aef';

// Log environment status
console.log('Environment check:');
console.log('- PORT:', PORT);
console.log('- ELEVEN_API_KEY:', ELEVEN_API_KEY ? '✅ Set (length: ' + ELEVEN_API_KEY.length + ')' : '❌ NOT SET');
console.log('- VITAL_API_KEY:', VITAL_API_KEY ? '✅ Set' : '❌ NOT SET');
console.log('- VITAL_ENVIRONMENT:', VITAL_ENVIRONMENT);
console.log('- VITAL_REGION:', VITAL_REGION);
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');

// --- CORS (keep) ---
app.use(cors()); // allow all origins
app.use(express.json()); // parse JSON body
app.use(express.static('.')); // serve static files

app.get("/", (_req, res) => res.send("TTS server is running!"));
app.get("/health", (_req, res) => res.status(200).send("OK"));

// Get available voices from Eleven Labs
app.get('/voices', async (req, res) => {
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVEN_API_KEY,
        'accept': 'application/json',
      },
    });

    if (!r.ok) {
      const msg = await r.text();
      return res.status(500).json({ error: `ElevenLabs error: ${msg}` });
    }

    const voicesData = await r.json();
    res.json(voicesData);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// helper that serves a Buffer as MP3 with Range support
function sendMp3Buffer(req, res, mp3Buffer, filename = 'tts.mp3') {
  res.setHeader('Accept-Ranges', 'bytes');
  const range = req.headers.range;
  const size = mp3Buffer.length;

  if (range) {
    const [s, e] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(s, 10);
    const end = e ? parseInt(e, 10) : size - 1;
    if (isNaN(start) || isNaN(end) || start > end || end >= size) {
      res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
      return;
    }
    const chunk = mp3Buffer.slice(start, end + 1);
    res.status(206)
       .setHeader('Content-Type', 'audio/mpeg')
       .setHeader('Content-Disposition', 'inline; filename="tts.mp3"')
       .setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
       .setHeader('Content-Length', String(chunk.length))
       .end(chunk);
    return;
  }

  res.status(200)
     .setHeader('Content-Type', 'audio/mpeg')
     .setHeader('Content-Disposition', 'inline; filename="tts.mp3"')
     .setHeader('Content-Length', String(size))
     .end(mp3Buffer);
}

// ElevenLabs API function
async function elevenTTS(payload) {
  const { text, voice_id, model_id, voice_settings } = payload;
  
  const mergedVoiceSettings = {
    stability: voice_settings?.stability ?? 0.4,
    similarity_boost: voice_settings?.similarity_boost ?? 0.85,
    style: voice_settings?.style ?? 0.6,           // 0–1: higher = more expressive
    use_speaker_boost: voice_settings?.use_speaker_boost ?? true,
  };

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVEN_API_KEY,
      "accept": "audio/mpeg",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id,
      voice_settings: mergedVoiceSettings,
    }),
  });

  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`ElevenLabs error: ${msg}`);
  }

  const arrayBuffer = await r.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// GET /tts.mp3 (alias)
app.get(['/tts', '/tts.mp3'], async (req, res) => {
  try {
    const text = String(req.query.text || '');
    if (!text.trim()) return res.status(400).send('No text provided');
    const voice_id = String(req.query.voice || DEFAULT_VOICE);
    const model_id = String(req.query.model || DEFAULT_MODEL);

    const payload = {
      text,
      voice_id,
      model_id,
      voice_settings: {
        stability: Number(req.query.stability ?? 0.4),
        similarity_boost: Number(req.query.similarity ?? 0.85),
        style: Number(req.query.style ?? 0.6),
        use_speaker_boost: req.query.use_speaker_boost !== 'false',
      },
    };

    const key = cacheKey(payload);
    let mp3 = cacheGet(key);
    if (!mp3) {
      mp3 = await elevenTTS(payload);
      cacheSet(key, mp3);
    }

    sendMp3Buffer(req, res, mp3, 'tts.mp3');
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
});

// ============================================
// VITAL API ENDPOINTS
// ============================================

// Generate Vital link token
app.post('/vital/link-token', async (req, res) => {
  try {
    const { client_user_id } = req.body;
    const userId = client_user_id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('🔍 Creating Vital user. API Key:', VITAL_API_KEY ? `${VITAL_API_KEY.substring(0, 10)}...` : 'MISSING');
    console.log('🔍 Region:', VITAL_REGION, 'Environment:', VITAL_ENVIRONMENT);
    
    // First, create or get user
    // EU sandbox uses: api.sandbox.eu.tryvital.io (not api-sandbox-eu)
    let apiUrl;
    if (VITAL_REGION === 'eu') {
      apiUrl = VITAL_ENVIRONMENT === 'sandbox' 
        ? 'https://api.sandbox.eu.tryvital.io'
        : 'https://api.eu.tryvital.io';
    } else {
      apiUrl = VITAL_ENVIRONMENT === 'sandbox'
        ? 'https://api.sandbox.tryvital.io'
        : 'https://api.tryvital.io';
    }
    console.log('🔍 API URL:', apiUrl);
    const userResponse = await fetch(`${apiUrl}/v2/user`, {
      method: 'POST',
      headers: {
        'x-vital-api-key': VITAL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ client_user_id: userId })
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      console.error('❌ Vital user creation error. Status:', userResponse.status);
      console.error('❌ Response:', error);
      return res.status(500).json({ error: 'Failed to create Vital user', details: error });
    }

    const userData = await userResponse.json();
    const vitalUserId = userData.user_id;
    
    // Generate link token
    const linkResponse = await fetch(`${apiUrl}/v2/link/token`, {
      method: 'POST',
      headers: {
        'x-vital-api-key': VITAL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: vitalUserId })
    });

    if (!linkResponse.ok) {
      const error = await linkResponse.text();
      console.error('❌ Vital link token error. Status:', linkResponse.status);
      console.error('❌ Response:', error);
      return res.status(500).json({ error: 'Failed to create link token', details: error });
    }

    const linkData = await linkResponse.json();
    console.log('✅ Vital link token created for user:', vitalUserId);
    
    res.json({
      link_token: linkData.link_token,
      user_id: vitalUserId
    });
  } catch (error) {
    console.error('Vital link token error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vital webhook for real-time data
app.post('/vital/webhook', async (req, res) => {
  try {
    const webhook = req.body;
    console.log('📥 Vital webhook received:', webhook.event_type);

    // Handle different webhook types
    if (webhook.event_type === 'daily.data.activity.created' || 
        webhook.event_type === 'daily.data.workout.created') {
      const userId = webhook.user_id;
      const data = webhook.data;
      
      // Extract real-time metrics from activity/workout data
      const metrics = {
        heart_rate: data.average_hr || data.hr_avg || null,
        pace_sec_per_km: data.moving_time && data.distance 
          ? (data.moving_time / (data.distance / 1000))
          : null,
        distance_km: data.distance ? (data.distance / 1000) : null,
        elapsed_time_sec: data.active_duration || data.duration || null,
        calories: data.calories_total || data.active_calories || null,
        start_time: data.calendar_date || null
      };

      // Send to connected WebSocket client
      const ws = wsConnections.get(userId);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(metrics));
        console.log('📤 Sent metrics to client:', userId);
      } else {
        console.log('⚠️ No active WebSocket for user:', userId);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Vital webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

// ============================================
// WEBSOCKET ENDPOINT
// ============================================
app.ws('/ws', (ws, req) => {
  const userId = req.query.userId;
  
  if (!userId) {
    ws.close(1008, 'User ID required');
    return;
  }

  wsConnections.set(userId, ws);
  console.log('🔗 WebSocket connected:', userId);

  ws.on('message', (msg) => {
    console.log('📨 WebSocket message:', msg);
  });

  ws.on('close', () => {
    wsConnections.delete(userId);
    console.log('🔌 WebSocket disconnected:', userId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

app.listen(PORT, () => console.log(`✅ TTS server running on ${PORT}`));