"use client";
import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import AICodeAssistant from "@/components/AICodeAssistant";
import { FaRobot, FaFileCode, FaCode } from "react-icons/fa";

const PathHandler: React.FC = () => {
  const searchParams = useSearchParams();
  const path = searchParams.get("path");

  return (
    <>
      {path && (
        <p className="text-yellow-400 mb-6 text-center">
          Fixing files related to <strong>{path}</strong>
        </p>
      )}
      <section id="extractor" className="mb-12 w-full max-w-2xl">
        <RepoTxtFetcher highlightedPath={path || ""} autoFetch={!!path} />
      </section>
      <section id="step2" className="mb-12 text-center max-w-2xl">
        <h2 className="text-2xl font-semibold mb-2">Step 2: Execute Your Request</h2>
        <p>Paste the extracted content into the executor below.</p>
      </section>
      <section id="executor" className="mb-12 w-full max-w-2xl pb-16">
        <AICodeAssistant />
      </section>
    </>
  );
};

export default function RepoXmlPage() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    } else {
      console.error(`Element with id "${id}" not found.`);
    }
  };

  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      <div className="min-h-screen bg-gray-900 p-6 pt-24 text-white flex flex-col items-center relative overflow-y-auto">
        <section id="intro" className="mb-12 text-center max-w-2xl">
          <h1 className="text-4xl font-bold mb-4">Repo XML</h1>
          <p className="text-lg">Extract and process repository contents with ease.</p>
        </section>
        <section id="step1" className="mb-12 text-center max-w-2xl">
          <h2 className="text-2xl font-semibold mb-2">Step 1: Formulate Your Request</h2>
          <p>Define what you need from the repository.</p>
        </section>
        <Suspense fallback={<div className="text-white">Loading...</div>}>
          <PathHandler />
        </Suspense>
        <nav className="fixed right-2 top-1/2 transform -translate-y-1/2 flex flex-col space-y-4 z-13">
          <button
            onClick={() => scrollToSection("intro")}
            className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition"
            title="Introduction"
          >
            <FaCode className="text-lg" />
          </button>
          <button
            onClick={() => scrollToSection("step1")}
            className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition"
            title="Step 1: Request"
          >
            <FaFileCode className="text-lg" />
          </button>
          <button
            onClick={() => scrollToSection("extractor")}
            className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition"
            title="Code Extractor"
          >
            <FaRobot className="text-lg" />
          </button>
          <button
            onClick={() => scrollToSection("step2")}
            className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition"
            title="Step 2: Execution"
          >
            <FaFileCode className="text-lg" />
          </button>
          <button
            onClick={() => scrollToSection("executor")}
            className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition"
            title="Code Executor"
          >
            <FaRobot className="text-lg" />
          </button>
        </nav>
      </div>
    </>
  );
}