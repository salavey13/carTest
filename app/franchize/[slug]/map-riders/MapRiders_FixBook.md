# MapRiders FixBook v1.0
## Comprehensive Code Review & Actionable Roadmap

---

## Executive Summary

The refactoring from the 750-line "monster" component into modular architecture is impressive and follows solid patterns. However, several critical issues prevent full functionality, most notably **mobile long-tap meetup creation is completely broken**. This document catalogs all findings and provides an ordered roadmap of fixes.

### Status Overview
| Category | Status | Count |
|----------|--------|-------|
| 🔴 Critical | Broken/Blocking | 5 |
| 🟠 High Priority | Missing/Incomplete | 7 (1 resolved) |
| 🟡 Medium Priority | Quality/Performance | 5 |
| 🟢 Low Priority | Nice to Have | 4 |
| **Total** | | **21** (1 verified) |

---

## 🔴 CRITICAL ISSUES (Fix First)

### CRIT-1: Mobile Long-Tap Meetup Creation Broken

**Problem:**
On mobile, long-tap (press-and-hold) should create a meetup point, but nothing happens. The map only responds to single clicks which don't work reliably on touch devices.

**Root Cause:**
In `/components/maps/RacingMap.tsx`, the `MapClickCapture` component only listens to `click` events:

```tsx
// CURRENT - BROKEN ON MOBILE
function MapClickCapture({ onMapClick }: { onMapClick?: (coords: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onMapClick?.([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}
```

Mobile browsers translate long-press to `contextmenu` event, not `click`. Additionally, there's no touch duration detection to distinguish between tap (pan/zoom) and long-tap (create meetup).

**Fix:**

```tsx
// FIXED VERSION
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMap, useMapEvents } from "react-leaflet";

interface MapInteractionCaptureProps {
  onMapClick?: (coords: [number, number]) => void;
  onMapLongPress?: (coords: [number, number]) => void;
  longPressDelay?: number;
}

export function MapInteractionCapture({
  onMapClick,
  onMapLongPress,
  longPressDelay = 500,
}: MapInteractionCaptureProps) {
  const map = useMap();
  const touchStartRef = useRef<{
    time: number;
    latlng: { lat: number; lng: number };
    timeoutId: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  // Clear long-press timeout
  const clearLongPress = useCallback(() => {
    if (touchStartRef.current?.timeoutId) {
      clearTimeout(touchStartRef.current.timeoutId);
      touchStartRef.current.timeoutId = null;
    }
  }, []);

  // Handle contextmenu (native long-press on mobile)
  const handleContextMenu = useCallback(
    (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      onMapLongPress?.([e.latlng.lat, e.latlng.lng]);
    },
    [onMapLongPress]
  );

  // Touch start - begin long-press timer
  const handleTouchStart = useCallback(
    (e: L.LeafletMouseEvent) => {
      touchStartRef.current = {
        time: Date.now(),
        latlng: { lat: e.latlng.lat, lng: e.latlng.lng },
        timeoutId: setTimeout(() => {
          // Long-press triggered
          onMapLongPress?.([e.latlng.lat, e.latlng.lng]);
        }, longPressDelay),
      };
    },
    [onMapLongPress, longPressDelay]
  );

  // Touch end - check if it was a tap vs long-press
  const handleTouchEnd = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (!touchStartRef.current) return;
      
      const duration = Date.now() - touchStartRef.current.time;
      clearLongPress();

      // Short tap - trigger click
      if (duration < 200) {
        onMapClick?.([e.latlng.lat, e.latlng.lng]);
      }

      touchStartRef.current = null;
    },
    [onMapClick, clearLongPress]
  );

  // Cancel on move
  const handleTouchMove = useCallback(() => {
    clearLongPress();
    touchStartRef.current = null;
  }, [clearLongPress]);

  // Register events
  useEffect(() => {
    map.on("contextmenu", handleContextMenu);
    map.on("touchstart", handleTouchStart as any);
    map.on("touchend", handleTouchEnd as any);
    map.on("touchmove", handleTouchMove as any);

    return () => {
      map.off("contextmenu", handleContextMenu);
      map.off("touchstart", handleTouchStart as any);
      map.off("touchend", handleTouchEnd as any);
      map.off("touchmove", handleTouchMove as any);
    };
  }, [map, handleContextMenu, handleTouchStart, handleTouchEnd, handleTouchMove]);

  // Desktop click handler
  useMapEvents({
    click(event) {
      // Only handle on non-touch devices
      if (!("ontouchstart" in window)) {
        onMapClick?.([event.latlng.lat, event.latlng.lng]);
      }
    },
  });

  return null;
}
```

