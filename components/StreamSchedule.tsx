"use client";
import React from "react";
import SaunaOccupancyChart from "./SaunaOccupancyChart";

type ScheduleItem = {
  id: string;
  date: string; // yyyy-mm-dd
  startHour: number;
  durationHours: number;
  title?: string;
};

export default function StreamSchedule({ items, date }: { items: ScheduleItem[]; date?: string; }) {
  // переиспользуем ваш компонент, просто мапируем поля
  const bookings = items.map(i => ({
    id: i.id,
    date: i.date,
    startHour: i.startHour,
    durationHours: i.durationHours,
    extras: [i.title || "Стрим"]
  }));
  return <SaunaOccupancyChart bookings={bookings} date={date} title="График стримов" />;
}