import React, { Suspense } from 'react';
import TutorialLoader from '../tutorials/TutorialLoader';
import HotVibesClientContent from './HotVibesClientContent';

export default function HotVibesPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  return (
    <Suspense fallback={<TutorialLoader message="Загрузка Кибер-Пространства..." />}>
      <HotVibesClientContent searchParams={searchParams} />
    </Suspense>
  );
}