**Update RacingMap.tsx:**

```tsx
// Replace MapClickCapture with MapInteractionCapture
import { MapInteractionCapture } from "./MapInteractionCapture";

// In RacingMap component props:
interface RacingMapProps {
  // ... existing props
  onMapClick?: (coords: [number, number]) => void;
  onMapLongPress?: (coords: [number, number]) => void; // NEW
}

// In render:
<MapInteractionCapture 
  onMapClick={onMapClick}
  onMapLongPress={onMapLongPress}
/>
```

**Update MapRidersClientRefactored.tsx:**

```tsx
// Add long-press handler
<RacingMap
  points={mapPoints}
  bounds={mapData?.bounds || mapBounds || DEFAULT_BOUNDS}
  className="h-full min-h-[78vh] w-full md:min-h-[84vh]"
  tileLayer={mapData?.meta.tileLayer || "cartodb-dark"}
  onMapClick={(coords) => {
    // Short tap on desktop - could show tooltip
    console.log("Map tapped:", coords);
  }}
  onMapLongPress={(coords) => {
    // Long-press - select meetup point
    dispatch({ type: "ui/select-meetup-point", payload: coords });
  }}
>
  <RiderMarkerLayer />
</RacingMap>
```

---

### CRIT-2: Missing `useMapRidersContext` Hook File

**Problem:**
The refactored code imports `useMapRiders` from `@/hooks/useMapRidersContext`, but this file wasn't provided in the code dump. Without it, the entire refactored app won't compile.

**Required Implementation:**

Create `/hooks/useMapRidersContext.tsx`:

```tsx
"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  mapRidersReducer,
  initialMapRidersState,
  type MapRidersState,
  type MapRidersAction,
  type SnapshotData,
  type SessionDetail,
} from "@/lib/map-riders-reducer";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { FranchizeCrewVM } from "@/app/franchize/actions";

interface MapRidersContextValue {
  state: MapRidersState;
  dispatch: React.Dispatch<MapRidersAction>;
  crewSlug: string;
  crew: FranchizeCrewVM;
  fetchSnapshot: () => Promise<void>;
  fetchSessionDetail: (sessionId: string) => Promise<void>;
}

const MapRidersContext = createContext<MapRidersContextValue | null>(null);

const STALE_MS = 30_000;
const EVICT_MS = 120_000;

export function MapRidersProvider({
  children,
  crew,
  slug,
}: {
  children: ReactNode;
  crew: FranchizeCrewVM;
  slug: string;
}) {
  const [state, dispatch] = useReducer(mapRidersReducer, initialMapRidersState);
  const crewSlug = slug;
  const supabaseRef = useRef(getSupabaseBrowserClient());

  // Fetch snapshot from API
  const fetchSnapshot = useCallback(async () => {
    dispatch({ type: "loading", payload: true });
    try {
      const response = await fetch(
        `/api/map-riders?slug=${encodeURIComponent(crewSlug)}`,
        { cache: "no-store" }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load MapRiders");
      }
      dispatch({
        type: "snapshot/loaded",
        payload: result.data as SnapshotData,
        selfUserId: undefined, // Will be set from context
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      dispatch({ type: "error", payload: message });
    }
  }, [crewSlug]);

  // Fetch session detail
  const fetchSessionDetail = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(
          `/api/map-riders/session/${sessionId}`,
          { cache: "no-store" }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load track");
        }
        dispatch({
          type: "session/detail-loaded",
          payload: result.data as SessionDetail,
        });
      } catch (error) {
        console.error("[MapRiders] Failed to load session detail:", error);
      }
    },
    []
  );

  // Subscribe to realtime updates
  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`map-riders:${crewSlug}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "map_rider_sessions",
          filter: `crew_slug=eq.${crewSlug}`,
        },
        () => fetchSnapshot()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "map_rider_meetups",
          filter: `crew_slug=eq.${crewSlug}`,
        },
        () => fetchSnapshot()
      )
      .on("broadcast", { event: "rider:move" }, (payload) => {
        dispatch({
          type: "rider/moved",
          payload: payload.payload as any,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewSlug, fetchSnapshot]);

  // Initial fetch
  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Eviction tick timer
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: "eviction/tick" });
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  const value: MapRidersContextValue = {
    state,
    dispatch,
    crewSlug,
    crew,
    fetchSnapshot,
    fetchSessionDetail,
  };

  return (
    <MapRidersContext.Provider value={value}>
      {children}
    </MapRidersContext.Provider>
  );
}

