// /workers/embedding.worker.ts
import { pipeline } from "@huggingface/transformers"

// Ensure we match the database vector dimensions (384)
const VECTOR_DIMENSIONS = 384
const MODEL_NAME = "Supabase/gte-small"
const MODEL_OPTIONS = { quantized: true }

importScripts('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js');

let transformerPipeline = null;

const initTransformer = async () => {
  if (!transformerPipeline) {
    try {
      transformerPipeline = await pipeline("feature-extraction", "Supabase/gte-small", { quantized: true });
      self.postMessage({ status: "ready" });
    } catch (error) {
      self.postMessage({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to initialize transformer"
      });
    }
  }
};

self.onmessage = async (event) => {
  try {
    if (event.data.type === "init") {
      await initTransformer();
      return;
    }

    if (!transformerPipeline) {
      throw new Error("Transformer not initialized");
    }

    if (event.data.type === "embed") {
      const output = await transformerPipeline(event.data.text, {
        pooling: "mean",
        normalize: true,
      });

      const embedding = Array.from(output.data);

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

