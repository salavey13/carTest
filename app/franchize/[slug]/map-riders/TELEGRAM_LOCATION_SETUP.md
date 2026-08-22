# Telegram Location Integration - The Vibey Way 🏍️

Complete guide for extracting location from Telegram users in MapRiders.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCATION SOURCES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Mini App Geolocation (Primary)                              │
│     ├── Most accurate (GPS + WiFi + Cell)                       │
│     ├── Works while app is open                                 │
│     └── Updates every 3s / 15m movement                         │
│                                                                  │
│  2. Telegram Bot Live Location (Fallback)                       │
│     ├── Works when Mini App closed                              │
│     ├── User shares via attachment button                       │
│     └── 15min / 1hr / 8hr duration options                      │
│                                                                  │
│  3. Manual Bot Commands                                         │
│     ├── /location - One-time share                             │
│     ├── /live - Instructions for live sharing                  │
│     └── /stop - End sharing session                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     WEBHOOK HANDLER                              │
│              /api/telegram/webhook/route.ts                      │
├─────────────────────────────────────────────────────────────────┤
│  • Receives all Telegram updates                                 │
│  • Processes location messages                                   │
│  • Handles live location edits                                   │
│  • Sends responses via Bot API                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE REALTIME                            │
├─────────────────────────────────────────────────────────────────┤
│  • Broadcast to all connected riders                             │
│  • Upsert to live_locations table                                │
│  • Update map_rider_sessions                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather)
2. Create new bot: `/newbot`
3. Set name and username
4. **Save the token!**

### 2. Configure Environment Variables

```bash
# .env.local
TELEGRAM_BOT_TOKEN=your_bot_token_here
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
```

### 3. Set Webhook URL

```bash
# Replace with your actual domain
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/api/telegram/webhook"}'
```

**Verify webhook is set:**
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### 4. Test Webhook

```bash
# Send a test request
curl -X POST "https://yourdomain.com/api/telegram/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {"id": 123456, "is_bot": false, "first_name": "Test"},
      "chat": {"id": 123456, "type": "private"},
      "date": 1234567890,
      "text": "/start"
    }
  }'
```

## Usage in Components

### Basic Usage (Mini App Only)

```tsx
import { useVibeyLocation } from "@/hooks/useVibeyLocation";

function MapRidersClient({ crewSlug, userId }) {
  const {
    currentLocation,
    isTracking,
    startTracking,
    stopTracking,
    stats,
  } = useVibeyLocation({
    crewSlug,
    userId,
    enabled: false, // Don't auto-start
    onLocationUpdate: (loc) => {
      console.log("New location:", loc);
    },
  });

  return (
    <div>
      <button onClick={startTracking} disabled={isTracking}>
        🏍️ Start Ride
      </button>
      <button onClick={stopTracking} disabled={!isTracking}>
        ⏹️ Stop Ride
      </button>
      
      {currentLocation && (
        <div>
          📍 {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          <br />
          🚀 {stats.avgSpeed} km/h avg
          <br />
          📏 {(stats.distanceTraveled / 1000).toFixed(2)} km
        </div>
      )}
    </div>
  );
}
```

### Advanced Usage (With Bot Fallback)

```tsx
import { useVibeyLocation } from "@/hooks/useVibeyLocation";

function MapRidersClient({ crewSlug, userId }) {
  const {
    currentLocation,
    isTracking,
    startTracking,
    stopTracking,
    requestBotLocation,
    startBotLiveLocation,
    stopBotLiveLocation,
    stats,
    accuracy,
  } = useVibeyLocation({
    crewSlug,
    userId,
    enabled: false,
    onBatchSend: (locations) => {
      // Send batch to your API
      fetch("/api/map-riders/batch-points", {
        method: "POST",
        body: JSON.stringify({ sessionId, userId, crewSlug, points: locations }),
      });
    },
  });

  return (
    <div>
      {/* Primary: Mini App GPS */}
      <button onClick={startTracking} disabled={isTracking}>
        🏍️ Start Ride (App)
      </button>
      
      {/* Fallback: Bot Live Location */}
      <button onClick={startBotLiveLocation}>
        📱 Share via Telegram
      </button>
      
      {/* One-time location */}
      <button onClick={requestBotLocation}>
        📍 Send Location Once
      </button>
      
      {/* Status */}
      {accuracy && (
        <div>
          GPS Accuracy: {" "}
          {accuracy === "high" ? "🟢 Excellent" : 
           accuracy === "medium" ? "🟡 Good" : "🔴 Poor"}
        </div>
      )}
    </div>
  );
}
```

