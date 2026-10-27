import type { Metadata } from "next";

// task154 iter3: Roman's quest overview — secret companion page, deliberately
// unlisted. noindex + no navigation links anywhere: findable only through the
// quest kickoff the crew sends him.
export const metadata: Metadata = {
  title: "🗺 — VIP BIKE",
  description: "Секретная карта квеста. Если ты здесь — тебе доверяют.",
  robots: { index: false, follow: false },
};

export default function RomanQuestOverviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
