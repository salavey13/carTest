// /app/pavele0903/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { translations } from "@/components/translations_inventory";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { FaWarehouse, FaBox, FaTools, FaChartBar, FaCog } from "react-icons/fa";
import SettingsForm from "@/components/SettingsForm";
import OrderList from "@/components/OrderList";
import InventoryTable from "@/components/InventoryTable";
import OrderSnatcherSection from "@/components/OrderSnatcherSection";

export default function Pavele0903() {
  const { user } = useAppContext();
  const lang = user?.language_code === "ru" ? "ru" : "en";
  const [refreshKey, setRefreshKey] = useState(0);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const addTestOrder = async () => {
    const crmNames = ["crm1", "crm2", "crm3"];
    const serviceTypes = ["Basic Wash", "Waxing", "Deep Clean"];
    const carSizes = ["Small", "Sedan", "SUV", "Truck"];

    const randomOrder = {
      crm_name: crmNames[Math.floor(Math.random() * crmNames.length)],
      service_id: `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      service_type: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
      car_size: carSizes[Math.floor(Math.random() * carSizes.length)],
      completed_at: new Date().toISOString(),
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(randomOrder),
      });

      if (!response.ok) {
        throw new Error(`Failed to add test order: ${response.statusText}`);
      }
      setRefreshKey((prev) => prev + 1); // Trigger refresh for non-Realtime components
    } catch (error) {
      console.error("Error adding test order:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col items-center relative">
      <main className="w-full max-w-md p-4 space-y-8 flex-1">
        {/* Intro Section */}
        <section id="intro" className="space-y-4 pt-24">
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
            <InventoryTable key={refreshKey} />
          </Card>
        </section>

        {/* Tools Section */}
        <section id="tools" className="space-y-4">
          <h2 className="text-xl font-semibold">{translations[lang].tools}</h2>
          <Button onClick={addTestOrder} className="bg-[#ff007a] hover:bg-[#ff007a]/80">
            {translations[lang].testButton}
          </Button>
          <OrderSnatcherSection />
        </section>

        {/* Stats Section */}
        <section id="stats" className="space-y-4">
          <h2 className="text-xl font-semibold">{translations[lang].stats}</h2>
          <Card className="p-4 bg-gray-800">
            <OrderList key={refreshKey} />
          </Card>
        </section>

        {/* Settings Section */}
        <section id="settings" className="space-y-4 pb-16">
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
          <FaBox className="text-lg" />
        </button>
        <button onClick={() => scrollToSection("tools")} className="p-2 bg-gray-700 rounded-full">
          <FaTools className="text-lg" />
        </button>
        <button onClick={() => scrollToSection("stats")} className="p-2 bg-gray-700 rounded-full">
          <FaChartBar className="text-lg" />
        </button>
        <button onClick={() => scrollToSection("settings")} className="p-2 bg-gray-700 rounded-full">
          <FaCog className="text-lg" />
        </button>
      </nav>
    </div>
  );
}