export function useMapRiders(): MapRidersContextValue {
  const context = useContext(MapRidersContext);
  if (!context) {
    throw new Error(
      "useMapRiders must be used within a MapRidersProvider"
    );
  }
  return context;
}
```

---

### CRIT-3: Missing `onPosition` Callback in useLiveRiders Usage

**Problem:**
In `MapRidersClientRefactored.tsx`, the `useLiveRiders` hook is called without the `onPosition` callback:

```tsx
// CURRENT - MISSING onPosition
useLiveRiders({
  crewSlug,
  sessionId: state.sessionId,
  userId: dbUser?.user_id || null,
  enabled: state.shareEnabled && Boolean(state.sessionId),
});
```

But the hook definition expects `onPosition` to broadcast position updates:

```tsx
interface UseLiveRidersOptions {
  // ...
  onPosition?: (point: GPSPoint) => void; // Not being used!
}
```

**Fix:**
The hook already broadcasts internally, but the component should also update local state for immediate feedback:

```tsx
useLiveRiders({
  crewSlug,
  sessionId: state.sessionId,
  userId: dbUser?.user_id || null,
  enabled: state.shareEnabled && Boolean(state.sessionId),
  onPosition: (point) => {
    // Update local rider position immediately (optimistic)
    dispatch({
      type: "rider/moved",
      payload: {
        user_id: dbUser!.user_id,
        lat: point.lat,
        lng: point.lng,
        speed_kmh: point.speedKmh,
        heading: point.heading,
        updated_at: point.capturedAt,
      },
      selfUserId: dbUser?.user_id,
    });
  },
});
```

---

### CRIT-4: Missing Self User ID in Reducer Actions

**Problem:**
The reducer uses `selfUserId` to mark riders as `isSelf`, but this value is never properly passed from the component context.

**In reducer:**
```tsx
case "snapshot/loaded": {
  const { payload, selfUserId } = action;
  // ...
  isSelf: loc.user_id === selfUserId, // selfUserId is undefined!
}
```

**Fix in context:**
```tsx
// In MapRidersProvider, get userId from a parent context or prop
export function MapRidersProvider({
  children,
  crew,
  slug,
  selfUserId, // ADD THIS PROP
}: {
  children: ReactNode;
  crew: FranchizeCrewVM;
  slug: string;
  selfUserId?: string; // NEW
}) {
  // ...
  dispatch({
    type: "snapshot/loaded",
    payload: result.data as SnapshotData,
    selfUserId, // PASS IT
  });
}
```

**Fix in MapRidersClientRefactored:**
```tsx
export function MapRidersClientRefactored({ crew, slug }: { crew: FranchizeCrewVM; slug?: string }) {
  const { dbUser } = useAppContext();
  const resolvedSlug = crew.slug || slug || "vip-bike";
  
  return (
    <MapRidersProvider crew={crew} slug={resolvedSlug} selfUserId={dbUser?.user_id}>
      <MapRidersInner crew={crew} />
    </MapRidersProvider>
  );
}
```

---

### CRIT-5: RiderMarker Animation Memory Leak

**Problem:**
In `RiderMarker.tsx`, the animation uses `requestAnimationFrame` but doesn't properly clean up in all cases:

```tsx
useEffect(() => {
  // ...
  animationRef.current = requestAnimationFrame(step);
  
  return () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };
}, [rider.lat, rider.lng]);
```

**Issue:**
If the component unmounts during animation, the cleanup runs, but `step` might still schedule another frame before unmount completes.

**Fix:**
```tsx
useEffect(() => {
  if (animationRef.current) {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }

  const target: [number, number] = [rider.lat, rider.lng];
  const from = positionRef.current;
  const deltaLat = target[0] - from[0];
  const deltaLng = target[1] - from[1];
  const movementMagnitude = Math.abs(deltaLat) + Math.abs(deltaLng);

  // Skip animation for tiny moves or large jumps
  if (movementMagnitude < 0.00001 || movementMagnitude > 0.08) {
    positionRef.current = target;
    setPosition(target);
    return;
  }

  let cancelled = false; // GUARD
  const start = performance.now();
  const durationMs = 650;

  const step = (now: number) => {
    if (cancelled) return; // CHECK GUARD
    
    const progress = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    const next: [number, number] = [
      from[0] + deltaLat * eased,
      from[1] + deltaLng * eased,
    ];
    positionRef.current = next;
    setPosition(next);

    if (progress < 1 && !cancelled) { // CHECK GUARD
      animationRef.current = requestAnimationFrame(step);
    }
  };

  animationRef.current = requestAnimationFrame(step);

  return () => {
    cancelled = true; // SET GUARD
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };
}, [rider.lat, rider.lng]);
```

---

## 🟠 HIGH PRIORITY ISSUES

### HIGH-1: Missing API Routes ✅ VERIFIED EXISTS

The refactored code references API routes:

| Route | Purpose | Status |
|-------|---------|--------|
| `/api/map-riders` | Fetch snapshot | ✅ Exists |
| `/api/map-riders/session` | Start/stop session | ✅ Exists |
| `/api/map-riders/session/[id]` | Get session detail | ✅ Exists |
| `/api/map-riders/location` | Update position | ✅ Exists |
| `/api/map-riders/meetups` | Create meetup | ✅ Exists |
| `/api/map-riders/batch-points` | Batch GPS upload | ✅ **VERIFIED EXISTS** |

**No action needed** - all required API routes are implemented in the codebase.

---

### HIGH-2: Original Demo Mode Functionality Missing

**Problem:**
The original "monster" code had a rich demo mode with animated demo riders:

```tsx
// ORIGINAL
const orbit = Math.sin(demoTime / 2.8) * 0.004;
const orbit2 = Math.cos(demoTime / 3.4) * 0.0035;
// ... multiple demo riders with animated positions
```

The refactored code has a static demo fallback:

```tsx
// REFACTORED - STATIC
const demoPoints = riderPoints.length > 0 ? [] : [{
  id: "demo-rider-alpha",
  name: "Demo Rider База • 14 км/ч",
  // ... static position
}];
```

**Fix:**
Add animated demo mode to `MapRidersClientRefactored.tsx`:

```tsx
// Add to component state
const [demoTime, setDemoTime] = useState(0);
const [demoMode, setDemoMode] = useState(false);

