"use client";
import { motion } from "framer-motion";

interface VideoUploadProgressProps {
  progress: number;
}

export function VideoUploadProgress({ progress }: VideoUploadProgressProps) {
  return (
    <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
      <motion.div 
        className="bg-blue-600 h-4 rounded-full" 
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-xs text-white text-center pt-0.5">
          {Math.round(progress)}%
        </div>
      </motion.div>
    </div>
  );
}