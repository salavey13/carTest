"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Item } from "@/app/wb/common";

interface FilterAccordionProps {
  filterSeason: string | null;
  setFilterSeason: (value: string | null) => void;
  filterPattern: string | null;
  setFilterPattern: (value: string | null) => void;
  filterColor: string | null;
  setFilterColor: (value: string | null) => void;
  filterSize: string | null;
  setFilterSize: (value: string | null) => void;
  items: Item[];
  onResetFilters: () => void;
  includeSearch?: boolean;
  search?: string;
  setSearch?: (value: string) => void;
  sortOption?: 'size_season_color' | 'color_size' | 'season_size_color' | null;
  setSortOption: (option: 'size_season_color' | 'color_size' | 'season_size_color' | null) => void;
}

export default function FilterAccordion({
  filterSeason,
  setFilterSeason,
  filterPattern,
  setFilterPattern,
  filterColor,
  setFilterColor,
  filterSize,
  setFilterSize,
  items,
  onResetFilters,
  includeSearch = false,
  search = "",
  setSearch = () => {},
  sortOption = 'size_season_color',
  setSortOption,
}: FilterAccordionProps) {
  const uniqueSeasons = Array.from(new Set(items.map((i) => i.season).filter(Boolean)));
  const uniquePatterns = Array.from(new Set(items.map((i) => i.pattern).filter(Boolean)));
  const uniqueColors = Array.from(new Set(items.map((i) => i.color).filter(Boolean)));
  const uniqueSizes = Array.from(new Set(items.map((i) => i.size).filter(Boolean)));

  return (
    <div className="grid grid-cols-2 gap-2">
      {includeSearch && (
        <div className="col-span-2"> {/* Занимает всю ширину */}
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-6 text-[10px] w-full"
          />
        </div>
      )}
      <Select value={filterSeason || ""} onValueChange={(v) => setFilterSeason(v || null)}>
        <SelectTrigger className="h-6 text-[10px] w-full">
          <SelectValue placeholder="Сезон" />
        </SelectTrigger>
        <SelectContent>
          {uniqueSeasons.map((s) => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterPattern || ""} onValueChange={(v) => setFilterPattern(v || null)}>
        <SelectTrigger className="h-6 text-[10px] w-full">
          <SelectValue placeholder="Узор" />
        </SelectTrigger>
        <SelectContent>
          {uniquePatterns.map((p) => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterColor || ""} onValueChange={(v) => setFilterColor(v || null)}>
        <SelectTrigger className="h-6 text-[10px] w-full">
          <SelectValue placeholder="Цвет" />
        </SelectTrigger>
        <SelectContent>
          {uniqueColors.map((c) => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterSize || ""} onValueChange={(v) => setFilterSize(v || null)}>
        <SelectTrigger className="h-6 text-[10px] w-full">
          <SelectValue placeholder="Размер" />
        </SelectTrigger>
        <SelectContent>
          {uniqueSizes.map((sz) => <SelectItem key={sz} value={sz!}>{sz}</SelectItem>)}
        </SelectContent>
      </Select>
      {/* Sort Option Select */}
      <div className="col-span-2">
        <Select value={sortOption || ""} onValueChange={(value) => setSortOption((value as 'size_season_color' | 'color_size' | 'season_size_color') || 'size_season_color')}>
          <SelectTrigger className="h-6 text-[10px] w-full">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="size_season_color">Размер, Сезон, Цвет</SelectItem>
            <SelectItem value="color_size">Цвет, Размер</SelectItem>
            <SelectItem value="season_size_color">Сезон, Размер, Цвет</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Button size="sm" variant="outline" className="text-[10px] h-6 w-full" onClick={onResetFilters}>
          <X size={10} className="mr-1" /> Сброс
        </Button>
      </div>
    </div>
  );
}