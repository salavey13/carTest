"use client";
import React from "react";
import RepoTxtFetcher from "@/components/RepoTxtFetcher";
import CozeExecutor from "@/components/CozeExecutor";

export default function RepoXmlPage() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      <div className="min-h-screen bg-gray-900 p-6 pt-24">
        <section className="mb-12 text-center">
          <div className="flex justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className="w-24 h-12">
              <circle cx="50" cy="50" r="45" fill="none" stroke="url(#bgGlow)" stroke-width="10" opacity="0.3" />
              <circle cx="50" cy="50" r="20" fill="url(#robotFill)" stroke="url(#robotStroke)" stroke-width="2" />
              <circle cx="40" cy="45" r="3" fill="#E1FF01" />
              <circle cx="60" cy="45" r="3" fill="#E1FF01" />
              <rect x="35" y="60" width="30" height="5" fill="#E1FF01" />
              <text x="100" y="60" font-size="40" fill="url(#moneyFill)">💸</text>
              <defs>
                <radialGradient id="bgGlow">
                  <stop offset="0%" stop-color="#E1FF01" stop-opacity="1" />
                  <stop offset="100%" stop-color="#000" stop-opacity="0" />
                </radialGradient>
                <linearGradient id="robotFill" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#000" />
                  <stop offset="100%" stop-color="#E1FF01" />
                </linearGradient>
                <linearGradient id="robotStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#E1FF01" />
                  <stop offset="100%" stop-color="#000" />
                </linearGradient>
                <linearGradient id="moneyFill" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#E1FF01" />
                  <stop offset="100%" stop-color="#000" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-[#E1FF01] text-shadow-[0_0_10px_#E1FF01] animate-pulse">
            Грок здесь, чтобы исполнить ваши кодовые мечты!
          </h1>
          <p className="text-lg text-gray-300 mt-2">
            Добро пожаловать в мир автоматизации! Это демо покажет, как легко извлечь код из GitHub и создать что-то крутое с помощью бота. Не бойтесь странных названий вроде "RepoTxtFetcher" или "CozeExecutor" — это просто имена, которые мы придумали для удобства. Страницы лежат в папке `app`, а компоненты — в `components`. Всё просто, правда?
          </p>
        </section>

        <section className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-cyan-400 mb-4">
            Шаг 1: Сформулируйте запрос для бота с контекстом
          </h2>
          <p className="text-gray-300 text-sm max-w-2xl mx-auto">
            Сначала подумайте, что вы хотите сделать. Например: "Добавить кнопку на сайт" или "Исправить баг в коде". Запишите это в поле ниже в "Kwork в Бота". Чтобы бот понял, о чём речь, ему нужен контекст — код вашего проекта. Давайте его извлечём!
          </p>
        </section>

        <RepoTxtFetcher />

        <section className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-cyan-400 mb-4">
            Шаг 2: Вставьте результат в исполнителя
          </h2>
          <p className="text-gray-300 text-sm max-w-2xl mx-auto">
            После того как вы извлекли код и получили анализ от бота (смотрите "Полный TXT" или отправьте себе "Context.txt"), скопируйте результат. Затем вставьте его в "CozeExecutor" ниже, чтобы бот написал новый код или создал Pull Request на GitHub. Всё готово для магии!
          </p>
        </section>

        <CozeExecutor />
      </div>
    </>
  );
}