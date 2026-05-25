"use client";

/**
 * Injects the cart-shimmer CSS keyframe animation into the page.
 * This is a one-time injection — the <style> tag is rendered once
 * at the top of the cart page and the animation is available globally.
 *
 * Why not globals.css? The shimmer animation is cart-specific and
 * not a shared utility. Injecting via component keeps it co-located.
 */
export function CartShimmerStyle() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @keyframes cart-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .cart-shimmer {
            background: linear-gradient(
              90deg,
              transparent 0%,
              rgba(0, 200, 83, 0.06) 50%,
              transparent 100%
            );
            background-size: 200% 100%;
            animation: cart-shimmer 3s ease-in-out infinite;
          }
        `,
      }}
    />
  );
}