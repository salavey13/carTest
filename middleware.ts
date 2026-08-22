import { NextResponse, type NextRequest } from "next/server";

const FRANCHIZE_THEME_COOKIE = "franchize_slug_theme";
const FRANCHIZE_PATH_PREFIX = "/franchize/";

function appendRequestCookie(cookieHeader: string | null, name: string, value: string) {
  const encodedName = encodeURIComponent(name);
  const encodedValue = encodeURIComponent(value);
  const nextCookie = `${encodedName}=${encodedValue}`;
  const withoutExisting = (cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith(`${encodedName}=`));

  return [...withoutExisting, nextCookie].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith(FRANCHIZE_PATH_PREFIX)) {
    return NextResponse.next();
  }

  const slug = pathname.slice(FRANCHIZE_PATH_PREFIX.length).split("/")[0]?.trim().toLowerCase();

  if (!slug) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "cookie",
    appendRequestCookie(request.headers.get("cookie"), FRANCHIZE_THEME_COOKIE, slug),
  );

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.cookies.set(FRANCHIZE_THEME_COOKIE, slug, {
    path: "/franchize",
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: ["/franchize/:path*"],
};
