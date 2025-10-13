"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { COLOR_MAP } from "@/app/wb/common";

interface WarehouseItemCardProps {
  item: {
    id: string;
    name?: string;
    description?: string;
    image?: string;
    total_quantity?: number;
    locations?: { voxel: string; quantity: number }[];
    color?: string;
    season?: string | null;
  };
  onClick?: () => void;
}

export default function WarehouseItemCard({ item, onClick = () => {} }: WarehouseItemCardProps) {
  const tintClass = item?.season === 'leto' ? 'opacity-25' : item?.season === 'zima' ? 'opacity-75' : '';
  const safeLocations = Array.isArray(item?.locations) ? item.locations : [];

  return (
    <motion.div
      onClick={onClick}
      className={cn(
        "relative rounded-lg overflow-hidden cursor-pointer text-[8px] h-20",
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {item?.image && (
        <Image src={item.image} alt={item.name || ""} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
      )}
      <div className={cn("absolute inset-0 opacity-60 transition-opacity duration-300", COLOR_MAP[item?.color || ""], tintClass)} />
      <div className="relative z-10 flex flex-col h-full p-1 justify-between">
        <div>
          <span className="font-semibold leading-tight whitespace-normal break-words text-[10px]" style={{ maxHeight: 10 }}>{item?.name}</span>
          <p className="text-[10px]">Кол: {item?.total_quantity ?? 0}</p>
        </div>
        <div className="flex flex-wrap gap-0.5">
          {safeLocations.map((loc) => (
            <span key={loc.voxel} className="px-0.5 py-0.25 rounded bg-gray-800/50 text-white text-[7px]">
              {loc.voxel}:{loc.quantity}
            </span>
          ))}
        </div>
      </div>
      {item?.description && (
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-gray-900/70 flex items-center justify-center text-center text-white p-1 text-[8px]"
        >
          {item.description}
        </motion.div>
      )}
    </motion.div>
  );
}