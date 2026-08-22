"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FranchizePromptModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
};

export function FranchizePromptModal({
  open,
  onClose,
  onSubmit,
  title,
  placeholder = "Введите значение",
  defaultValue = "",
}: FranchizePromptModalProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
    }
  }, [open, defaultValue]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="border-[var(--dialog-border)] bg-[var(--dialog-bg)] text-[var(--dialog-text)] backdrop-blur-md" style={
        {
          "--dialog-border": "hsl(var(--border))",
          "--dialog-bg": "hsl(var(--background))",
          "--dialog-text": "hsl(var(--foreground))",
        } as React.CSSProperties
      }>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[var(--dialog-muted)]" style={
            {
              "--dialog-muted": "hsl(var(--muted-foreground))",
            } as React.CSSProperties
          }>Укажи название и подтверди действие.</DialogDescription>
        </DialogHeader>

        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          autoFocus
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            className="bg-amber-400 text-black hover:bg-amber-300 focus-visible:ring-amber-400"
            onClick={() => onSubmit(value)}
          >
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
