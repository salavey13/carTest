export function isAllowedMockContext(): boolean {
  const environment = (
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.VERCEL_ENV ||
    process.env.NODE_ENV ||
    ""
  ).toLowerCase();

  if (process.env.NEXT_PUBLIC_IS_PREVIEW === "true") return true;

  return environment === "preview" || environment === "development";
}