// Timer for demo animation
useEffect(() => {
  if (!demoMode) return;
  const timer = window.setInterval(() => setDemoTime((t) => t + 1), 1300);
  return () => window.clearInterval(timer);
}, [demoMode]);

// Auto-enable demo when no riders
useEffect(() => {
  if (state.sessions.length === 0 && state.liveRiders.size === 0) {
    setDemoMode(true);
  } else {
    setDemoMode(false);
  }
}, [state.sessions.length, state.liveRiders.size]);

// Animated demo points in mapPoints useMemo
const demoPoints = useMemo(() => {
  if (!demoMode) return [];
  
  const orbit = Math.sin(demoTime / 2.8) * 0.004;
  const orbit2 = Math.cos(demoTime / 3.4) * 0.0035;
  
  return [
    {
      id: "demo-rider-alpha",
      name: `Demo Rider Alpha • ${18 + Math.round(Math.abs(orbit) * 100)} км/ч`,
      type: "point" as const,
      icon: "image:https://placehold.co/56x56/111827/ffffff?text=DA",
      color: "#60a5fa",
      coords: [[56.2339 + orbit, 43.9801 + orbit2]] as [number, number][],
    },
    {
      id: "demo-rider-beta",
      name: `Demo Rider Beta • ${23 + Math.round(Math.abs(orbit2) * 120)} км/ч`,
      type: "point" as const,
      icon: "image:https://placehold.co/56x56/facc15/111827?text=DB",
      color: "#facc15",
      coords: [[56.2251 - orbit2, 43.9924 + orbit]] as [number, number][],
    },
    {
      id: "demo-rider-gamma",
      name: `Demo Rider Gamma • ${31 + Math.round(Math.abs(orbit2) * 80)} км/ч`,
      type: "point" as const,
      icon: "image:https://placehold.co/56x56/16a34a/ffffff?text=DG",
      color: "#22c55e",
      coords: [[56.2186 + orbit2, 43.964 + orbit]] as [number, number][],
    },
  ];
}, [demoMode, demoTime]);
```

---

### HIGH-3: Missing Session Form Fields

**Problem:**
The original code had form fields for ride name, vehicle label, and ride mode:

```tsx
// ORIGINAL
const [rideName, setRideName] = useState("Вечерний выезд");
const [vehicleLabel, setVehicleLabel] = useState("VIP bike");
const [rideMode, setRideMode] = useState<"rental" | "personal">("rental");
```

These are in the reducer state but **the UI inputs are missing** from the refactored `MapRidersClientRefactored.tsx`.

**Fix:**
Add form inputs to the rider control panel:

```tsx
{/* In rider control panel section */}
<div className="mt-4 space-y-3">
  <div className="space-y-2">
    <Label htmlFor="ride-name">Название заезда</Label>
    <Input
      id="ride-name"
      value={state.rideName}
      onChange={(e) =>
        dispatch({
          type: "ui/set-ride-name",
          payload: e.target.value,
        })
      }
      disabled={state.shareEnabled}
    />
  </div>
  
  <div className="space-y-2">
    <Label htmlFor="vehicle-label">Байк</Label>
    <Input
      id="vehicle-label"
      value={state.vehicleLabel}
      onChange={(e) =>
        dispatch({
          type: "ui/set-vehicle-label",
          payload: e.target.value,
        })
      }
      disabled={state.shareEnabled}
    />
  </div>
  
  <div className="grid grid-cols-2 gap-3">
    <Button
      type="button"
      variant={state.rideMode === "rental" ? "default" : "outline"}
      onClick={() => dispatch({ type: "ui/set-ride-mode", payload: "rental" })}
      disabled={state.shareEnabled}
    >
      Арендный байк
    </Button>
    <Button
      type="button"
      variant={state.rideMode === "personal" ? "default" : "outline"}
      onClick={() => dispatch({ type: "ui/set-ride-mode", payload: "personal" })}
      disabled={state.shareEnabled}
    >
      Свой байк
    </Button>
  </div>
