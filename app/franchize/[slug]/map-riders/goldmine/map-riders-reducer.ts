// /lib/map-riders-reducer.ts
// Single source of truth for all MapRiders state.
// Replaces 20+ useState calls with one reducer.

export type LiveRiderStatus = "live" | "stale" | "evicted";

export interface LiveRider {
  user_id: string;
  crew_slug: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number | null;
  updated_at: string; // ISO
  status: LiveRiderStatus;
  isSelf: boolean;
}

export interface ActiveSession {
  id: string;
  user_id: string;
  crew_slug: string;
  ride_name: string | null;
  vehicle_label: string | null;
  ride_mode: "rental" | "personal";
  status: "active" | "completed";
  sharing_enabled: boolean;
  started_at: string;
  latest_lat: number | null;
  latest_lon: number | null;
  latest_speed_kmh: number;
  total_distance_km: number;
  users?: { username?: string | null; full_name?: string | null; avatar_url?: string | null } | null;
}

export interface MeetupPoint {
  id: string;
  crew_slug: string;
  created_by_user_id: string;
  title: string;
  comment: string | null;
  lat: number;
  lon: number;
  scheduled_at: string | null;
  created_at: string;
  users?: { username?: string | null; full_name?: string | null } | null;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  riderName: string;
  distanceKm: number;
  sessions: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
}

export interface CompletedSession {
  id: string;
  user_id: string;
  rider_name: string;
  ride_name: string | null;
  total_distance_km: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
}

export interface CrewStats {
  activeRiders: number;
  meetupCount: number;
  totalWeeklyDistanceKm: number;
}

export interface SessionDetail {
  session: any;
  points: Array<{ lat: number; lon: number; speedKmh: number; capturedAt: string }>;
}

export interface SnapshotData {
  activeSessions: ActiveSession[];
  meetups: MeetupPoint[];
  liveLocations: Array<{
    user_id: string;
    crew_slug: string;
    lat: number;
    lng: number;
    speed_kmh: number;
    updated_at: string;
  }>;
  weeklyLeaderboard: LeaderboardRow[];
  latestCompleted: CompletedSession[];
  stats: CrewStats;
}

export interface MapRidersState {
  // Live data
  liveRiders: Map<string, LiveRider>;
  sessions: ActiveSession[];
  meetups: MeetupPoint[];

  // Derived
  leaderboard: LeaderboardRow[];
  recentCompleted: CompletedSession[];
  stats: CrewStats;

  // UI state
  selectedSessionId: string | null;
  sessionDetail: SessionDetail | null;
  selectedMeetupPoint: [number, number] | null;
  drawerOpen: boolean;

  // Sharing state
  shareEnabled: boolean;
  sessionId: string | null;
  rideName: string;
  vehicleLabel: string;
  rideMode: "rental" | "personal";

  // Meta
  isLoading: boolean;
  error: string | null;
}

export const initialMapRidersState: MapRidersState = {
  liveRiders: new Map(),
  sessions: [],
  meetups: [],
  leaderboard: [],
  recentCompleted: [],
  stats: { activeRiders: 0, meetupCount: 0, totalWeeklyDistanceKm: 0 },
  selectedSessionId: null,
  sessionDetail: null,
  selectedMeetupPoint: null,
  drawerOpen: false,
  shareEnabled: false,
  sessionId: null,
  rideName: "Вечерний выезд",
  vehicleLabel: "VIP bike",
  rideMode: "rental",
  isLoading: true,
  error: null,
};

// --- Eviction constants ---
const STALE_MS = 30_000;   // 30s → faded
const EVICT_MS = 120_000;  // 2min → removed

export type MapRidersAction =
  | { type: "snapshot/loaded"; payload: SnapshotData; selfUserId?: string }
  | { type: "rider/moved"; payload: { user_id: string; lat: number; lng: number; speed_kmh: number; heading: number | null; updated_at: string }; selfUserId?: string }
  | { type: "rider/stale"; payload: { userId: string } }
  | { type: "rider/evicted"; payload: { userId: string } }
  | { type: "eviction/tick" }
  | { type: "meetup/created"; payload: MeetupPoint }
  | { type: "session/detail-loaded"; payload: SessionDetail }
  | { type: "share/started"; payload: { sessionId: string; rideName: string; vehicleLabel: string; rideMode: "rental" | "personal" } }
  | { type: "share/stopped" }
  | { type: "ui/select-session"; payload: string | null }
  | { type: "ui/select-meetup-point"; payload: [number, number] | null }
  | { type: "ui/toggle-drawer" }
  | { type: "loading"; payload: boolean }
  | { type: "error"; payload: string | null };

