"use client"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Button } from "@/components/ui/button";

interface FilterAccordionProps {
  filterSeason: string | null;
  setFilterSeason: (v: string | null) => void;
  filterPattern: string | null;
  setFilterPattern: (v: string | null) => void;
  filterColor: string | null;
  setFilterColor: (v: string | null) => void;
  filterSize: string | null;
  setFilterSize: (v: string | null) => void;
  items: any[];
  onResetFilters: () => void; // Добавлен пропс для сброса
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
}: FilterAccordionProps) {
  const uniqueSeasons = [...new Set(items.map((i) => i.season).filter(Boolean))];
  const uniquePatterns = [...new Set(items.map((i) => i.pattern).filter(Boolean))];
  const uniqueColors = [...new Set(items.map((i) => i.color).filter(Boolean))];
  const uniqueSizes = [...new Set(items.map((i) => i.size).filter(Boolean))];

  return (
    <Accordion type="single" collapsible className="p-2">
      <AccordionItem value="filters">
        <AccordionTrigger className="text-sm"><VibeContentRenderer content="::fa-filter:: Фильтры" /></AccordionTrigger>
        <AccordionContent className="grid grid-cols-2 gap-2">
          <Select value={filterSeason || ""} onValueChange={(v) => setFilterSeason(v || null)}>
            <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Сезон" /></SelectTrigger>
            <SelectContent>{uniqueSeasons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterPattern || ""} onValueChange={(v) => setFilterPattern(v || null)}>
            <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Узор" /></SelectTrigger>
            <SelectContent>{uniquePatterns.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterColor || ""} onValueChange={(v) => setFilterColor(v || null)}>
            <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Цвет" /></SelectTrigger>
            <SelectContent>{uniqueColors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterSize || ""} onValueChange={(v) => setFilterSize(v || null)}>
            <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Размер" /></SelectTrigger>
            <SelectContent>{uniqueSizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={onResetFilters} className="col-span-2 text-[10px]"><VibeContentRenderer content="::fa-arrows-rotate:: Сброс" /></Button>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="instructions">
        <AccordionTrigger className="text-sm"><VibeContentRenderer content="::fa-book:: Инструкция" /></AccordionTrigger>
        <AccordionContent className="text-[10px] space-y-1">
          <ol className="list-decimal pl-4">
            <li><strong>Чекпоинт:</strong> Фиксирует состояние перед работой.</li>
            <li><strong>Режимы:</strong> Свет (приемка): клик + кол-во. Тьма (отгрузка): импорт CSV, подсветка, клик -1, "Нет в наличии".</li>
            <li><strong>Импорт:</strong> CSV (Артикул,Количество,Ячейка опц). Пошагово.</li>
            <li><strong>Экспорт диффа:</strong> Изменения от чекпоинта в CSV для WB/Ozon.</li>
            <li><strong>Экспорт стока:</strong> Текущий склад в CSV.</li>
            <li><strong>Синх:</strong> Загружайте в панели WB/Ozon. Для B полок уведомление если ниже мин.</li>
            <li><strong>Игра:</strong> Очки, стрики, ачивки, босс для крупных импорт.</li>
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}