"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";

type Voxel = {
  id: string;
  position: { x: number; y: number; z: number };
  label: string;
};

type Location = {
  voxel: string;
  quantity: number;
};

type Item = {
  id: string;
  name: string;
  description: string;
  image: string;
  locations: Location[];
  total_quantity: number;
  season?: 'leto' | 'zima';
  pattern?: 'kruzheva' | 'mirodel' | 'ogurtsy' | 'flora1' | 'flora2' | 'flora3';
  color: string;
  size: string;
};

type Content = {
  item: Item;
  local_quantity: number;
};

type WarehouseCellProps = {
  voxel: Voxel;
  contents: Content[];
  selected: boolean;
  onSelect: (id: string) => void;
  onUpdateQty: (itemId: string, voxelId: string, quantity: number) => void;
  items: Item[]; // All items for add new
};

const COLOR_MAP: {[key: string]: string} = {
  beige: 'bg-yellow-200',
  blue: 'bg-blue-200',
  red: 'bg-red-200',
  'light-green': 'bg-green-200',
  'dark-green': 'bg-green-500',
  gray: 'bg-gray-200',
};

const SIZE_PACK: {[key: string]: number} = {
  '180x220': 6,
  '200x220': 6,
  '220x240': 8,
  '90': 8,
  '120': 8,
  '140': 8,
  '160': 8,
  '180': 8,
  '200': 8,
  '150x200': 6,
};

export function WarehouseCell({ voxel, contents, selected, onSelect, onUpdateQty, items }: WarehouseCellProps) {
  const totalQuantity = contents.reduce((acc, c) => acc + c.local_quantity, 0);
  const [addItemId, setAddItemId] = useState<string | null>(null);

  const availableItems = items.filter(i => !contents.some(c => c.item.id === i.id));

  const handleAddItem = () => {
    if (addItemId) {
      onUpdateQty(addItemId, voxel.id, 1);
      setAddItemId(null);
    }
  };

  const renderBullets = (item: Item, qty: number) => {
    const packSize = SIZE_PACK[item.size] || 6;
    const fullPacks = Math.floor(qty / packSize);
    const partial = qty % packSize;
    const bullets = [];
    for (let i = 0; i < fullPacks; i++) {
      bullets.push(
        <AnimatePresence key={`pack-${i}`}>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="flex flex-col gap-0.5">
            {Array.from({length: packSize}).map((_, j) => (
              <div key={j} className={cn("w-2 h-2 rounded-full", COLOR_MAP[item.color || 'gray'])} />
            ))}
          </motion.div>
        </AnimatePresence>
      );
    }
    if (partial > 0) {
      bullets.push(
        <AnimatePresence key="partial">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="flex flex-col gap-0.5">
            {Array.from({length: packSize}).map((_, j) => (
              <div key={j} className={cn("w-2 h-2 rounded-full", j < partial ? COLOR_MAP[item.color || 'gray'] : 'bg-gray-100')} />
            ))}
          </motion.div>
        </AnimatePresence>
      );
    }
    return bullets;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className={cn(
            "w-16 h-16 bg-blue-500/30 border border-blue-300 cursor-pointer transition-all flex flex-col items-center justify-center text-xs p-1",
            selected && "bg-blue-500/70 scale-105"
          )}
          onClick={() => onSelect(voxel.id)}
        >
          <div>{voxel.id}</div>
          <div className="flex flex-wrap gap-0.5">{contents.map(c => renderBullets(c.item, c.local_quantity))}</div>
          <div>{totalQuantity > 0 ? totalQuantity : 'Пусто'}</div>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать {voxel.label}</DialogTitle>
        </DialogHeader>
        {contents.map(({item, local_quantity}) => (
          <div key={item.id} className="flex items-center gap-2">
            <span>{item.name} ({local_quantity})</span>
            <Button size="icon" onClick={() => onUpdateQty(item.id, voxel.id, local_quantity + 1)}><Plus size={12} /></Button>
            <Button size="icon" onClick={() => onUpdateQty(item.id, voxel.id, local_quantity - 1)}><Minus size={12} /></Button>
          </div>
        ))}
        {availableItems.length > 0 && (
          <div className="mt-4">
            <Select value={addItemId || ''} onValueChange={setAddItemId}>
              <SelectTrigger>
                <SelectValue placeholder="Добавить товар" />
              </SelectTrigger>
              <SelectContent>
                {availableItems.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddItem} className="mt-2">Добавить</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}