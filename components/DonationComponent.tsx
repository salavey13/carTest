"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { sendDonationInvoice } from "@/app/actions";
import { useTelegram } from "@/hooks/useTelegram";
import Footer from "@/components/Footer";

export default function DonationComponent() {
  const { dbUser } = useTelegram();
  const [starAmount, setStarAmount] = useState("10");
  const [feedbackText, setFeedbackText] = useState("");
  const [showDoubleButton, setShowDoubleButton] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal

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

  // "How-To" Guide Content
  const setupGuide = (
    <div>
      <p className="text-xl font-bold mb-2">
        Want to set up your own donation page in minutes? Here’s how!
      </p>
      <p className="mb-4">
        This is the easiest way to get your donation page live and start collecting stars—legally and tax-free!
      </p>

      <h3 className="text-2xl font-semibold mb-2">Quick Version</h3>
      <ol className="list-decimal ml-6 mb-4">
        <li>Create a blank GitHub repo.</li>
        <li>
          Fork the template from{" "}
          <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">
            t.me/oneSitePlsBot/tips
          </a>.
        </li>
        <li>Log into v0 with GitHub.</li>
        <li>Deploy to Vercel.</li>
        <li>Add secrets in Vercel.</li>
        <li>Redeploy.</li>
        <li>Activate webhook (subscription or Supabase).</li>
        <li>Set up web app in BotFather.</li>
        <li>Pin the message in Telegram.</li>
      </ol>

      <h3 className="text-2xl font-semibold mb-2">Full Guide</h3>
      <p>
        <strong>Step 1: Create a blank GitHub repo.</strong> This is your project’s home.
      </p>
      <p>
        <strong>Step 2: Fork the template.</strong> Head to{" "}
        <a href="t.me/oneSitePlsBot/tips" className="text-blue-500 underline">
          t.me/oneSitePlsBot/tips
        </a>
        , find "Проект v0 + donate" in the footer, and fork it.
      </p>
      <p>
        <strong>Step 3: Log into v0.</strong> Use your GitHub account to access the dashboard.
      </p>
      <p>
        <strong>Step 4: Deploy to Vercel.</strong> Connect your repo and deploy to get a URL (e.g.,{" "}
        <code>v0-donate.vercel.app</code>).
      </p>
      <p>
        <strong>Step 5: Add secrets.</strong> In Vercel settings, add{" "}
        <code>TELEGRAM_BOT_TOKEN</code>, <code>ADMIN_CHAT_ID</code>, and <code>VERCEL_URL</code>.
      </p>
      <p>
        <strong>Step 6: Redeploy.</strong> This applies your secrets.
      </p>
      <p>
        <strong>Step 7: Activate webhook.</strong> In the admin UI, set the webhook to{" "}
        <code>v0-donate.vercel.app/api/telegramWebhook</code>. (Note: Needs subscription or Supabase setup.)
      </p>
      <p>
        <strong>Step 8: Set up web app.</strong> In BotFather, link your Vercel URL as a Telegram web app.
      </p>
      <p>
        <strong>Step 9: Pin the message.</strong> Pin a message in Telegram with your web app link (e.g.,{" "}
        <code>t.me/oneSitePlsBot/tips</code>) and a cool image.
      </p>

      <h3 className="text-2xl font-semibold mb-2">Recap</h3>
      <p>
        Create repo → Fork template → Log in → Deploy → Add secrets → Redeploy → Activate webhook → Set up
        web app → Pin message. Boom—you’re live!
      </p>
      <p className="mt-4 font-bold">Ready? Follow these steps and start collecting stars today!</p>
    </div>
  );

  return (
    <>
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

          {/* Guide Button */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] underline"
            >
              Learn how to set up your own donation page
            </button>
          </div>
        </motion.div>
      </div>

      {/* Modal for the Guide */}
      {isModalOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsModalOpen(false)} // Close on backdrop click
        >
          <motion.div
            className="bg-[hsl(var(--card))] p-8 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-[hsl(var(--border))]"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            <h2 className="text-3xl font-bold mb-4 text-[hsl(var(--foreground))]">
              How to Set Up Your Own Donation Page
            </h2>
            {setupGuide}
            <button
              onClick={() => setIsModalOpen(false)}
              className="mt-6 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:bg-[hsl(var(--primary),0.8)]"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}

      <Footer />
    </>
  );
}
