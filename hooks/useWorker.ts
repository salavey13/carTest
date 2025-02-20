"use client"

import { useEffect, useRef, useState } from "react"
import { debugLogger } from "@/lib/debugLogger"

export function useWorker() {
  const [isInitialized, setIsInitialized] = useState(false)
  const workerRef = useRef<Worker>()

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const worker = new Worker("/workers/embedding.worker.js")

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
      }, 30000) // Reduced timeout to 30s for faster feedback

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