</div>
```

**Also add reducer actions:**

```tsx
// In map-riders-reducer.ts, add to MapRidersAction type:
| { type: "ui/set-ride-name"; payload: string }
| { type: "ui/set-vehicle-label"; payload: string }
| { type: "ui/set-ride-mode"; payload: "rental" | "personal" }

// In reducer switch:
case "ui/set-ride-name":
  return { ...state, rideName: action.payload };

case "ui/set-vehicle-label":
  return { ...state, vehicleLabel: action.payload };

case "ui/set-ride-mode":
  return { ...state, rideMode: action.payload };
```

---

### HIGH-4: Missing Toggle Demo Mode Button

**Problem:**
Original had a button to toggle demo mode:

```tsx
// ORIGINAL
<Button
  type="button"
  variant="secondary"
  className="w-full"
  onClick={() => setDemoMode((prev) => !prev)}
>
  {demoMode ? "Выключить demo режим" : "Включить demo режим"}
</Button>
```

**Fix:**
Add to rider control panel:

```tsx
<Button
  type="button"
  variant="secondary"
  className="w-full mt-3"
  onClick={() => setDemoMode((prev) => !prev)}
>
  {demoMode ? "Выключить demo режим" : "Включить demo режим"}
</Button>
```

---

### HIGH-5: Missing Meetup Creation Toast Feedback

**Problem:**
The `RidersDrawer.tsx` has meetup creation logic, but after creating a meetup, the selected point should be cleared AND the drawer should provide visual feedback.

**Current:**
```tsx
toast.success("Meetup сохранён!");
setMeetupComment("");
dispatch({ type: "ui/select-meetup-point", payload: null });
```

**Fix:**
Also close the drawer and show the new meetup on map:

```tsx
const handleCreateMeetup = useCallback(async () => {
  // ... existing validation
  
  setIsSubmitting(true);
  try {
    const res = await fetch("/api/map-riders/meetups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        crewSlug,
        userId: dbUser.user_id,
        title: meetupTitle,
        comment: meetupComment,
        lat: state.selectedMeetupPoint[0],
        lon: state.selectedMeetupPoint[1],
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error);
    
    toast.success("Точка встречи сохранена для всего экипажа!");
    setMeetupComment("");
    setMeetupTitle("Точка сбора");
    dispatch({ type: "ui/select-meetup-point", payload: null });
    await fetchSnapshot();
    
    // Flash the new meetup on map - it will appear from snapshot
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Ошибка meetup");
  } finally {
    setIsSubmitting(false);
  }
}, [/* deps */]);
```

---

### HIGH-6: Missing History/Recent Completed Sessions

**Problem:**
The reducer has `recentCompleted` state and the drawer has a "History" tab, but the API might not be returning `latestCompleted` properly.

**Verify API Response:**
```tsx
// In /api/map-riders/route.ts, ensure this is returned:
return NextResponse.json({
  success: true,
  data: {
    activeSessions,
    meetups,
    liveLocations,
    weeklyLeaderboard,
    latestCompleted: recentSessions, // THIS MUST BE INCLUDED
    stats,
  },
});
```

---

### HIGH-7: Clustering Implementation Incomplete

**Problem:**
`RiderMarkerLayer.tsx` implements clustering, but the cluster markers need proper styling and the clustering algorithm could cause flickering.

**Fix:**
Add CSS for cluster markers:

```css
/* In globals.css */
.rider-cluster-icon {
  background: transparent !important;
  border: none !important;
}

