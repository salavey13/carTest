import Link from "next/link";
import type { ReactNode } from "react";

type OperatorPanelProps = {
  children: ReactNode;
  className?: string;
  muted?: boolean;
};

export function FranchizeOperatorPanel({
  children,
  className = "",
  muted = true,
}: OperatorPanelProps) {
  return (
    <section
      className={`rounded-2xl border p-3 sm:p-4 ${className}`}
      style={{
        borderColor: "var(--franchize-shell-border)",
        backgroundColor: muted
          ? "color-mix(in srgb, var(--franchize-shell-card) 86%, transparent)"
          : "var(--franchize-shell-card)",
        color: "var(--franchize-shell-text)",
      }}
    >
      {children}
    </section>
  );
}

type OperatorStatCardProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
};

export function FranchizeOperatorStatCard({
  label,
  value,
  detail,
  className = "",
}: OperatorStatCardProps) {
  return (
    <FranchizeOperatorPanel className={`min-w-0 ${className}`}>
      <p
        className="text-xs font-medium tracking-wide"
        style={{ color: "var(--franchize-shell-muted)" }}
      >
        {label}
      </p>
      <p className="mt-2 break-words text-2xl font-semibold sm:text-3xl">
        {value}
      </p>
      {detail ? (
        <p
          className="mt-1 break-words text-xs leading-relaxed"
          style={{ color: "var(--franchize-shell-muted)" }}
        >
          {detail}
        </p>
      ) : null}
    </FranchizeOperatorPanel>
  );
}

type OperatorLinkButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function FranchizeOperatorLinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: OperatorLinkButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 ${
        isPrimary ? "hover:opacity-90" : "hover:opacity-80"
      } ${className}`}
      style={
        isPrimary
          ? {
              backgroundColor: "var(--franchize-shell-accent)",
              borderColor: "var(--franchize-shell-accent)",
              color: "var(--franchize-shell-primary-contrast)",
              boxShadow:
                "0 12px 30px color-mix(in srgb, var(--franchize-shell-accent) 24%, transparent)",
            }
          : {
              backgroundColor:
                "color-mix(in srgb, var(--franchize-shell-card) 58%, transparent)",
              borderColor: "var(--franchize-shell-border)",
              color: "var(--franchize-shell-text)",
            }
      }
    >
      {children}
    </Link>
  );
}

export const franchizeOperatorInputClassName =
  "rounded-2xl border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-[var(--franchize-shell-accent)]";

export const franchizeOperatorInputStyle = {
  borderColor: "var(--franchize-shell-border)",
  backgroundColor:
    "color-mix(in srgb, var(--franchize-shell-card) 78%, transparent)",
  color: "var(--franchize-shell-text)",
};
