"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { sendDonationInvoice } from "@/app/actions";
import { useTelegram } from "@/hooks/useTelegram";

export default function DonationComponent() {
  const { dbUser } = useTelegram();
  const [starAmount, setStarAmount] = useState("10");
  const [feedbackText, setFeedbackText] = useState("");
  const [showDoubleButton, setShowDoubleButton] = useState(false);

  const handleDoubleIt = () => {
    setStarAmount((prev) => {
      const num = parseInt(prev);
      return isNaN(num) ? "10" : String(num * 2);
    });
  };

  const handleDonate = async () => {
    if (!dbUser) {
      alert("Пожалуйста, сначала войдите через Telegram!");
      return;
    }

    const amount = parseInt(starAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Пожалуйста, введите действительную сумму пожертвования!");
      return;
    }

    const result = await sendDonationInvoice(dbUser.user_id, amount, feedbackText);
    if (result.success) {
      alert("Счет на пожертвование отправлен! Пожалуйста, проверьте ваш Telegram, чтобы завершить платеж.");
    } else {
      alert(`Упс, что-то пошло не так: ${result.error}`);
    }
  };

  return (
    <div className="min-h-screen pt-24 flex items-center justify-center bg-[hsl(var(--background))] bg-grid-pattern">
      <motion.div
        className="p-10 bg-[hsl(var(--card))] rounded-xl shadow-2xl max-w-md w-full border border-[hsl(var(--border))]"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <h2 className="text-4xl font-extrabold text-[hsl(var(--foreground))] mb-4 text-center tracking-tight cyber-text">
          Поддержите команду Tupabase!
        </h2>
        <p className="text-lg text-[hsl(var(--muted-foreground))] mb-8 text-center text-gradient">
          Ваша поддержка творит чудеса для нашего проекта!
        </p>

        {/* Feedback Input */}
        <motion.input
          type="text"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Скажите что-нибудь приятное команде Tupabase!"
          className="w-full p-4 mb-6 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--input))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] placeholder-[hsl(var(--muted-foreground))]"
          whileFocus={{ boxShadow: "0 0 10px hsl(var(--ring))", scale: 1.02 }}
          transition={{ duration: 0.3 }}
        />

        {/* Star Amount and Double It */}
        <div className="flex items-center mb-8">
          <motion.input
            type="number"
            value={starAmount}
            onChange={(e) => setStarAmount(e.target.value)}
            onBlur={() => setShowDoubleButton(true)}
            min="1"
            className="w-28 p-4 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--input))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] mr-4"
            whileFocus={{ boxShadow: "0 0 10px hsl(var(--ring))", scale: 1.02 }}
            transition={{ duration: 0.3 }}
          />
          {showDoubleButton && (
            <motion.button
              onClick={handleDoubleIt}
              className="px-5 py-3 bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] font-semibold rounded-lg hover:bg-[hsl(var(--accent),0.8)]"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9, rotate: -5 }}
            >
              x2!
            </motion.button>
          )}
        </div>

        {/* Send Stars Button */}
        <motion.button
          onClick={handleDonate}
          className="w-full px-8 py-5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-2xl font-bold rounded-xl hover:bg-[hsl(var(--primary),0.8)] cyber-text"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ boxShadow: "0 0 15px hsl(var(--ring))" }}
          animate={{ boxShadow: "0 0 25px hsl(var(--ring))" }}
          transition={{ repeat: Infinity, duration: 1.2, repeatType: "reverse" }}
        >
          Отправить звезды! ✨
        </motion.button>
      </motion.div>
    </div>
  );
}
