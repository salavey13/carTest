import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import TutorialLoader from '../tutorials/TutorialLoader';

// Dynamic import of the client component with ssr: false
const HotVibesClientContent = dynamic(
  () => import('./HotVibesClientContent'),
  { 
    ssr: false, // This is the key to preventing server-side rendering issues
    loading: () => <TutorialLoader message="Инициализация VIBE-пространства..." /> 
  }
);

// The page component is now a simple server component wrapper.
// It no longer needs searchParams as the client component will handle it.
export default function HotVibesPage() {
  return (
    <Suspense fallback={<TutorialLoader message="Загрузка Кибер-Пространства..." />}>
      <HotVibesClientContent />
    </Suspense>
  );
}