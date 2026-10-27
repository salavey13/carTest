import type { Metadata } from "next";

// task154: Roman's birthday surprise — secret page, deliberately unlisted.
// noindex + no navigation links anywhere: findable only through the quest.
export const metadata: Metadata = {
  title: "🎁 — VIP BIKE",
  description: "Секретная страница. Если ты здесь — квест пройден.",
  robots: { index: false, follow: false },
};

export default function RomanGiftLayout({ children }: { children: React.ReactNode }) {
  return children;
}
