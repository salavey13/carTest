"use client";
import { translations } from "./translations"; // Assuming we'll extract this

export default function PurchaseScriptsSection({ language }: { language: "en" | "ru" }) {
  return (
    <section className="py-16 bg-gray-900">
      <div>Hello, {translations[language].toolsTitle}</div>
    </section>
  );
}
