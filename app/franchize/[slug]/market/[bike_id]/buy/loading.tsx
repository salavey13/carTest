// FIX: Ditched the goldish "ГОТОВИМ ПОКУПКУ БАЙКА..." loader that flashed
// during navigation to /franchize/[slug]/market/[bike_id]/buy. Return
// null so the parent page stays visible (SPA transition). The buy page
// is a client component that hydrates quickly; no blocking fallback
// is needed.
export default function BuyBikeLoading() {
  return null;
}
