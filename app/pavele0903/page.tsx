"use client";

import { useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { translations } from "@/components/translations_inventory";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { FaWarehouse, FaTools, FaChartBar, FaCog } from "react-icons/fa";
import SettingsForm from "@/components/SettingsForm";
import OrderList from "@/components/OrderList";
import InventoryTable from "@/components/InventoryTable";
import OrderSnatcherSection from "@/components/OrderSnatcherSection";

export default function Pavele0903() {
  const { user } = useTelegram();
  const lang = user?.language_code === "ru" ? "ru" : "en"; // Default to English if not Russian

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen pt-24 bg-gray-900 text-white flex flex-col items-center relative">
      <main className="w-full max-w-md p-4 space-y-8">
        {/* Intro Section */}
        <section id="intro" className="space-y-4">
          <h1 className="text-2xl font-bold">{translations[lang].title}</h1>
          <p className="text-sm">
            {translations[lang].intro}{" "}
            <a href="/donate" className="text-blue-400 underline">
              donate
            </a>
          </p>
        </section>

        {/* Warehouse Section */}
        <section id="warehouse" className="space-y-4">
          <h2 className="text-xl font-semibold">{translations[lang].warehouse}</h2>
          <Card className="p-4 bg-gray-800">
            <InventoryTable />
          </Card>
        </section>

        {/* Tools Section */}
        <section id="tools" className="space-y-4">
          <h2 className="text-xl font-semibold">{translations[lang].tools}</h2>
          <OrderSnatcherSection language={lang} />
        </section>

        {/* Stats Section */}
        <section id="stats" className="space-y-4">
          <h2 className="text-xl font-semibold">{translations[lang].stats}</h2>
          <Card className="p-4 bg-gray-800">
            <OrderList />
          </Card>
        </section>

        {/* Settings Section */}
        <section id="settings" className="space-y-4">
          <h2 className="text-xl font-semibold">{translations[lang].settings}</h2>
          <SettingsForm />
        </section>
      </main>

      {/* Fixed Nav Icons */}
      <nav className="fixed right-2 top-1/2 transform -translate-y-1/2 flex flex-col space-y-4">
        <button onClick={() => scrollToSection("intro")} className="p-2 bg-gray-700 rounded-full">
          <FaWarehouse className="text-lg" />
        </button>
        <button onClick={() => scrollToSection("warehouse")} className="p-2 bg-gray-700 rounded-full">
          <FaWarehouse />
        </button>
        <button onClick={() => scrollToSection("tools")} className="p-2 bg-gray-700 rounded-full">
          <FaTools />
        </button>
        <button onClick={() => scrollToSection("stats")} className="p-2 bg-gray-700 rounded-full">
          <FaChartBar />
        </button>
        <button onClick={() => scrollToSection("settings")} className="p-2 bg-gray-700 rounded-full">
          <FaCog />
        </button>
      </nav>
    </div>
  );
}
