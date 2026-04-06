// /components/map-riders/LoadingSkeleton.tsx
// Skeleton loading states for MapRiders — replaces blank screen on initial load.

"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function MapRidersSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-20 md:pt-24">
      {/* Map skeleton */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10">
        <Skeleton className="h-[78vh] w-full md:h-[84vh]" />
        {/* Floating badge skeletons */}
        <div className="absolute left-3 top-3 flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      {/* Stats + control skeleton */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
        <div className="space-y-4 rounded-2xl border border-white/10 p-6">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-8 w-64 rounded" />
          <Skeleton className="h-4 w-96 rounded" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-white/10 p-4">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-7 w-12 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-white/10 p-6">
          <Skeleton className="h-6 w-28 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function RiderListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5">
          <div className="space-y-1">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
          <div className="space-y-1 text-right">
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
