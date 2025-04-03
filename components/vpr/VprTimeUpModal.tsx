import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface VprTimeUpModalProps {
  show: boolean;
  onConfirm: () => void;
}

export function VprTimeUpModal({ show, onConfirm }: VprTimeUpModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-dark-card p-6 rounded-lg shadow-xl text-center max-w-sm border-t-4 border-brand-pink text-light-text"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring' }}
          >
            <AlertTriangle className="h-12 w-12 text-brand-pink mx-auto mb-4" />
            <h3 className="text-xl font-bold text-light-text mb-2">Время вышло!</h3>
            <p className="text-light-text/80 mb-5">К сожалению, время, отведенное на тест, истекло.</p>
            <button
              onClick={onConfirm}
              className="w-full bg-brand-pink text-white px-4 py-2 rounded-md font-semibold hover:bg-brand-pink/80 transition-colors"
            >
              Посмотреть результаты
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}