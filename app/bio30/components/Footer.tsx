"use client";

import React from "react";
import Link from "next/link";

const Footer: React.FC = () => {
  const docBase = "https://bio30.ru/docs";

  return (
    <footer className="mt-auto bg-card border-t border-border/50">
      <div className="max-w-6xl mx-auto px-6 py-12 grid sm:grid-cols-2 md:grid-cols-3 gap-8 text-sm">
        <div>
          <h3 className="font-semibold mb-3 text-foreground/80">РЕГИОН</h3>
          <p className="text-muted-foreground mb-2">Россия</p>
          <div className="flex gap-3">
            <span className="cursor-pointer text-muted-foreground hover:text-primary">Русский</span>
            <span className="cursor-pointer text-muted-foreground hover:text-primary">English</span>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3 text-foreground/80">ЗАРАБОТАТЬ</h3>
          <Link href="/bio30/referal" className="block text-muted-foreground hover:text-primary">
            Общая информация
          </Link>
          <Link href="/profile" className="block text-muted-foreground hover:text-primary">
            Мой кабинет
          </Link>
        </div>

        <div className="hidden sm:block">
          <h3 className="font-semibold mb-3 text-foreground/80">ДОКУМЕНТЫ</h3>
          {["data", "gdpr", "confidencial", "policy", "info", "payment", "returns"].map((doc) => (
            <a
              key={doc}
              href={`${docBase}/${doc}`}
              className="block text-muted-foreground hover:text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {doc.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      <div className="border-t border-border/30 py-4 text-center text-xs text-muted-foreground">
        © 2025 BIO 3.0 — все права защищены.
      </div>
    </footer>
  );
};

export default Footer;