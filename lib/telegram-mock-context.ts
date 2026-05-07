const PREVIEW_MOCK_CONTEXT_MARKER = "salavey13";

export function isAllowedMockContext(): boolean {
  if (process.env.NEXT_PUBLIC_IS_PREVIEW === "true") return true;

  if (typeof window === "undefined") return false;

  return window.location.href.toLowerCase().includes(PREVIEW_MOCK_CONTEXT_MARKER);
}
