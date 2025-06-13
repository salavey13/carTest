import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import TutorialLoader from '../tutorials/TutorialLoader';

// Dynamic import of the client component with ssr: false
const HotVibesClientContent = dynamic(
  () => import('./HotVibesClientContent'),
  { 
    ssr: false, // This is the key to preventing server-side rendering issues
    loading: () => <TutorialLoader message="Загрузка Кибер-Пространства..." /> 
  }
);

// The page component is now a simple server component wrapper.
export default function HotVibesPage() {
  return (
    <Suspense fallback={<TutorialLoader message="Инициализация VIBE-пространства..." />}>
      <HotVibesClientContent />
    </Suspense>
  );
}