.rider-cluster {
  transition: transform 0.2s ease-out;
}

.rider-cluster:hover {
  transform: scale(1.1);
}
```

---

### HIGH-8: Missing vaul Drawer Handle

**Problem:**
The drawer uses `Drawer.Handle` incorrectly. The handle should be inside `Drawer.Trigger` or directly as a child of `Drawer.Content`.

**Current:**
```tsx
<Drawer.Root snapPoints={[64, 380, 640]}>
  <Drawer.Handle
    className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-white/30"
    onClick={() => dispatch({ type: "ui/toggle-drawer" })}
  />
  <Drawer.Content>
```

**Fix:**
```tsx
<Drawer.Root
  snapPoints={[64, 380, 640]}
  open={state.drawerOpen}
  onOpenChange={(open) => {
    if (!open) dispatch({ type: "ui/toggle-drawer" });
  }}
>
  <Drawer.Content className="mx-auto flex h-full w-full max-w-lg flex-col rounded-t-2xl bg-black/90 backdrop-blur-xl">
    {/* Handle as visual element at top of content */}
    <div className="flex justify-center pt-2">
      <div className="h-1.5 w-12 rounded-full bg-white/30" />
    </div>
    {/* ... rest of content */}
  </Drawer.Content>
</Drawer.Root>
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### MED-1: Missing `preferCanvas` Prop in RacingMap

