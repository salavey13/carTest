/**
 * ZAI DocXagent Instructions Page
 *
 * This page explains how to teach ZAI agent to generate rental/sale contracts
 */

import { Metadata } from "next";
import { ShieldCheck, QrCode, Send, Bot, Download, Rocket } from "lucide-react";

export const metadata: Metadata = {
  title: "ZAI DocXagent — Инструкции",
  description: "Как научить ZAI агента генерировать договоры аренды и продажи",
};

export default function ZaiDocxInstructionsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Bot className="w-16 h-16 text-fuchsia-400" />
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
            ZAI DocXagent
          </h1>
          <p className="text-lg text-slate-300">
            Научите ZAI агента генерировать договоры аренды и продажи из фото документов
          </p>
        </div>

        {/* Overview */}
        <section className="mb-12 bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-fuchsia-400" />
            Что это такое?
          </h2>
          <p className="text-slate-300 mb-4">
            DocXagent — это набор файлов, которые позволяют ZAI web агенту:
          </p>
          <ul className="space-y-2 text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-fuchsia-400 mt-1">→</span>
              <span>Извлекать данные из фото паспорта и водительского удостоверения (встроенный VLM)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fuchsia-400 mt-1">→</span>
              <span>Читать данные о байках из Supabase</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fuchsia-400 mt-1">→</span>
              <span>Генерировать DOCX договоры из HTML шаблонов</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fuchsia-400 mt-1">→</span>
              <span>Сохранять данные в private схему Supabase</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-fuchsia-400 mt-1">→</span>
              <span>Отправлять документы в Telegram</span>
            </li>
          </ul>
        </section>

        {/* Required Files */}
        <section className="mb-12 bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Download className="w-6 h-6 text-fuchsia-400" />
            Что нужно ZAI? (всего 20 файлов)
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-4">
              <h3 className="font-semibold text-fuchsia-300 mb-2">Навыки (2 файла)</h3>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>skills/rental-contract-from-photos/SKILL.md</li>
                <li>skills/deal-contract-from-photos/SKILL.md</li>
              </ul>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4">
              <h3 className="font-semibold text-fuchsia-300 mb-2">Скрипты (3 файла)</h3>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>scripts/make-rental-contract-skill.mjs</li>
                <li>scripts/make-deal-contract-skill.mjs</li>
                <li>scripts/supabase-access-skill.mjs</li>
              </ul>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4">
              <h3 className="font-semibold text-fuchsia-300 mb-2">Библиотеки (1 файл)</h3>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>lib/htmlToDocx.mjs</li>
              </ul>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4">
              <h3 className="font-semibold text-fuchsia-300 mb-2">Шаблоны (2 файла)</h3>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>docs/RENTAL_DEAL_TEMPLATE.html</li>
                <li>docs/SALE_DEAL_TEMPLATE.html</li>
              </ul>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4">
              <h3 className="font-semibold text-fuchsia-300 mb-2">База данных (5 миграций)</h3>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>supabase/migrations/20240101000000_init.sql</li>
                <li>supabase/migrations/20260304_private_scheme.sql</li>
                <li>supabase/migrations/20260601000000_user_rental_secrets.sql</li>
                <li>supabase/migrations/20260607000000_create_sale_contract_artifacts.sql</li>
                <li>supabase/migrations/20260508090000_repair_private_crew_secrets.sql</li>
              </ul>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4">
              <h3 className="font-semibold text-fuchsia-300 mb-2">API & Дашборд (4 файла)</h3>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>app/api/forward-telegram/route.ts</li>
                <li>app/franchize/[slug]/rentals-analytics/page.tsx</li>
                <li>app/franchize/[slug]/rentals-analytics/RentalsAnalyticsClient.tsx</li>
                <li>app/franchize/server-actions/rentals-dashboard.ts</li>
              </ul>
            </div>
          </div>
        </section>

        {/* How to Use */}
        <section className="mb-12 bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-fuchsia-400" />
            Как использовать кнопку "DocX"
          </h2>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 font-semibold">1</div>
              <div>
                <h3 className="font-semibold mb-1">Откройте RepoTxtFetcher</h3>
                <p className="text-slate-400 text-sm">Это компонент для извлечения файлов из GitHub репозитория</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 font-semibold">2</div>
              <div>
                <h3 className="font-semibold mb-1">Нажмите кнопку "DocX"</h3>
                <p className="text-slate-400 text-sm">Фиолетовая кнопка с иконкой робота 🤖 между "Важные" и "Дерево"</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 font-semibold">3</div>
              <div>
                <h3 className="font-semibold mb-1">20 файлов извлечены</h3>
                <p className="text-slate-400 text-sm">Все нужные файлы будут загружены и отмечены значком "Doc"</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 font-semibold">4</div>
              <div>
                <h3 className="font-semibold mb-1">Нажмите "Добавить"</h3>
                <p className="text-slate-400 text-sm">Файлы будут добавлены в поле ввода для отправки ZAI</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 font-semibold">5</div>
              <div>
                <h3 className="font-semibold mb-1">Отправьте ZAI!</h3>
                <p className="text-slate-400 text-sm">Прикрепите installer и дайте инструкцию (см. ниже)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Environment Variables */}
        <section className="mb-12 bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-fuchsia-400" />
            Переменные окружения (только 2!)
          </h2>

          <div className="bg-slate-900/50 rounded-xl p-4 font-mono text-sm">
            <p className="text-slate-400 mb-2"># Только Supabase доступ:</p>
            <p className="text-emerald-400">SUPABASE_URL=https://xxx.supabase.co</p>
            <p className="text-emerald-400">SUPABASE_SERVICE_ROLE_KEY=eyJxxx...</p>
            <p className="text-slate-500 mt-2"># ZAI SDK не нужен - ZAI имеет встроенный VLM!</p>
          </div>
        </section>

        {/* Prompt for ZAI */}
        <section className="mb-12 bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 rounded-2xl p-6 border border-fuchsia-500/30">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Send className="w-6 h-6 text-fuchsia-400" />
            Промпт для ZAI
          </h2>

          <div className="bg-slate-900/80 rounded-xl p-4 text-sm font-mono text-slate-300">
            <p className="text-fuchsia-400 mb-4"># Скопируйте и отправьте ZAI:</p>
            <pre>{`ZAI, я дал тебе файлы для генерации договоров аренды/продажи.

Твоя задача:
1. Извлечь данные из фото паспорта/ВУ (используй встроенный VLM)
2. Прочитай данные байка из Supabase public.cars (type='bike')
3. Сгенерируй DOCX из HTML шаблона (используй cheerio + docx)
4. Сохрани в private.user_rental_secrets через Supabase REST API
5. (Опционально) Отправь через /api/forward-telegram

Переменные окружения:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Больше ничего не нужно!`}</pre>
          </div>
        </section>

        {/* QR Codes */}
        <section className="mb-12 bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-fuchsia-400" />
            QR коды для быстрой аренды
          </h2>

          <p className="text-slate-300 mb-4">
            После генерации договора создайте QR код для следующующей аренды в один клик:
          </p>

          <div className="bg-slate-900/50 rounded-xl p-4 font-mono text-sm text-slate-400 mb-4">
            <p className="mb-2">// Формат ссылки для QR:</p>
            <p className="text-emerald-400">const qrLink = `https://t.me/oneBikePlsBot/app?startapp=rent_$&#123;bikeId&#125;_$&#123;docSha256&#125;`;</p>
          </div>

          <div className="bg-slate-900/50 rounded-xl p-4 font-mono text-sm text-slate-400">
            <p className="mb-2">// Вариант 1: Бесплатный API (без npm):</p>
            <p className="text-emerald-400 mb-4">const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=$&#123;encodeURIComponent(qrLink)&#125;`;</p>

            <p className="mb-2">// Вариант 2: npm пакет 'qrcode':</p>
            <p className="text-emerald-400">import QRCode from 'qrcode';</p>
            <p className="text-emerald-400">const qrImage = await QRCode.toDataURL(qrLink);</p>
          </div>
        </section>

        {/* Download Installer */}
        <section className="mb-12 bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 rounded-2xl p-6 border border-fuchsia-500/30">
          <h2 className="text-2xl font-semibold mb-4">Скачать Installer</h2>
          <p className="text-slate-300 mb-6">
            Полный инструктаж для ZAI в одном файле:
          </p>
          <a
            href="/api/download-installer?file=ZAI_DOCX_INSTALLER.md"
            download="ZAI_DOCX_INSTALLER.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-fuchsia-500 hover:bg-fuchsia-600 rounded-xl font-semibold transition-colors"
          >
            <Download className="w-5 h-5" />
            Скачать ZAI_DOCX_INSTALLER.md
          </a>
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-500 text-sm py-8 border-t border-slate-700">
          <p>DocXagent © 2024 • VIP Bike Rental System</p>
        </footer>
      </div>
    </main>
  );
}
