"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { simulateGearPurchase } from "./actions"; // We'll create this server action
import { QRCodeSVG } from "qrcode.react";

export default function TestLab() {
  const { dbUser } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [testItemId, setTestItemId] = useState("gear-gun-01"); // Default ID from your SQL

  const handleSimulatePurchase = async () => {
      if (!dbUser?.user_id) return toast.error("Log in first");
      setLoading(true);
      
      const res = await simulateGearPurchase(dbUser.user_id, testItemId);
      
      setLoading(false);
      if (res.success) toast.success("Purchase Simulated! Check Inventory.");
      else toast.error(res.error);
  };

  const qrValue = `gear_buy_${testItemId}_${Date.now()}`;

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono p-8 pt-24">
        <h1 className="text-3xl font-bold mb-8 border-b border-green-800 pb-2">CYBERVIBE TEST LAB // QA PROTOCOL</h1>

        <div className="grid gap-8 md:grid-cols-2">
            
            {/* SIMULATE PAYMENT */}
            <div className="border border-green-800 p-6 rounded bg-green-900/10">
                <h2 className="text-xl font-bold mb-4">[TEST 1] SIMULATE PAYMENT WEBHOOK</h2>
                <p className="text-xs text-green-600 mb-4">Triggers the logic that runs when Telegram confirms payment. Adds item to DB.</p>
                
                <input 
                    value={testItemId} 
                    onChange={e => setTestItemId(e.target.value)}
                    className="w-full bg-black border border-green-700 p-2 mb-4 text-white"
                    placeholder="Item ID (e.g. gear-gun-01)"
                />

                <button 
                    onClick={handleSimulatePurchase}
                    disabled={loading}
                    className="w-full bg-green-700 text-black font-bold py-3 hover:bg-green-600 disabled:opacity-50"
                >
                    {loading ? "PROCESSING..." : "EXECUTE PAYMENT SIMULATION"}
                </button>
            </div>

            {/* GENERATE TEST QR */}
            <div className="border border-green-800 p-6 rounded bg-green-900/10">
                <h2 className="text-xl font-bold mb-4">[TEST 2] ADMIN SCANNER TARGET</h2>
                <p className="text-xs text-green-600 mb-4">Scan this with the Admin Dashboard (/strikeball/admin) to test "Item Issue" logic.</p>
                
                <div className="bg-white p-4 inline-block">
                    {/* Fallback Image for QR */}
                    <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}`} 
                        alt="Test QR"
                    />
                </div>
                <div className="mt-2 text-xs break-all text-gray-500">
                    Payload: {qrValue}
                </div>
            </div>

        </div>
    </div>
  );
}