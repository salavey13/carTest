// /hooks/useWorker.ts
"use client";
import { useEffect, useRef, useState } from "react";
import { debugLogger } from "@/lib/debugLogger";
import { pipeline } from "@huggingface/transformers";

const workerCode = `
  importScripts('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js');
  let transformerPipeline = null;

  const initTransformer = async () => {
    if (!transformerPipeline) {
      try {
        transformerPipeline = await pipeline("feature-extraction", "Supabase/gte-small", { quantized: true });
        self.postMessage({ status: "ready" });
      } catch (error) {
        self.postMessage({ status: "error", error: error.message });
      }
    }
  };

  self.onmessage = async (event) => {
    try {
      if (event.data.type === "init") {
        await initTransformer();
        return;
      }

      if (!transformerPipeline) throw new Error("Transformer not initialized");

      if (event.data.type === "embed") {
        const output = await transformerPipeline(event.data.text, {
          pooling: "mean",
          normalize: true,
        });
        const embedding = Array.from(output.data);
        if (embedding.length !== 384) throw new Error("Invalid embedding dimensions");
        self.postMessage({ status: "complete", embedding });
      }
    } catch (error) {
      self.postMessage({ status: "error", error: error.message });
    }
  };
`;

export function useWorker() {
  const blenderRef = useRef<Worker>();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const blob = new Blob([workerCode], { type: "text/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));
      workerRef.current = worker;

      worker.onmessage = (e) => {
        if (e.data.status === "ready") {
          setIsInitialized(true);
          debugLogger.log("Worker initialized successfully");
        }
      };

      worker.postMessage({ type: "init" });

      return () => {
        if (workerRef.current) {
          workerRef.current.terminate();
          URL.revokeObjectURL(URL.createObjectURL(blob));
          workerRef.current = undefined;
          setIsInitialized(false);
        }
      };
    } catch (error) {
      debugLogger.error("Worker initialization failed:", error);
      setIsInitialized(false);
    }
  }, []);

  const generateEmbedding = async (text: string): Promise<number[]> => {
    if (!workerRef.current || !isInitialized) throw new Error("Worker not initialized");

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Embedding generation timed out")), 30000);
      workerRef.current!.onmessage = (e) => {
        clearTimeout(timeoutId);
        if (e.data.status === "complete" && Array.isArray(e.data.embedding)) {
          resolve(e.data.embedding);
        } else if (e.data.status === "error") {
          reject(new Error(e.data.error));
        } else {
          reject(new Error("Invalid embedding generated"));
        }
      };
      workerRef.current!.postMessage({ type: "embed", text });
    });
  };

  return { generateEmbedding, isInitialized };
}

