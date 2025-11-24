# Junction/Vital API Integration Setup Guide

## Overview
Your FitCoach dashboard now supports **two modes**:
- **Demo Mode** 🎬: Test with sliders (existing functionality)
- **Live Mode** 📡: Real fitness tracking from Apple Health, Garmin, Fitbit, Strava, etc.

## Prerequisites

### 1. Junction/Vital API Account
1. Sign up at https://app.junction.com (free for 100 users!)
2. Create a new team (choose region: US or EU)
3. Get your API key from Configuration → API Keys
4. Use **Sandbox** environment for testing

### 2. Install Dependencies
```bash
npm install express-ws
```

### 3. Set Environment Variables

**Option A: Environment Variables (Recommended)**
```bash
export VITAL_API_KEY="your_vital_api_key"
export VITAL_ENVIRONMENT="sandbox"  # or "production"
export VITAL_REGION="us"  # or "eu"
```

**Option B: Edit index.js directly**
Replace these lines in `index.js`:
```javascript
const VITAL_API_KEY = process.env.VITAL_API_KEY || 'YOUR_VITAL_API_KEY_HERE';
const VITAL_ENVIRONMENT = process.env.VITAL_ENVIRONMENT || 'sandbox';
const VITAL_REGION = process.env.VITAL_REGION || 'us';
```

### 4. Configure Vital Webhook

In your Vital dashboard:
1. Go to Configuration → Webhooks
2. Add webhook URL: `https://your-domain.com/vital/webhook`
3. Enable these events:
   - ✅ daily.data.activity.created
   - ✅ daily.data.workout.created

## How It Works

### Demo Mode (Default)
- Use sliders to simulate workout metrics
- Test voice prompts and coaching logic
- No device connection needed

### Live Mode
1. Click **"Switch to Live Mode"** button
2. Click **"Connect Device"** button
3. Choose your fitness tracker:
   - Apple Health (iPhone/Apple Watch)
   - Garmin Connect
   - Fitbit
   - Strava
   - Google Fit
   - Polar Flow
   - Suunto
   - And more...
4. Authorize the connection
5. Start your workout
6. Receive real-time coaching based on actual data!

## Data Flow

```
Your Device (Apple Watch, Garmin, Strava, etc.)
    ↓
Junction/Vital API (aggregates data)
    ↓
Your Backend (/vital/webhook)
    ↓
WebSocket (real-time push)
    ↓
Dashboard (live metrics & voice coaching)
```

## Supported Metrics

Junction/Vital provides:
- ✅ Heart Rate (BPM)
- ✅ Pace (min/km or min/mi)
- ✅ Distance (km or miles)
- ✅ Elapsed Time
- ✅ Calories Burned
- ✅ GPS Tracking
- ✅ Cadence
- ✅ Elevation

## Supported Providers

**Free with 100 users:**
- ✅ **Strava** (Most popular for runners!)
- ✅ **Apple HealthKit** (iPhone/Apple Watch)
- ✅ **Android Health Connect**
- ✅ **Garmin Connect**
- ✅ **Fitbit**
- ✅ **Oura**
- ✅ **Polar**
- ✅ **Wahoo**
- ✅ **Withings**
- ✅ **WHOOP**
- ✅ **Peloton**
- ✅ **Zwift**
- And 300+ more devices!

## Testing

### 1. Test Demo Mode
```bash
node index.js
# Open http://localhost:5000/dashboard.html
# Use sliders to test voice prompts
```

### 2. Test Live Mode
```bash
# Make sure Terra credentials are set
node index.js
# Open http://localhost:5000/dashboard.html
# Click "Switch to Live Mode"
# Click "Connect Device"
# Complete device authorization
# Start a real workout!
```

## Troubleshooting

### "Failed to get link token"
- Check your VITAL_API_KEY in environment variables
- Verify you're using the correct environment (sandbox vs production)
- Check API key in Junction dashboard

### "No real-time data"
- Ensure webhook URL is publicly accessible
- Check webhook logs in Junction dashboard
- Verify webhook is configured for correct events

### "WebSocket disconnected"
- Check browser console for errors
- Ensure your server supports WebSocket
- Try refreshing the page

### "Device not connecting"
- Some providers (Strava, Garmin) require app approval for production
- Use sandbox mode for testing (allows 10 test users)
- Check Junction's provider status page

## Junction/Vital Pricing

- **FREE**: 100 connected users (perfect for launch!)
- **Paid**: $99/month for 500 users (vs Terra's $499/month)
- No credit limits or usage fees
- Full access to all 300+ providers

**Why Junction/Vital is better:**
- ✅ 100 FREE users (Terra: 0 free)
- ✅ $99 for 500 users (Terra: $499 for 100k credits)
- ✅ Simple transparent pricing
- ✅ Same provider coverage as Terra
- ✅ Better documentation

## Production Deployment

### Deploy to Render/Railway/Heroku
1. Add environment variables in platform dashboard
2. Ensure public webhook URL (HTTPS required)
3. Update webhook URL in Junction dashboard
4. Test with real devices

### Security Checklist
- ✅ Use environment variables (never commit keys)
- ✅ Use HTTPS in production
- ✅ Rate limit webhook endpoint
- ✅ Implement user authentication

## Support

- Junction Documentation: https://docs.junction.com
- Vital Support: support@tryvital.io
- Slack Community: Join via Junction dashboard

## Next Steps

1. **Get Junction Account**: https://app.junction.com (FREE for 100 users!)
2. **Install Dependencies**: `npm install express-ws` ✅ (Already done)
3. **Set Environment Variables**: Add VITAL_API_KEY
4. **Configure Webhook**: Add webhook URL in Junction dashboard
5. **Test**: Start with demo mode, then try live mode
6. **Deploy**: Push to production with proper webhook URL

---

**Note**: Demo mode will continue to work without Junction setup. Live mode only activates when Junction credentials are configured.

**Cost Comparison:**
- Junction/Vital: **$0** for 100 users, then $99/month
- Terra API: **$499/month** minimum (100k credits)
- **You save $499/month by using Junction!**
