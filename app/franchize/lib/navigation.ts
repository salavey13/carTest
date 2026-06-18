const APP_HOSTS = new Set(["v0-car-test.vercel.app"]);

function currentAppHost() {
  if (typeof window !== "undefined") {
    return window.location.host;
  }

  return undefined;
}

function configuredAppHost() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredUrl) return undefined;

  try {
    return new URL(configuredUrl).host;
  } catch {
    return undefined;
  }
}

function knownAppHosts() {
  return new Set([currentAppHost(), configuredAppHost(), ...APP_HOSTS].filter(Boolean) as string[]);
}

export const toCategoryId = (category: string) => `category-${category.trim().toLowerCase().replace(/\s+/g, "-")}`;

export function toInternalHref(href: string) {
  const value = href.trim();

  if (!value || value.startsWith("#")) {
    return value;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  if (!/^https?:\/\//i.test(value)) {
    // For non-http/https protocols (tg://, tel:, mailto:, etc.), return as-is
    // so they're not considered external links
    return value;
  }

  try {
    const url = new URL(value);
    if (knownAppHosts().has(url.host)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return null;
  }

  return null;
}

export const isExternalHref = (href: string) => toInternalHref(href) === null;
