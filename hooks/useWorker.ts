// hooks/useWorker.ts
import { useEffect, useRef } from 'react';

export function useWorker() {
  const workerRef = useRef<Worker>();

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/embedding.worker.ts', import.meta.url)
    );
    
    return () => workerRef.current?.terminate();
  }, []);

  const generateEmbedding = async (text: string) => {
    return new Promise<number[]>((resolve) => {
      workerRef.current!.onmessage = (e) => {
        if (e.data.status === 'complete') resolve(e.data.embedding);
      };
      workerRef.current!.postMessage({ text });
    });
  };

  return { generateEmbedding };
}

