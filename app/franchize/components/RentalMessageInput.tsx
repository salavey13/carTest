"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { sendRentalMessage } from "../server-actions/rentals";

interface RentalMessageInputProps {
  rentalId: string;
  accentColor: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
}

export function RentalMessageInput({
  rentalId,
  accentColor,
  borderColor,
  textPrimary,
  textSecondary,
}: RentalMessageInputProps) {
  const { dbUser } = useAppContext();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isPending) return;
    if (!dbUser?.user_id) {
      toast.error("Нужна авторизация в Telegram WebApp.");
      return;
    }

    startTransition(async () => {
      const result = await sendRentalMessage(rentalId, message.trim(), dbUser.user_id);
      if (result.success) {
        toast.success("Сообщение отправлено владельцу");
        setMessage("");
      } else {
        toast.error(result.error || "Ошибка отправки");
      }
    });
  };

  if (!dbUser?.user_id) return null;

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Сообщение владельцу..."
        disabled={isPending}
        className="flex-1 rounded-xl border bg-transparent px-3 py-2 text-sm outline-none transition placeholder:text-xs disabled:opacity-50"
        style={{
          borderColor,
          color: textPrimary,
        }}
      />
      <button
        type="submit"
        disabled={isPending || !message.trim()}
        className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: accentColor, color: "#16130A" }}
      >
        <Send className="h-3.5 w-3.5" />
        <span className="max-sm:sr-only">Отпр.</span>
      </button>
    </form>
  );
}