**Current:**
```tsx
<MapContainer
  bounds={mapBounds}
  className="z-0 h-full w-full"
  zoomControl
  attributionControl
  preferCanvas
>
```

**Issue:**
`preferCanvas` is a prop, not an attribute. It should be passed differently with react-leaflet v4.

**Fix:**
```tsx
<MapContainer
  bounds={mapBounds}
  className="z-0 h-full w-full"
  zoomControl={false}
  attributionControl={false}
  preferCanvas={true}
>
```

---

### MED-2: Missing Custom Zoom Controls

**Problem:**
The map has `zoomControl` enabled (default Leaflet position: top-left), but the design would benefit from custom positioned controls.

**Fix:**
Add custom zoom controls component:

```tsx
// In RacingMap.tsx
import { useMap } from "react-leaflet";

function CustomZoomControl() {
  const map = useMap();
  
  return (
    <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
      <button
        onClick={() => map.zoomIn()}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/70"
      >
        +
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm hover:bg-black/70"
      >
        −
      </button>
    </div>
  );
}
```

---

### MED-3: No Offline/Fallback Map Tiles

**Problem:**
If tile server is unavailable, the map shows blank.

**Fix:**
Add fallback tile layer:

```tsx
<TileLayer
  url={source}
  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
  errorTileUrl="/fallback-tile.png"
/>
```

---

### MED-4: Missing Route Point Accumulation

**Problem:**
Original code had `pendingRoutePointsRef` to accumulate route points during a session, then save them on stop. Refactored code doesn't do this.

**Fix:**
Add to `useMapRidersContext.tsx`:

```tsx
const pendingRoutePointsRef = useRef<Array<{
  lat: number;
  lon: number;
  speedKmh: number;
  headingDeg: number | null;
  accuracyMeters: number | null;
  capturedAt: string;
}>>([]);

// In useLiveRiders onPosition callback:
onPosition: (point) => {
  pendingRoutePointsRef.current.push({
    lat: point.lat,
    lon: point.lng,
    speedKmh: point.speedKmh,
    headingDeg: point.heading,
    accuracyMeters: point.accuracyMeters,
    capturedAt: point.capturedAt,
  });
  // ... dispatch rider/moved
},
```

---

### MED-5: ~~Missing Compass/Heading Indicator~~

> **REMOVED**: User confirmed map doesn't rotate, so compass indicator is not needed.

---

### MED-6: No Battery Optimization for GPS

**Problem:**
The GPS continues running even when app is in background.

**Current Fix (partial):**
```tsx
// useLiveRiders.ts already has visibility change handling
useEffect(() => {
  const onVisibility = () => {
    // ...
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => document.removeEventListener("visibilitychange", onVisibility);
}, [enabled, handlePosition, handleError]);
```

**Enhancement:**
Also pause when app is in background for extended periods:

```tsx
const [backgroundTime, setBackgroundTime] = useState<number | null>(null);

useEffect(() => {
  const onVisibility = () => {
    if (document.hidden) {
      setBackgroundTime(Date.now());
    } else {
      // If was background for > 5 minutes, refresh snapshot
      if (backgroundTime && Date.now() - backgroundTime > 300_000) {
        fetchSnapshot();
      }
      setBackgroundTime(null);
    }
  };
  // ...
}, [backgroundTime, fetchSnapshot]);
```

---

## 🟢 LOW PRIORITY / ENHANCEMENTS

### LOW-1: Add Sound Effects

Play sound when:
- Session starts
- New rider joins
- Meetup created

### LOW-2: Add Haptic Feedback

Use Telegram WebApp haptic feedback:

