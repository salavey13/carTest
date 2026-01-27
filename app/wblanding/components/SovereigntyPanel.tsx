"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Download, Server, Lock, FileJson, FileSpreadsheet, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const SovereigntyPanel = () => {
  const [exported, setExported] = useState<string | null>(null);

  return (
    <div className="bg-zinc-900 border border-brand-cyan/30 rounded-2xl p-6 md:p-8 shadow-2xl shadow-brand-cyan/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-brand-cyan/10 rounded-lg border border-brand-cyan/30">
          <Database className="w-6 h-6 text-brand-cyan" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white font-orbitron">SWITCH: DATA SOVEREIGNTY</h3>
          <p className="text-xs text-zinc-500 font-mono">ВЫГРУЗКА ВЛАСТИ ИЗ ОБЛАКА</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="h-auto py-4 border-zinc-700 hover:border-green-500 hover:bg-green-500/5 flex flex-col items-center gap-2 transition-all"
            onClick={() => setExported('csv')}
          >
            <FileSpreadsheet className="w-8 h-8 text-green-500" />
            <span className="text-xs font-mono text-zinc-300">CSV Export</span>
            <span className="text-[10px] text-zinc-500">Все данные в Excel</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-auto py-4 border-zinc-700 hover:border-yellow-500 hover:bg-yellow-500/5 flex flex-col items-center gap-2 transition-all"
            onClick={() => setExported('json')}
          >
            <FileJson className="w-8 h-8 text-yellow-500" />
            <span className="text-xs font-mono text-zinc-300">JSON Backup</span>
            <span className="text-[10px] text-zinc-500">Полный дамп базы</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="https://github.com/salavey13/carTest" target="_blank" className="w-full">
            <Button 
              variant="outline" 
              className="w-full h-auto py-4 border-zinc-700 hover:border-purple-500 hover:bg-purple-500/5 flex flex-col items-center gap-2"
            >
              <Server className="w-8 h-8 text-purple-500" />
              <span className="text-xs font-mono text-zinc-300">Self-Host</span>
              <span className="text-[10px] text-zinc-500">Fork & Deploy</span>
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            className="h-auto py-4 border-zinc-700 hover:border-red-500 hover:bg-red-500/5 flex flex-col items-center gap-2 opacity-50 hover:opacity-100"
            onClick={() => setExported('purge')}
          >
            <Lock className="w-8 h-8 text-red-500" />
            <span className="text-xs font-mono text-zinc-300">Purge</span>
            <span className="text-[10px] text-zinc-500">Удалить всё</span>
          </Button>
        </div>

        <AnimatePresence>
          {exported && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className={`p-3 rounded border text-center ${
                exported === 'purge' 
                  ? 'bg-red-900/20 border-red-500/30' 
                  : 'bg-green-900/20 border-green-500/30'
              }`}>
                <p className={`text-xs font-mono ${
                  exported === 'purge' ? 'text-red-400' : 'text-green-400'
                }`}>
                  {exported === 'purge' 
                    ? '⚠️ Запрос на удаление данных отправлен. Обработка 24ч.' 
                    : `✅ Данные (${exported.toUpperCase()}) подготовлены к экспорту. Ты — хозяин.`}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-600 text-center font-mono leading-relaxed">
          Нет vendor lock. Нет «облачного рабства». 
          <br/>Твои данные — твоя собственность по 152-ФЗ.
        </p>
      </div>
    </div>
  );
};