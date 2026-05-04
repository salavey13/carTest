"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type FranchizeConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
  confirmDisabled?: boolean;
};

export function FranchizeConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  variant = "default",
  confirmDisabled = false,
}: FranchizeConfirmModalProps) {
  const confirmClass =
    variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-400"
      : "bg-amber-400 text-black hover:bg-amber-300 focus-visible:ring-amber-400";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="border-white/20 bg-zinc-950/95 text-white backdrop-blur-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-zinc-300">{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button type="button" className={confirmClass} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
