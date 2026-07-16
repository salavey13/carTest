"use client";

import { Users, Filter } from "lucide-react";

export function EmptyState({ hasFilters, T }: { hasFilters: boolean; T: any }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border p-12 text-center" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: T.borderSoft }}>
        {hasFilters ? <Filter className="h-9 w-9" style={{ color: T.textFaint }} /> : <Users className="h-9 w-9" style={{ color: T.textFaint }} />}
      </div>
      <p className="text-base font-bold" style={{ color: T.text }}>{hasFilters ? "Ничего не найдено" : "Пока нет заявок"}</p>
      <p className="mt-1 max-w-xs text-sm" style={{ color: T.textFaint }}>
        {hasFilters ? "Попробуйте изменить фильтры или сбросить поиск" : "Новые заявки появятся здесь автоматически"}
      </p>
    </div>
  );
}