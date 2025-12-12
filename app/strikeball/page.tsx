"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaCrosshairs, FaShieldHalved, FaUsers, FaQrcode } from "react-icons/fa6";
import { useAppContext } from "@/contexts/AppContext";
import { CreateLobbyForm } from "./components/CreateLobbyForm";

export default function StrikeballDashboard() {
  const { user } = useAppContext();

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 pb-24">
      <header className="mb-8 pt-4">
        <h1 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 font-orbitron">
          STRIKE<span className="text-white">BALL</span> OPS
        </h1>
        <p className="text-neutral-400 mt-2 font-mono text-sm">
          Operator: {user?.username || "Unknown"} | Status: ACTIVE
        </p>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link href="/strikeball/shop">
          <motion.div whileTap={{ scale: 0.95 }} className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex flex-col items-center justify-center gap-2 aspect-square">
            <FaShieldHalved className="text-4xl text-emerald-500" />
            <span className="font-bold text-sm">ARMORY (XTR)</span>
          </motion.div>
        </Link>
        <Link href="/strikeball/lobbies">
          <motion.div whileTap={{ scale: 0.95 }} className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex flex-col items-center justify-center gap-2 aspect-square">
             <FaUsers className="text-4xl text-cyan-500" />
             <span className="font-bold text-sm">SQUADS</span>
          </motion.div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FaCrosshairs className="text-red-500" /> DEPLOYMENT
          </h2>
          <CreateLobbyForm />
        </section>

        <section className="bg-neutral-900/50 p-4 rounded-xl border border-dashed border-neutral-700">
           <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold">QR Fast Join</h3>
                <p className="text-xs text-neutral-500">Scan field code to join lobby</p>
              </div>
              <button className="bg-white text-black p-3 rounded-full">
                 <FaQrcode />
              </button>
           </div>
        </section>
      </div>
    </div>
  );
}