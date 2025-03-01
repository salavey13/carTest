"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { sendDonationInvoice } from "@/app/actions";
import { useTelegram } from "@/hooks/useTelegram";

export default function DonationComponent() {
  const { dbUser } = useTelegram();
  const [tipAmount, setTipAmount] = useState("10");
  const [feedbackText, setFeedbackText] = useState("");

  const handleDoubleIt = () => {
    setTipAmount((prev) => String(parseInt(prev) * 2));
  };

  const handleDonate = async () => {
    if (!dbUser) {
      alert("Please log in with Telegram first!");
      return;
    }

    const amount = parseInt(tipAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid donation amount!");
      return;
    }

    const result = await sendDonationInvoice(dbUser.user_id, amount, feedbackText);
    if (result.success) {
      alert("Donation invoice sent! Please check your Telegram to complete the payment.");
    } else {
      alert(`Oops, something went wrong: ${result.error}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <motion.div
        className="p-10 bg-gray-800 rounded-xl shadow-2xl max-w-md w-full"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <h2 className="text-5xl font-extrabold text-white mb-8 text-center tracking-tight">
          Support Leha!
        </h2>

        {/* Feedback Input */}
        <motion.input
          type="text"
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Say something nice to Leha!"
          className="w-full p-4 mb-6 rounded-lg border border-gray-600 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          whileFocus={{ borderColor: "#10B981", scale: 1.02 }}
          transition={{ duration: 0.3 }}
        />

        {/* Tip Amount and Double It */}
        <div className="flex items-center mb-8">
          <motion.input
            type="number"
            value={tipAmount}
            onChange={(e) => setTipAmount(e.target.value)}
            min="1"
            className="w-28 p-4 rounded-lg border border-gray-600 bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-green-500 mr-4"
            whileFocus={{ borderColor: "#10B981", scale: 1.02 }}
            transition={{ duration: 0.3 }}
          />
          <motion.button
            onClick={handleDoubleIt}
            className="px-5 py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9, rotate: -5 }}
            transition={{ duration: 0.2 }}
          >
            Double It!
          </motion.button>
        </div>

        {/* Send Stars Button */}
        <motion.button
          onClick={handleDonate}
          className="w-full px-8 py-5 bg-green-500 text-white text-2xl font-bold rounded-xl hover:bg-green-600"
          whileHover={{ scale: 1.05, backgroundColor: "#34D399" }}
          whileTap={{ scale: 0.95 }}
          initial={{ boxShadow: "0 0 15px rgba(16, 185, 129, 0.5)" }}
          animate={{ boxShadow: "0 0 25px rgba(16, 185, 129, 0.9)" }}
          transition={{ repeat: Infinity, duration: 1.2, repeatType: "reverse" }}
        >
          Send Stars! ✨
        </motion.button>
      </motion.div>
    </div>
  );
}
