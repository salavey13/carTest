"use client";

import React, { Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button'; // Assuming you have a Button component
import { FaTimes } from 'react-icons/fa';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  showConfirmButton?: boolean;
  showCancelButton?: boolean;
  confirmButtonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  cancelButtonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Отмена',
  showConfirmButton = true,
  showCancelButton = true,
  confirmButtonVariant = "default",
  cancelButtonVariant = "outline",
}) => {
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: { y: "-50%", opacity: 0, scale: 0.9 },
    visible: { y: "0%", opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
    exit: { y: "50%", opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={onClose} // Close on backdrop click
        >
          <motion.div
            className="bg-card text-foreground p-6 rounded-lg shadow-xl w-full max-w-md border border-border"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-primary">{title}</h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close modal"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="mb-6 text-sm text-muted-foreground">
              {children}
            </div>

            <div className="flex justify-end space-x-3">
              {showCancelButton && (
                <Button variant={cancelButtonVariant} onClick={onClose} className="font-mono">
                  {cancelText}
                </Button>
              )}
              {showConfirmButton && onConfirm && (
                <Button variant={confirmButtonVariant} onClick={onConfirm} className="font-mono">
                  {confirmText}
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;