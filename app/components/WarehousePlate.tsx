"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { COLOR_MAP, SIZE_PACK, WarehousePlateProps } from "@/app/wb/common";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function WarehousePlate({ voxel, contents, selected, onSelect, onUpdateQty, items, onPlateClick, gameMode }: WarehousePlateProps) {
  const totalQuantity = contents.reduce((acc, c) => acc + c.local_quantity, 0);
  const [addItemId, setAddItemId] = useState<string | null>(null);

  const availableItems = items.filter(i => !contents.some(c => c.item.id === i.id));

  const handleAddItem = () => {
    if (addItemId) {
      onUpdateQty(addItemId, voxel.id, 1);
      setAddItemId(null);
    }
  };

  const renderBullets = (item: {season?: string; color?: string; size: string; image: string}, qty: number) => {
    const packSize = SIZE_PACK[item.size] || 6;
    const fullPacks = Math.floor(qty / packSize);
    const partial = qty % packSize;
    const borderClass = item.season === 'leto' ? 'border-[0.5px] border-dashed' : 'border-[1px] border-solid'; // Рефайн stripes
    const tintFilter = `brightness(0.8) contrast(1.2) hue-rotate(${item.color === 'beige' ? 30 : item.color === 'blue' ? 180 : 0}deg)`; // Улучшенный tint
    const bullets = [];
    for (let i = 0; i < fullPacks; i++) {
      bullets.push(
        <AnimatePresence key={`pack-${i}`}>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="flex flex-wrap gap-0.5 justify-center items-center w-8 h-8 rounded-full overflow-hidden rotate-anim relative">
            <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{backgroundImage: `url(${item.image})`, filter: tintFilter}} />
            {Array.from({length: packSize}).map((_, j) => (
              <div key={j} className={cn("w-[1.3px] h-[1.3px] rounded-full", COLOR_MAP[item.color || 'gray'], borderClass)} />
            ))}
          </motion.div>
        </AnimatePresence>
      );
    }
    if (partial > 0) {
      bullets.push(
        <AnimatePresence key="partial">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="flex flex-wrap gap-0.5 justify-center items-center w-8 h-8 rounded-full overflow-hidden rotate-anim relative">
            <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{backgroundImage: `url(${item.image})`, filter: tintFilter}} />
            {Array.from({length: packSize}).map((_, j) => (
              <div key={j} className={cn("w-[1.3px] h-[1.3px] rounded-full", j < partial ? COLOR_MAP[item.color || 'gray'] : 'bg-gray-100', borderClass)} />
            ))}
          </motion.div>
        </AnimatePresence>
      );
    }
    return bullets;
  };

  const handleClick = () => {
    if (gameMode) {
      onPlateClick(voxel.id);
      // Виб/звук для иммерсии
      if (navigator.vibrate) navigator.vibrate(50);
      const audio = new Audio('/sounds/click.mp3'); // Предполагаем наличие звука
      audio.play();
    } else {
      onSelect(voxel.id);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Dialog>
            <DialogTrigger asChild disabled={!!gameMode}> {/* Диалог только вне game mode */}
              <motion.div
                whileTap={{ scale: 0.95, boxShadow: "0 0 10px rgba(255,255,255,0.5)" }} // Улучшенная анимация
                className={cn(
                  "w-16 h-16 md:w-12 md:h-12 rounded-lg bg-blue-500/30 border border-blue-300 cursor-pointer transition-all flex flex-col items-center justify-center text-[10px] p-0.5 overflow-hidden",
                  selected && "bg-blue-500/70 scale-105"
                )}
                onClick={handleClick}
              >
                <div className="font-bold">{voxel.id}</div>
                <div className="flex flex-wrap gap-0.5 max-h-6 max-w-full overflow-hidden">{contents.map(c => renderBullets(c.item, c.local_quantity))}</div>
                <div>{totalQuantity > 0 ? totalQuantity : 'Пусто'}</div>
              </motion.div>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Редактировать {voxel.label}</DialogTitle>
              </DialogHeader>
              {contents.map(({item, local_quantity}) => (
                <div key={item.id} className="flex items-center gap-2 text-[10px]">
                  <span>{item.name} ({local_quantity})</span>
                  <Button size="icon" variant="ghost" className="h-4 w-4" onClick={() => onUpdateQty(item.id, voxel.id, local_quantity + 1)}><Plus size={8} /></Button>
                  <Button size="icon" variant="ghost" className="h-4 w-4" onClick={() => onUpdateQty(item.id, voxel.id, local_quantity - 1)}><Minus size={8} /></Button>
                </div>
              ))}
              {availableItems.length > 0 && (
                <div className="mt-4">
                  <Select value={addItemId || ''} onValueChange={setAddItemId}>
                    <SelectTrigger className="h-6 text-[10px]">
                      <SelectValue placeholder="Добавить товар" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableItems.map(i => (
                        <SelectItem key={i.id} value={i.id} className="text-[10px]">{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddItem} className="mt-2 h-6 text-[10px]">Добавить</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TooltipTrigger>
        <TooltipContent>
          <p>{voxel.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}