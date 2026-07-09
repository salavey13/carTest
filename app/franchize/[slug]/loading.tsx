// FIX: Return null to avoid the goldish "Загружаем витрину..." flash
// during client-side route transitions. The old loading.tsx was shown
// by Next.js as a Suspense fallback whenever the [slug] server component
// re-ran (e.g. /franchize/vip-bike → /franchize/vip-bike/cart), which
// broke the SPA experience. Now the previous route stays mounted until
// the new one is ready, giving a true SPA transition.
export default function FranchizeSlugLoading() {
  return null;
}
