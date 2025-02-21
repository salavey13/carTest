"use client"

import { useEffect, useRef, useState } from "react"
import { debugLogger } from "@/lib/debugLogger"

// Using a simpler embedding approach for preview/testing
const workerCode = `
  // Simple cosine similarity based embedding generator
  function generateSimpleEmbedding(text) {
    const words = text.toLowerCase().split(/\\s+/);
    const vector = new Array(384).fill(0);
    
    // Generate a deterministic embedding based on word hashing
    words.forEach((word, i) => {
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(j);
        hash = hash & hash;
      }
      
      // Distribute the hash across the vector
      const pos = Math.abs(hash) % 384;
      vector[pos] = Math.sin(hash); // Normalize to [-1, 1]
    });
    
    // Normalize the vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => magnitude ? val / magnitude : 0);
  }

  self.onmessage = async (event) => {
    try {
      if (event.data.type === "init") {
        self.postMessage({ status: "ready" });
        return;
      }
  
      if (event.data.type === "embed") {
        const embedding = generateSimpleEmbedding(event.data.text);
        
        if (!embedding || embedding.length === 0) {
          throw new Error("Generated embedding is empty");
        }
  
        if (embedding.length !== 384) {
          throw new Error("Invalid embedding dimensions: " + embedding.length);
        }
  
        self.postMessage({
          status: "complete",
          embedding,
        });
      }
    } catch (error) {
      self.postMessage({
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };
`

export function useWorker() {
  const [isInitialized, setIsInitialized] = useState(false)
  const workerRef = useRef<Worker>()

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const blob = new Blob([workerCode], { type: "text/javascript" })
      const worker = new Worker(URL.createObjectURL(blob))

      worker.onerror = (error) => {
        debugLogger.error("Worker error:", error)
        setIsInitialized(false)
      }

      worker.onmessage = (e) => {
        if (e.data.status === "ready") {
          setIsInitialized(true)
          debugLogger.log("Worker initialized successfully")
        }
      }

      workerRef.current = worker
      worker.postMessage({ type: "init" })

      return () => {
        if (workerRef.current) {
          workerRef.current.terminate()
          URL.revokeObjectURL(URL.createObjectURL(blob))
          workerRef.current = undefined
          setIsInitialized(false)
        }
      }
    } catch (error) {
      debugLogger.error("Worker initialization failed:", error)
      setIsInitialized(false)
    }
  }, [])

  const generateEmbedding = async (text: string): Promise<number[]> => {
    if (!workerRef.current || !isInitialized) {
      throw new Error("Worker not initialized")
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Embedding generation timed out"))
      }, 30000)

      workerRef.current!.onmessage = (e) => {
        clearTimeout(timeoutId)
        if (e.data.status === "complete" && Array.isArray(e.data.embedding) && e.data.embedding.length === 384) {
          resolve(e.data.embedding)
        } else if (e.data.status === "error") {
          reject(new Error(e.data.error))
        } else {
          reject(new Error("Invalid embedding generated"))
        }
      }

      try {
        workerRef.current!.postMessage({ type: "embed", text })
      } catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  return { generateEmbedding, isInitialized }
}

