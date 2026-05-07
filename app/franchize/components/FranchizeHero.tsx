import Link from "next/link";
import type { ReactNode } from "react";

type FranchizeHeroCta = {
  label: string;
  href: string;
};

type FranchizeHeroProps = {
  eyebrow: string;
  title: string;
  subcopy: string;
  primaryCta: FranchizeHeroCta;
  secondaryCta: FranchizeHeroCta;
  children?: ReactNode;
};

export function FranchizeHero({
  eyebrow,
  title,
  subcopy,
  primaryCta,
  secondaryCta,
  children,
}: FranchizeHeroProps) {
  return (
    <header className="relative z-10 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <div className="min-w-0">
        <p
          className="inline-flex max-w-full rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--franchize-shell-accent) 12%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--franchize-shell-accent) 42%, var(--franchize-shell-border))",
            color: "var(--franchize-shell-accent)",
          }}
        >
          <span className="truncate">{eyebrow}</span>
        </p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p
          className="mt-3 max-w-2xl text-sm leading-6 sm:text-base"
          style={{ color: "var(--franchize-shell-muted)" }}
        >
          {subcopy}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={primaryCta.href}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition hover:opacity-90 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--franchize-shell-accent)",
              borderColor: "var(--franchize-shell-accent)",
              color: "var(--franchize-shell-primary-contrast)",
              boxShadow:
                "0 12px 30px color-mix(in srgb, var(--franchize-shell-accent) 24%, transparent)",
            }}
          >
            {primaryCta.label}
          </Link>
          <Link
            href={secondaryCta.href}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition hover:opacity-80 focus:outline-none focus:ring-2"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--franchize-shell-card) 58%, transparent)",
              borderColor: "var(--franchize-shell-border)",
              color: "var(--franchize-shell-text)",
            }}
          >
            {secondaryCta.label}
          </Link>
        </div>
      </div>
      {children ? <div className="md:max-w-xs">{children}</div> : null}
    </header>
  );
}
