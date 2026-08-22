import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

interface VprDescriptionProps {
  description: string | undefined | null;
  show: boolean;
}

export function VprDescription({ description, show }: VprDescriptionProps) {
  return (
    <AnimatePresence>
      {show && description && (
        <motion.div
          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
          animate={{ height: 'auto', opacity: 1, marginBottom: '1.5rem' }}
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="p-4 bg-dark-bg rounded-lg border border-brand-purple/30 prose prose-sm md:prose-base max-w-none prose-invert prose-headings:text-brand-cyan prose-a:text-brand-blue prose-strong:text-light-text/90">
            <ReactMarkdown>{description}</ReactMarkdown>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}