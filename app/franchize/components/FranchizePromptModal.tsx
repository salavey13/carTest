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
      <DialogContent className="border-white/20 bg-zinc-950/95 text-white backdrop-blur-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-zinc-300">Укажи название и подтверди действие.</DialogDescription>
        </DialogHeader>

        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="border-white/20 bg-zinc-900/70 text-white"
          autoFocus
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            className="bg-amber-400 text-black hover:bg-amber-300"
            onClick={() => onSubmit(value)}
          >
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
