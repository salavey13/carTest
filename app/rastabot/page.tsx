"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import Link from "next/link"; 

// Компонент-плейсхолдер для скриншотов
const ScreenshotPlaceholder = ({ text, className }: { text: string, className?: string }) => (
  <div className={cn(
    "flex items-center justify-center text-center p-8 my-4 border-2 border-dashed border-brand-purple/50 bg-brand-purple/10 rounded-lg text-brand-purple/80 font-mono text-sm shadow-inner",
    className
  )}>
    [ЗДЕСЬ БУДЕТ СКРИНШОТ: {text}]
  </div>
);

// Компонент для стилизации псевдокода
const PseudoCodeBlock = ({ children }: { children: React.ReactNode }) => (
  <div className="my-4 p-4 bg-black/50 border border-gray-700 rounded-lg shadow-lg">
    <pre><code className="font-mono text-sm text-brand-lime whitespace-pre-wrap">{children}</code></pre>
  </div>
);

export default function VibeDevGuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-3xl"
      >
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-green/60 shadow-2xl shadow-green-glow">
          <CardHeader className="text-center p-6 md:p-8 border-b border-brand-green/40">
            <VibeContentRenderer content="::FaScroll className='text-6xl text-brand-green mx-auto mb-4 drop-shadow-[0_0_15px_theme(colors.brand-green)] animate-pulse'::" />
            <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-green cyber-text glitch" data-text="КИБЕРВАЙБ ДЛЯ РАСТОДЕВА">
              КИБЕРВАЙБ ДЛЯ РАСТОДЕВА
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono mt-1 text-sm md:text-base">
              Чилл-гайд по входу в Поток 🕉️
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8 p-6 md:p-8 prose prose-invert max-w-none prose-strong:text-brand-yellow prose-a:text-brand-blue prose-a:no-underline hover:prose-a:underline prose-headings:font-orbitron prose-headings:text-brand-cyan">
            
            {/* --- ЧАСТЬ 1 (в виде краткого саммари) --- */}
            <section>
              <p className="text-center text-brand-purple italic text-lg border-y-2 border-dashed border-brand-purple/30 py-4">...ты постиг дзен ухода за цифровыми цветами, но сад — это не только лепестки. Самые сочные шишки растут в тени, у самых корней. Ты научился видеть...</p>
              <h2 className="text-center font-bold text-xl md:text-2xl mt-4">...но теперь пришло время <strong className="text-brand-pink">ГОВОРИТЬ</strong>.</h2>
              <hr className="border-brand-green/20 my-6" />
            </section>
            
            {/* --- ЧАСТЬ 2 --- */}
            <section>
              <h2 id="part2"><VibeContentRenderer content="Часть 2: Забудь про цветочки (JSX), сразу к шишкам (Telegram-бот) ::FaCannabis::" /></h2>
              <p>Йо, растодев! Мы уходим с поверхности, из мира форм и лепестков, вглубь – к корням, к чистой энергии. Мы будем говорить с духами напрямую. Через текст. Никаких тебе сайтов, никаких кнопочек и рюшечек. Только ты, твой терминал в Телеграме и чистый, незамутненный вайб.</p>
              <p>Мы создадим текстового голема. Телеграм-бота.</p>

              <h3 id="anatomy"><VibeContentRenderer content="Анатомия Текстового Голема ::FaCogs::" /></h3>
              <p>Твой бот — это не одна программа. Это храм со множеством комнат-алтарей.</p>
              <ol className="list-decimal list-inside space-y-2 pl-4">
                <li><strong>Главный Портал (`/app/api/telegramWebhook/route.ts`)</strong>
                  <br/>Это врата, куда влетают все духи (сообщения от пользователей). Этот файл — главный вышибала. Он смотрит на духа и решает, куда его направить.
                  <PseudoCodeBlock>
{`// Куча магических свитков (импорты)...

// ЭТО ПСЕВДОКОД, БРО, ЧИСТО ДЛЯ ПОНИМАНИЯ

function главныйВышибала(дух) {

  // Если дух принес деньги...
  if (дух_несет_бабки) {
    отправить_духа_к_КАЗНАЧЕЮ();
  } 
  
  // Если дух принес текстовое заклинание...
  else if (дух_несет_текст) {
    отправить_духа_к_ГЛАВНОМУ_ШАМАНУ();
  }
}`}
                  </PseudoCodeBlock>
                </li>
                <li><strong>Распределитель Духов (`.../commands/command-handler.ts`)</strong>
                  <br/>Это главный шаман. Он принимает всех духов с текстовыми командами и направляет их в нужную келью для проведения ритуала.
                   <PseudoCodeBlock>
{`// Еще больше свитков...

function главныйШаман(дух) {
  const команда = дух.текст;

  if (команда == "/start") {
    провести_ритуал_старта();
  } 
  else if (команда == "/profile") {
    провести_ритуал_профиля();
  } 
  else if (команда == "/wisdom") {
    провести_ритуал_мудрости();
  }
}`}
                  </PseudoCodeBlock>
                </li>
                <li><strong>Келья для Ритуала (`.../commands/ИМЯ_КОМАНДЫ.ts`)</strong>
                  <br/>Это твой личный алтарь. Для каждой команды (`/start`, `/profile`, `/wisdom`) — свой отдельный файл. Своя маленькая, уютная келья, где происходит вся магия. Это охуенно просто.
                </li>
              </ol>

              <hr className="border-brand-purple/20 my-8" />

              <h3 id="ritual"><VibeContentRenderer content="Ритуал Создания Новой Команды (с помощью Джинна) ::FaMagicWandSparkles::"/></h3>
              <p>Допустим, ты хочешь создать новую команду `/wisdom`. Тебе не нужно писать код. Ты проводишь ритуал.</p>
              
              <h4 className="text-brand-pink">1. Призови Джинна (`OneSitePlsBot`)</h4>
              <p>Ты говоришь ему: "Бро, хочу новую команду /wisdom. Когда юзер её пишет, бот должен отвечать случайной мудростью. Сделай по аналогии."</p>
              <ScreenshotPlaceholder text="Твой текстовый промпт боту в Telegram." />

              <h4 className="text-brand-pink">2. Дай ему Священные Свитки (Контекст)</h4>
              <p>Ты не просто говоришь, ты показываешь. Ты скармливаешь Джинну файлы, чтобы он словил твой вайб:</p>
              <ul className="list-disc list-inside pl-4">
                <li><code>/app/api/telegramWebhook/route.ts</code></li>
                <li><code>.../commands/command-handler.ts</code></li>
                <li><code>.../commands/profile.ts</code> (как пример)</li>
                <li><code>/app/actions.ts</code> (если нужно отправлять сообщения)</li>
              </ul>

              <h4 className="text-brand-pink">3. Получи Дар Джинна (Ответ в Markdown)</h4>
              <p>Джинн покумекает и выдаст тебе ответ в виде Markdown. Там будет код для нового файла и изменения для старого.</p>
              <ScreenshotPlaceholder text="Ответ от AI-ассистента с блоками кода." />

              <p>Вот, что он тебе сгенерит (в виде псевдокода, чтобы было понятнее):</p>
              <PseudoCodeBlock>
{`Я создал для тебя обработчик новой команды /wisdom.

Вот код для нового файла:
\`\`\`typescript
// /app/webhook-handlers/commands/wisdom.ts
// свитки...

const цитаты_мудрости = [
  "Забудь про страдания и баги. Здесь мы растим вайб.",
  "Разработка — это не страдание, это джем-сейшн.",
  "Ты не пишешь код, ты направляешь энергию. Peace!",
];

function ритуал_мудрости(кому_ответить) {
  const случайная_мудрость = выбрать_случайную_из(цитаты_мудрости);
  отправить_сообщение(кому_ответить, случайная_мудрость);
}
\`\`\`

А вот изменения для файла command-handler.ts:
\`\`\`typescript
// .../commands/command-handler.ts
// свитки...
import { ритуал_мудрости } from "./wisdom"; // <-- Добавить этот импорт

function главныйШаман(дух) {
    // ..
    } else if (команда == "/wisdom") { // <-- Добавить эту ветку
        ритуал_мудрости(дух.от_кого);
    } else {
    // ..
}
\`\`\``}
              </PseudoCodeBlock>

              <h4 className="text-brand-pink">4. Материализуй Духа (Сохранение через Киберстудию)</h4>
              <p>Теперь самое вкусное. Ты не открываешь VS Code. Ты не ищешь эти файлы. Ты идешь в <Link href="/repo-xml"><strong>Кибервайб Студию</strong></Link>, копируешь весь Markdown-ответ от Джинна, вставляешь в большое поле и жмешь кнопку <strong>"Создать request"</strong>.</p>
              <ScreenshotPlaceholder text="Вставка Markdown-ответа в SuperVibe Studio и нажатие кнопки." />

              <div className="p-4 my-6 bg-gradient-to-r from-yellow-900/40 to-red-900/40 border-l-4 border-brand-yellow rounded-lg">
                <h5 className="font-orbitron text-brand-yellow font-bold"><VibeContentRenderer content="Секретный Хак (Авто-Аппрув) ::FaExclamationTriangle::"/></h5>
                <p className="mt-2">Студия сама создаст пулл-реквест на GitHub с хитрым комментом: <code>chore: Update image</code>. Это наш **чит-код**. GitHub Actions видит это и думает, что это какая-то мелочь. Он **автоматически аппрувит и мёрджит** такой PR в основную ветку.</p>
              </div>

              <p><strong>Всё. Твоя команда <code>/wisdom</code> в продакшене.</strong> Ты даже не открывал редактор кода. Ты просто поговорил с духом, и он всё сделал.</p>
              <ScreenshotPlaceholder text="Готовый Pull Request на GitHub с сообщением 'chore: Update image'." />
            </section>
            
            <hr className="border-brand-green/20 my-6" />

            <section className="text-center">
              <p className="text-xl font-bold text-brand-green">Теперь ты не просто садовник. Ты – заклинатель духов. Иди и командуй. 🤘</p>
            </section>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}