```tsx
import { useTelegram } from "@/hooks/useTelegram";

// In start sharing
tg?.HapticFeedback?.impactOccurred("medium");

// In meetup created
tg?.HapticFeedback?.notificationOccurred("success");
```

### LOW-3: Add Map Theme Switching

Allow switching between dark/light map tiles.

### LOW-4: Add Rider Photos in Markers

Show actual user avatar instead of initials placeholder.

---

## IMPLEMENTATION ORDER

Execute fixes in this order for maximum impact:

### Phase A: Critical Fixes (Do First)
1. **CRIT-2**: Create `useMapRidersContext.tsx` hook file
2. **CRIT-4**: Pass `selfUserId` properly through context
3. **CRIT-1**: Fix mobile long-tap with `MapInteractionCapture`
4. **CRIT-3**: Add `onPosition` callback to `useLiveRiders`
5. **CRIT-5**: Fix RiderMarker animation memory leak

### Phase B: High Priority Fixes
6. ~~**HIGH-1**: Create `/api/map-riders/batch-points` route~~ ✅ Already exists
7. **HIGH-3**: Add session form fields (ride name, vehicle, mode)
8. **HIGH-2**: Implement animated demo mode
9. **HIGH-4**: Add toggle demo mode button
10. **HIGH-8**: Fix vaul drawer handle
11. **HIGH-5**: Improve meetup creation feedback
12. **HIGH-6**: Verify API returns latestCompleted
13. **HIGH-7**: Add cluster marker CSS

### Phase C: Medium Priority
14. **MED-1**: Fix `preferCanvas` prop
15. **MED-2**: Add custom zoom controls
16. **MED-4**: Add route point accumulation
17. **MED-3**: Add fallback tile handling
18. **MED-6**: Enhanced battery optimization

### Phase D: Polish
19. **LOW-2**: Add haptic feedback
20. **LOW-1**: Add sound effects (optional)
21. **LOW-4**: Add rider avatars

---

## FILES TO CREATE/MODIFY

### Create New Files:
1. `/hooks/useMapRidersContext.tsx`
2. `/components/maps/MapInteractionCapture.tsx`

### Modify Existing Files:
1. `/components/maps/RacingMap.tsx` - Add `onMapLongPress` prop
2. `/components/map-riders/MapRidersClientRefactored.tsx` - Multiple fixes
3. `/components/map-riders/RidersDrawer.tsx` - Drawer fixes
4. `/components/map-riders/RiderMarker.tsx` - Animation fix
5. `/lib/map-riders-reducer.ts` - Add UI action types
6. `/app/globals.css` - Add cluster marker styles

### Verified Existing (No Changes Needed):
1. `/app/api/map-riders/batch-points/route.ts` - Already implemented

---

## TESTING CHECKLIST

After implementing fixes, verify:

- [ ] Mobile long-tap creates meetup point
- [ ] Long-tap on desktop (right-click) creates meetup point
- [ ] Demo mode shows animated riders
- [ ] Demo mode toggle button works
- [ ] Session form fields are editable
- [ ] Session form values persist to API
- [ ] Own rider marker shows yellow
- [ ] Other rider markers show blue
- [ ] Stale rider markers fade to gray
- [ ] Stale riders are evicted after 2 minutes
- [ ] Drawer opens/closes correctly
- [ ] History tab shows completed sessions
- [ ] Meetup creation clears selected point
- [ ] Realtime updates work for new riders
- [ ] Realtime updates work for rider movement
- [ ] GPS batching works (check batch-points API)
- [ ] Battery optimization when app backgrounded
- [ ] No memory leaks from marker animations

---

## CONCLUSION

The refactoring is well-structured but has several integration gaps. The most critical issue is **mobile long-tap meetup creation**, which is completely broken due to missing touch event handling. Fix the issues in the order specified above for best results.

**Estimated Fix Time:**
- Phase A (Critical): 2-3 hours
- Phase B (High): 3-4 hours  
- Phase C (Medium): 2 hours
- Phase D (Polish): 1-2 hours

**Total: ~8-11 hours of focused work**
