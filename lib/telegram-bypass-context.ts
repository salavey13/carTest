const PREVIEW_BYPASS_HOST_MARKER = "salavey13";

function normalizeHost(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).host;
  } catch {
    return trimmed.split("/")[0] || null;
  }
}

function trustedByExplicitAllowlist(host: string | null): boolean {
  if (!host) return false;

  const allowedHosts = (process.env.TELEGRAM_AUTH_BYPASS_ALLOWED_HOSTS || "")
    .split(",")
    .map((item) => normalizeHost(item))
    .filter(Boolean);

  return allowedHosts.includes(host);
}

export function isTrustedTelegramBypassDeployment(): boolean {
  const deploymentHosts = [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].map((value) => normalizeHost(value));

  if (deploymentHosts.some((host) => trustedByExplicitAllowlist(host))) return true;

  return process.env.VERCEL_ENV === "preview" && deploymentHosts.some((host) => host?.includes(PREVIEW_BYPASS_HOST_MARKER));
}
