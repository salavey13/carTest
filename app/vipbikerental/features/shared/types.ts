/**
 * shared/types.ts
 * ===============
 * Common types shared across VIP Bike feature components.
 * These types are franchise-specific (VIP Bike) but component-agnostic.
 *
 * For the adaptive storefront runtime types (profile, experience, signals),
 * see @/app/franchize/lib/onboarding/experience-types
 */

/** Service item in company service hub cards */
export type ServiceItem = { icon: string; text: string };

/** Map/Riders overview data from the API */
export type MapRidersOverview = {
  stats?: {
    activeRiders?: number;
    meetupCount?: number;
    totalWeeklyDistanceKm?: number;
  };
  liveLocations?: Array<{
    lat?: number;
    lng?: number;
    speed_kmh?: number;
    updated_at?: string;
    user_id?: string;
  }>;
  meetups?: Array<{
    lat?: number;
    lng?: number;
    title?: string;
    comment?: string;
    scheduled_at?: string;
  }>;
  latestCompleted?: Array<{
    rider_name?: string;
    total_distance_km?: number;
    duration_seconds?: number;
    avg_speed_kmh?: number;
    max_speed_kmh?: number;
  }>;
};

/** Hero panel data for the tab-based hero selector */
export type HeroPanel = {
  mode: string;
  label: string;
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl?: string;
  href: string;
  cta: string;
  meta: Array<{ label: string; value: string }>;
};

/** Electro bike preview item (catalog item subset) */
export type ElectroPreviewItem = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  mediaUrls?: string[];
  pricePerDay: number;
  rentPriceLabel?: string;
  category?: string;
  saleAvailable?: boolean;
  salePrice?: number;
  specs: Array<{ label: string; value: string }>;
  rawSpecs?: Record<string, unknown>;
};