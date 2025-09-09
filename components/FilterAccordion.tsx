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
}: FilterAccordionProps) {
  const uniqueSeasons = Array.from(new Set(items.map((i) => i.season).filter(Boolean)));
  const uniquePatterns = Array.from(new Set(items.map((i) => i.pattern).filter(Boolean)));
  const uniqueColors = Array.from(new Set(items.map((i) => i.color).filter(Boolean)));
  const uniqueSizes = Array.from(new Set(items.map((i) => i.size).filter(Boolean)));

  return (
    <div className="space-y-2">
      {includeSearch && (
        <Input
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-6 text-[10px] flex-1"
        />
      )}
      <Select value={filterSeason || ""} onValueChange={(v) => setFilterSeason(v || null)}>
        <SelectTrigger className="h-6 text-[10px]">
          <SelectValue placeholder="Сезон" />
        </SelectTrigger>
        <SelectContent>
          {uniqueSeasons.map((s) => <SelectItem key={s} value={s!}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterPattern || ""} onValueChange={(v) => setFilterPattern(v || null)}>
        <SelectTrigger className="h-6 text-[10px]">
          <SelectValue placeholder="Узор" />
        </SelectTrigger>
        <SelectContent>
          {uniquePatterns.map((p) => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterColor || ""} onValueChange={(v) => setFilterColor(v || null)}>
        <SelectTrigger className="h-6 text-[10px]">
          <SelectValue placeholder="Цвет" />
        </SelectTrigger>
        <SelectContent>
          {uniqueColors.map((c) => <SelectItem key={c} value={c!}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterSize || ""} onValueChange={(v) => setFilterSize(v || null)}>
        <SelectTrigger className="h-6 text-[10px]">
          <SelectValue placeholder="Размер" />
        </SelectTrigger>
        <SelectContent>
          {uniqueSizes.map((sz) => <SelectItem key={sz} value={sz!}>{sz}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={onResetFilters}>
        <X size={10} className="mr-1" /> Сброс
      </Button>
    </div>
  );
}