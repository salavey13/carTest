"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";

export default function RepoXmlContent() {
  const searchParams = useSearchParams();
  const path = searchParams.get("path"); // Get the passed path
  const [highlightedFiles, setHighlightedFiles] = useState<string[]>([]);

  useEffect(() => {
    if (path) {
      const imports = getImportsForPath(path);
      setHighlightedFiles([path, ...imports]);
    }
  }, [path]);

  // Mock function to simulate import parsing (replace with real logic if available)
  function getImportsForPath(path: string): string[] {
    return [`/components/${path.split("/").pop()}.tsx`, "/lib/utils.ts"];
  }

  return (
    <>
      {path && (
        <p className="text-yellow-400 mb-6 text-center">
          Highlighting files related to <strong>{path}</strong>
        </p>
      )}
      <section id="extractor" className="mb-12 w-full max-w-2xl">
        <RepoTxtFetcher highlightedFiles={highlightedFiles} autoFetch={!!path} />
      </section>
      <section id="step2" className="mb-12 text-center max-w-2xl">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4">
          Шаг 2: Вставьте результат в Бота исполнителя
        </h2>
        <p className="text-gray-300 text-sm">
          После того как вы извлекли код и получили анализ от бота, скопируйте результат. Затем вставьте его ниже (или в Grok!), чтобы бот написал новый код - дальше создайте Pull Request на GitHub в клик. Всё готово для магии!
        </p>
      </section>
      <section id="executor" className="mb-12 w-full max-w-2xl pb-16">
        <AICodeAssistant />
      </section>
    </>
  );
}