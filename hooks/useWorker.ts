"use client"

// hooks/useWorker.ts
import { useEffect, useRef } from "react"

export function useWorker() {
  if (typeof window === "undefined") {
    // ✅ Prevent execution in SSR, return a no-op function
    return {
      generateEmbedding: async () => {
        console.warn("⚠️ useWorker is running on the server. Returning empty embedding.")
        return []
      },
    }
  }

  const workerRef = useRef<Worker>()

  useEffect(() => {
    workerRef.current = new Worker(new URL("../workers/embedding.worker.ts", import.meta.url))

    return () => workerRef.current?.terminate()
  }, [])

  const generateEmbedding = async (text: string) => {
    return new Promise<number[]>((resolve) => {
      if (!workerRef.current) {
        console.error("💥 Web Worker not initialized!")
        return resolve([])
      }

      workerRef.current.onmessage = (e) => {
        if (e.data.status === "complete") resolve(e.data.embedding)
      }
      workerRef.current.postMessage({ text })
    })
  }

  return { generateEmbedding }
}

