"use client";

import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";

import { upsertFranchizeIntent } from "@/app/franchize/actions";
import { useAppContext } from "@/contexts/AppContext";

type IntentType =
  | "map_click"
  | "contact_click"
  | "test_ride_click"
  | "prebuy"
  | "checkout_start";

type IntentStage =
  | "clicked"
  | "contacted"
  | "test_ride_requested"
  | "prebuy_started"
  | "checkout_started";

type AnchorProps = ComponentPropsWithoutRef<"a">;

interface FranchizeIntentLinkProps extends AnchorProps {
  slug: string;
  bikeId?: string;
  intentType: IntentType;
  stage: IntentStage;
  sourceRoute: string;
  contactChannel?: string;
  urgencyScore?: number;
  metadata?: Record<string, unknown>;
  children: ReactNode;
}

function shouldDelayForTrackedNavigation(href: string | undefined, target: string | undefined) {
  if (!href || target === "_blank") return false;
  if (href.startsWith("/") || href.startsWith("#")) return false;

  // Keep external app schemes in the original user activation.
  // Telegram/iOS/Android WebViews may ignore delayed tel:/mailto: navigations.
  if (href.startsWith("tel:") || href.startsWith("mailto:")) return false;

  return href.startsWith("http://") || href.startsWith("https://");
}

function intentTimeout(ms = 350) {
  return new Promise<"timeout">((resolve) => {
    window.setTimeout(() => resolve("timeout"), ms);
  });
}

export function FranchizeIntentLink({
  slug,
  bikeId,
  intentType,
  stage,
  sourceRoute,
  contactChannel,
  urgencyScore = 0,
  metadata = {},
  onClick,
  children,
  ...anchorProps
}: FranchizeIntentLinkProps) {
  const { user, dbUser } = useAppContext();

  const recordIntent = () =>
    upsertFranchizeIntent({
      slug,
      bikeId,
      intentType,
      stage,
      sourceRoute,
      contactChannel,
      urgencyScore,
      telegramUserId: user?.id ? String(user.id) : dbUser?.user_id ? String(dbUser.user_id) : undefined,
      phone: typeof (dbUser as { phone?: unknown } | null)?.phone === "string" ? (dbUser as { phone?: string } | null)?.phone : undefined,
      metadata: {
        ...metadata,
        href: anchorProps.href,
        label: typeof children === "string" ? children : undefined,
      },
    }).catch((error) => {
      console.warn("franchize intent tracking failed", error);
    });

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const href = typeof anchorProps.href === "string" ? anchorProps.href : undefined;
    const target = typeof anchorProps.target === "string" ? anchorProps.target : undefined;
    if (!shouldDelayForTrackedNavigation(href, target)) {
      void recordIntent();
      return;
    }

    event.preventDefault();
    void Promise.race([recordIntent(), intentTimeout()]).finally(() => {
      window.location.href = href;
    });
  };

  return (
    <a {...anchorProps} onClick={handleClick}>
      {children}
    </a>
  );
}
