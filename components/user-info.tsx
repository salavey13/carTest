"use client";
import { useState, useEffect } from "react";
import { User, Bot, Trophy, Car, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTelegram } from "@/hooks/useTelegram";
import { motion } from "framer-motion";

export default function UserInfo() {
  const { dbUser, user, isInTelegramContext, isMockUser, isLoading, error } = useTelegram();
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (dbUser || user)) setIsFirstLoad(false);
  }, [isLoading, dbUser, user]);

  if (isLoading) {
    return (
      <div className="w-12 h-12 bg-muted rounded-full animate-pulse shadow-[0_0_15px_rgba(255,107,107,0.3)]" />
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-destructive font-mono text-sm animate-[neon_2s_infinite]"
      >
        Ошибка, пиздец!
      </motion.div>
    );
  }

  const telegramUser = dbUser || user;
  if (!telegramUser) {
    return (
      <button
        className="p-2 rounded-full text-primary hover:text-primary/80 bg-muted/20 hover:bg-muted/40 transition-all shadow-[0_0_10px_rgba(255,107,107,0.3)]"
      >
        <User className="h-6 w-6" />
      </button>
    );
  }

  const displayName = telegramUser.username || telegramUser.full_name || telegramUser.first_name || "Юзер";

  return (
    <motion.div
      className="relative flex items-center gap-2 p-2 rounded-xl hover:shadow-[0_0_20px_rgba(255,107,107,0.5)] transition-all"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className="relative group cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        {dbUser?.avatar_url ? (
          <Image
            src={dbUser.avatar_url}
            alt="Аватар"
            width={44}
            height={44}
            className="rounded-full border-2 border-primary shadow-[0_0_12px_rgba(255,107,107,0.5)] group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-11 h-11 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-primary-foreground font-mono text-lg shadow-[0_0_15px_rgba(255,107,107,0.5)] group-hover:scale-105 transition-transform duration-300">
            {getInitials(displayName)}
          </div>
        )}
        {isInTelegramContext && (
          <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[10px] px-1 rounded-full shadow-sm">TG</span>
        )}
        {isMockUser && (
          <Bot className="absolute -bottom-1 -right-1 h-4 w-4 text-accent shadow-[0_0_6px_rgba(255,215,0,0.5)]" />
        )}
      </div>

      <span className="text-primary font-mono text-sm md:text-base truncate max-w-[120px] md:max-w-[160px] text-glow">
        {isFirstLoad ? (
          Array.from(displayName).map((char, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {char}
            </motion.span>
          ))
        ) : (
          displayName
        )}
      </span>

      {/* Modal */}
      {isModalOpen && (
        <motion.div
          className="fixed inset-0 top-[10%] z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsModalOpen(false)}
        >
          <motion.div
            className="bg-card p-6 rounded-2xl shadow-[0_0_25px_rgba(255,107,107,0.5)] border border-muted max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            transition={{ type: "spring", stiffness: 100 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-xl text-primary font-mono text-glow">{displayName}</p>
                {dbUser?.user_id && (
                  <p className="text-sm text-muted-foreground font-mono">ID: {dbUser.user_id}</p>
                )}
              </div>
              <Link href="/invoices" onClick={() => setIsModalOpen(false)}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-primary to-secondary p-4 rounded-lg flex items-center gap-4"
                >
                  <Trophy className="h-8 w-8 text-primary-foreground" />
                  <div>
                    <p className="text-primary-foreground font-mono font-bold">Зал Славы</p>
                    <p className="text-sm text-primary-foreground/80 font-mono">
                      Чекни свои подвиги и бабки в неоне!
                    </p>
                  </div>
                </motion.div>
              </Link>
              <Link href="/cyber-garage" onClick={() => setIsModalOpen(false)}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-gradient-to-r from-muted to-primary p-4 rounded-lg flex items-center gap-4"
                >
                  <Lock className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-primary font-mono font-bold">Кибер-Гараж</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      Секретный ангар для настоящих гонщиков!
                    </p>
                  </div>
                </motion.div>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}
