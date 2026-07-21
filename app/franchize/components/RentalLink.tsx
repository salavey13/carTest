"use client";

import { useRouter } from "next/navigation";
import type { ReactNode, CSSProperties, MouseEvent } from "react";

/**
 * RentalLink — a navigation link that uses direct `router.push` instead of
 * Next.js <Link>. This bypasses any <Link>/startTransition issues on deeply
 * nested dynamic routes (e.g. /franchize/[slug]/rental/[id]).
 *
 * Looks and feels like <Link> but with explicit push() call.
 * Falls back to window.location.href if push doesn't navigate within 5s.
 */
export function RentalLink({
  href,
  children,
  className,
  style,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Allow the caller to run custom logic first
    onClick?.(e);
    if (e.defaultPrevented) return;

    e.preventDefault();

    const currentPath = window.location.pathname;
    router.push(href);

    // Fallback: if router.push didn't navigate within 5 seconds, force native
    setTimeout(() => {
      if (window.location.pathname === currentPath) {
        window.location.href = href;
      }
    }, 5000);
  };

  return (
    <a href={href} onClick={handleClick} className={className} style={style}>
      {children}
    </a>
  );
}
