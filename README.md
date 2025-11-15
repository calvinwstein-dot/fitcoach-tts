# FitCoach TTS

> A lightweight Node.js server that proxies ElevenLabs text-to-speech to provide a simple TTS endpoint for the FitCoach app.

Features
- Simple `/tts` endpoint that returns MP3 audio (supports HTTP Range requests)
- `/voices` endpoint that fetches voices from ElevenLabs
- In-memory caching for repeated requests
- CORS enabled for easy browser use

Prerequisites
- Node.js 18+ (or compatible LTS)
- An ElevenLabs API key in `ELEVEN_API_KEY`

Getting started

1. Install dependencies

```powershell
npm install
```

2. Set your environment variable (Windows PowerShell example)

```powershell
$env:ELEVEN_API_KEY = "your_api_key_here"
```

3. Start the server

```powershell
npm start
```

Usage

- Health: `GET /` → returns a simple string
- Voices: `GET /voices` → returns available ElevenLabs voices
- TTS: `GET /tts?text=Hello+world` → returns `audio/mpeg` MP3

Example curl

```bash
curl "http://localhost:5000/tts?text=Hello%20FitCoach"
```

Environment
- `ELEVEN_API_KEY` (required): your ElevenLabs API key
- `PORT` (optional): port to run the server on (default `5000`)

Deployment (Render / Railway)
- Create a GitHub repo and push your project.
- On Render (recommended): create a new Web Service, connect to the repo, set the build command to `npm install` and start command to `npm start`.
- In the Render/Railway dashboard add the environment variable `ELEVEN_API_KEY` (do NOT commit it to GitHub).
- After deployment you'll get a public URL (e.g. `https://your-app.onrender.com/dashboard.html`).

Security
- Keep your `ELEVEN_API_KEY` secret. Use the platform's environment variable settings and include `.env` in `.gitignore`. A sample `.env.example` is included.

Notes
- This project intentionally keeps a minimal in-memory cache. For production use, replace with a persistent cache or object storage.
- The server uses CORS open by default to facilitate development; restrict origins in production.

License
MIT