export function mapRidersReducer(state: MapRidersState, action: MapRidersAction): MapRidersState {
  switch (action.type) {
    case "snapshot/loaded": {
      const { payload, selfUserId } = action;
      const nextRiders = new Map(state.liveRiders);

      // Merge live_locations into riders map
      for (const loc of payload.liveLocations || []) {
        const existing = nextRiders.get(loc.user_id);
        nextRiders.set(loc.user_id, {
          user_id: loc.user_id,
          crew_slug: loc.crew_slug,
          lat: Number(loc.lat),
          lng: Number(loc.lng),
          speed_kmh: Number(loc.speed_kmh || 0),
          heading: null,
          updated_at: loc.updated_at,
          status: "live",
          isSelf: loc.user_id === selfUserId,
        });
      }

      // Also merge from active sessions (as fallback coords)
      for (const session of payload.activeSessions || []) {
        if (typeof session.latest_lat === "number" && typeof session.latest_lon === "number") {
          if (!nextRiders.has(session.user_id)) {
            nextRiders.set(session.user_id, {
              user_id: session.user_id,
              crew_slug: session.crew_slug,
              lat: session.latest_lat,
              lng: session.latest_lon,
              speed_kmh: session.latest_speed_kmh || 0,
              heading: null,
              updated_at: session.started_at,
              status: "live",
              isSelf: session.user_id === selfUserId,
            });
          }
        }
      }

      return {
        ...state,
        liveRiders: nextRiders,
        sessions: payload.activeSessions || [],
        meetups: payload.meetups || [],
        leaderboard: payload.weeklyLeaderboard || [],
        recentCompleted: payload.latestCompleted || [],
        stats: payload.stats || state.stats,
        isLoading: false,
        error: null,
      };
    }

    case "rider/moved": {
      const { user_id, lat, lng, speed_kmh, heading, updated_at } = action.payload;
      const nextRiders = new Map(state.liveRiders);
      const existing = nextRiders.get(user_id);
      nextRiders.set(user_id, {
        ...(existing || { crew_slug: "", isSelf: user_id === action.selfUserId }),
        user_id,
        lat,
        lng,
        speed_kmh,
        heading,
        updated_at,
        status: "live",
        isSelf: user_id === action.selfUserId,
      } as LiveRider);
      return { ...state, liveRiders: nextRiders };
    }

    case "eviction/tick": {
      const now = Date.now();
      let changed = false;
      const nextRiders = new Map(state.liveRiders);

      for (const [userId, rider] of nextRiders) {
        const age = now - new Date(rider.updated_at).getTime();
        if (age > EVICT_MS) {
          nextRiders.delete(userId);
          changed = true;
        } else if (age > STALE_MS && rider.status !== "stale") {
          nextRiders.set(userId, { ...rider, status: "stale" });
          changed = true;
        }
      }
      return changed ? { ...state, liveRiders: nextRiders } : state;
    }

    case "rider/evicted": {
      const nextRiders = new Map(state.liveRiders);
      nextRiders.delete(action.payload.userId);
      return { ...state, liveRiders: nextRiders };
    }

    case "meetup/created": {
      return { ...state, meetups: [action.payload, ...state.meetups] };
    }

    case "session/detail-loaded": {
      return { ...state, sessionDetail: action.payload, selectedSessionId: action.payload.session?.id || null };
    }

    case "share/started": {
      return {
        ...state,
        shareEnabled: true,
        sessionId: action.payload.sessionId,
        rideName: action.payload.rideName,
        vehicleLabel: action.payload.vehicleLabel,
        rideMode: action.payload.rideMode,
      };
    }

    case "share/stopped": {
      return { ...state, shareEnabled: false, sessionId: null };
    }

    case "ui/select-session": {
      return { ...state, selectedSessionId: action.payload };
    }

    case "ui/select-meetup-point": {
      return { ...state, selectedMeetupPoint: action.payload };
    }

    case "ui/toggle-drawer": {
      return { ...state, drawerOpen: !state.drawerOpen };
    }

    case "loading": {
      return { ...state, isLoading: action.payload };
    }

    case "error": {
      return { ...state, error: action.payload, isLoading: false };
    }

    default:
      return state;
  }
}