## Bot Commands

Users can interact with the bot directly:

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + command list |
| `/location` | Request one-time location share |
| `/live` | Instructions for live location sharing |
| `/stop` | Stop sharing + complete session |
| `/status` | Check current ride status |

## How Live Location Works

### User Flow (Bot)

1. User taps attachment button (📎) in Telegram
2. Selects "Location"
3. Chooses "Share My Live Location"
4. Selects duration (15min / 1hr / 8hr)
5. Bot receives location updates every few seconds
6. Updates are broadcast to all riders in the crew

### Technical Flow

```
User shares live location
        │
        ▼
┌───────────────────┐
│ Telegram Servers  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Your Webhook URL  │
│ /api/telegram/    │
│     webhook       │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Process Location  │
│ • Upsert live_    │
│   locations       │
│ • Update session  │
│ • Broadcast to    │
│   crew channel    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ All Connected     │
│ Riders See Update │
│ Instantly!        │
└───────────────────┘
```

## Receiving Bot Updates in Mini App

```tsx
import { useBotLocationUpdates } from "@/hooks/useVibeyLocation";

function MapComponent({ crewSlug }) {
  useBotLocationUpdates(crewSlug, (location) => {
    // This is called when someone shares location via bot
    console.log("Bot location update:", location);
    // Update your map markers here
  });

  return <Map />;
}
```

## Testing

### Test Mini App Location

1. Open MapRiders in Telegram
2. Tap "Start Ride"
3. Allow location permission
4. Move around (or use browser dev tools to simulate)

### Test Bot Location

1. Message your bot: `/location`
2. Tap the button to share location
3. Check webhook logs
4. Verify location appears in database

### Test Live Location

1. Message your bot: `/live`
2. Follow instructions to share live location
3. Move around with Telegram open
4. Watch updates flow in real-time

## Troubleshooting

### Webhook not receiving updates

```bash
# Check webhook status
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Common issues:
# - HTTPS required (no HTTP)
# - Self-signed certificates not accepted in production
# - Webhook must return 200 OK quickly (< 30s)
```

### Location not saving

1. Check Supabase RLS policies on `live_locations`
2. Verify `user_id` format matches (we use `tg_<telegram_id>`)
3. Check server logs for errors

### Broadcast not working

1. Verify Supabase Realtime is enabled
2. Check channel name matches (`map:${crewSlug}`)
3. Ensure client is subscribed before broadcast

## Security Considerations

1. **Validate webhook secret** (optional but recommended):
   ```ts
   // Add to webhook handler
   const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
   if (secret !== process.env.WEBHOOK_SECRET) {
     return new Response("Unauthorized", { status: 401 });
   }
   ```

2. **Rate limiting**: Bot can receive many updates during live location

3. **User verification**: Map Telegram ID to your user system

## Advanced: Background Tracking

For true background tracking (even when Mini App is closed):

1. User starts ride in Mini App
2. Prompt to also enable bot live location
3. Both sources update the same `live_locations` row
4. When Mini App reopens, sync with latest data

```tsx
// In your component
useEffect(() => {
  // When component mounts, fetch latest location from DB
  const syncLocation = async () => {
    const { data } = await supabase
      .from("live_locations")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    if (data) {
      setCurrentLocation({
        latitude: data.lat,
        longitude: data.lng,
        timestamp: new Date(data.updated_at).getTime(),
        source: "sync",
      });
    }
  };
  
  syncLocation();
}, [userId]);
```

## Summary

| Feature | Mini App GPS | Bot Live Location |
|---------|-------------|-------------------|
| Accuracy | ⭐⭐⭐ Excellent | ⭐⭐ Good |
| Battery Usage | Medium | Low |
| Works Closed | ❌ No | ✅ Yes |
| Update Frequency | 3s / 15m | ~5s (Telegram controlled) |
| Setup Complexity | Simple | Requires webhook |
| Best For | Active riding | Background tracking |

**Recommendation**: Use both! Mini App for primary tracking, Bot as fallback when app is closed.
