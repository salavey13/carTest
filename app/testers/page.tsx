// /app/testers/page.tsx — Страница для тестеров (охота на баги)
import { cookies } from "next/headers";
import Image from "next/image";

export const dynamic = "force-dynamic";

const SUPABASE_STORAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix";

// Примеры реальных байков из базы
const FEATURED_BIKES = [
  { id: "y-volt", name: "Y-Volt", image: `${SUPABASE_STORAGE}/yvolt.jpg` },
  { id: "sur-ron", name: "Sur-Ron", image: `${SUPABASE_STORAGE}/sur-ron.jpg` },
  { id: "kawasaki", name: "Kawasaki Z900", image: `${SUPABASE_STORAGE}/kawasaki-z900.jpg` },
];

interface Bug {
  id: string;
  title: string;
  description: string;
  reward: number;
  difficulty: "easy" | "medium" | "hard";
  status: "open" | "claimed" | "verified";
  claimedBy?: string;
  claimedAt?: string;
}

// Mock данные — потом подключим к Supabase
const MOCK_BUGS: Bug[] = [
  {
    id: "bug-1",
    title: "Деплой после полуночи",
    description: "Попробуй арендовать байк ровно в 00:01. Найди где ломается дата.",
    reward: 500,
    difficulty: "easy",
    status: "open",
  },
  {
    id: "bug-2",
    title: "Спецсимволы в имени",
    description: "Введи в имя 'テスト_user_123' и найди где валидация ругается.",
    reward: 700,
    difficulty: "medium",
    status: "open",
  },
  {
    id: "bug-3",
    title: "Марафон аренды",
    description: "Попробуй арендовать на 45 дней. Найди где capped цена.",
    reward: 1000,
    difficulty: "hard",
    status: "open",
  },
];

export default async function TestersPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("telegram_user_id")?.value;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Анимированный фон с частицами */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob top-0 left-0"></div>
        <div className="absolute w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 top-0 right-0"></div>
        <div className="absolute w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 bottom-0 left-1/2"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Заголовок с байками */}
        <div className="text-center mb-12">
          <div className="flex justify-center gap-4 mb-6">
            {FEATURED_BIKES.map((bike, i) => (
              <div key={bike.id} className="relative w-24 h-24 md:w-32 md:h-32">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-purple-500/20 rounded-full blur-xl animate-pulse"></div>
                <Image
                  src={bike.image}
                  alt={bike.name}
                  fill
                  className="relative rounded-full object-cover border-2 border-yellow-400/30 shadow-2xl"
                  unoptimized
                />
              </div>
            ))}
          </div>
          <div className="inline-block mb-4 px-6 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full">
            <span className="text-black font-bold text-sm tracking-wider">🎯 ТЕСТЕРСКИЙ КЛУБ</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-200 mb-4 drop-shadow-lg">
            НАЙДИ БАГ — ПОЛУЧИ 500₽
          </h1>
          <p className="text-xl text-purple-200 max-w-2xl mx-auto">
            Устал мыть байки весь день? Прокачай скилл — найди ошибку в приложении и получи реальные деньги!
          </p>
        </div>

        {/* Карточки статистики */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all hover:scale-105">
            <div className="text-4xl font-black text-yellow-400">3</div>
            <div className="text-purple-200">Активных багов</div>
            <div className="text-purple-400 text-xs mt-1">🔥 Горячие задачи</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all hover:scale-105">
            <div className="text-4xl font-black text-green-400">~2,500₽</div>
            <div className="text-purple-200">Доступно наград</div>
            <div className="text-purple-400 text-xs mt-1">💰 Реальные деньги</div>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all hover:scale-105">
            <div className="text-4xl font-black text-pink-400">5 чел</div>
            <div className="text-purple-200">В команде</div>
            <div className="text-purple-400 text-xs mt-1">👥 Присоединяйся</div>
          </div>
        </div>

        {/* Как это работает */}
        <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 mb-12 border border-white/10">
          <h2 className="text-2xl font-bold text-yellow-400 mb-6 flex items-center gap-2">
            <span>📋</span> КАК ЭТО РАБОТАЕТ
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-xl group-hover:scale-110 transition-transform">
                1️⃣
              </div>
              <div className="text-purple-200 font-semibold">Выбери баг</div>
              <div className="text-purple-300 text-sm">Из списка ниже</div>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-xl group-hover:scale-110 transition-transform">
                2️⃣
              </div>
              <div className="text-purple-200 font-semibold">Попробуй сломать</div>
              <div className="text-purple-300 text-sm">В WebApp</div>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-xl group-hover:scale-110 transition-transform">
                3️⃣
              </div>
              <div className="text-purple-200 font-semibold">Найди проблему</div>
              <div className="text-purple-300 text-sm">В коде</div>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-xl group-hover:scale-110 transition-transform">
                4️⃣
              </div>
              <div className="text-purple-200 font-semibold">Получи 500₽</div>
              <div className="text-purple-300 text-sm">На карту/Т-Банк</div>
            </div>
          </div>
        </div>

        {/* Список багов */}
        <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
          <span className="text-4xl">🐛</span> АКТИВНЫЕ БАГИ
        </h2>
        <div className="space-y-4">
          {MOCK_BUGS.map((bug) => (
            <BugCard key={bug.id} bug={bug} userId={userId} bikes={FEATURED_BIKES} />
          ))}
        </div>

        {/* Футер */}
        <div className="mt-16 text-center text-purple-300 text-sm">
          <p>💡 Нашёл баг не из списка? Сообщи — получишь бонус!</p>
          <p className="mt-2 text-purple-400">Присоединяйся: @oneBikePlsBot</p>
        </div>
      </div>
    </div>
  );
}

function BugCard({ bug, userId, bikes }: { bug: Bug; userId?: string; bikes: typeof FEATURED_BIKES }) {
  const difficultyColors = {
    easy: "from-green-400 to-emerald-500",
    medium: "from-yellow-400 to-orange-500",
    hard: "from-red-400 to-rose-500",
  };

  const statusColors = {
    open: "bg-green-500/20 text-green-400 border-green-500/50",
    claimed: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
    verified: "bg-gray-500/20 text-gray-400 border-gray-500/50",
  };

  const statusLabels = {
    open: "🔥 ОТКРЫТ",
    claimed: "⏳ НА ПРОВЕРКЕ",
    verified: "✅ ИСПРАВЛЕНО",
  };

  // Pick a random bike for this bug card
  const bikeIndex = parseInt(bug.id.split("-")[1]) % bikes.length;
  const bugBike = bikes[bikeIndex];

  return (
    <div className="group hover:scale-[1.02] transition-all duration-300">
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 hover:border-yellow-500/50 hover:bg-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Левая часть */}
          <div className="flex items-start gap-4 flex-1">
            {/* Байк аватарка */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-purple-500/20 rounded-xl blur-lg"></div>
              <Image
                src={bugBike.image}
                alt={bugBike.name}
                fill
                className="relative rounded-xl object-cover border border-yellow-400/30"
                unoptimized
              />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${difficultyColors[bug.difficulty]} text-black`}>
                  {bug.difficulty === "easy" ? "ЛЕГКО" : bug.difficulty === "medium" ? "СРЕДНЕ" : "СЛОЖНО"}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[bug.status]}`}>
                  {statusLabels[bug.status]}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{bug.title}</h3>
              <p className="text-purple-300 text-sm">{bug.description}</p>
              {bug.claimedBy && (
                <p className="text-purple-400 text-xs mt-2">
                  Занял: <span className="text-yellow-400">{bug.claimedBy}</span>
                  {bug.claimedAt && ` (${new Date(bug.claimedAt).toLocaleDateString("ru-RU")})`}
                </p>
              )}
            </div>
          </div>

          {/* Правая часть — награда */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">
                {bug.reward}₽
              </div>
              <div className="text-purple-400 text-xs">НАГРАДА</div>
            </div>

            {bug.status === "open" && userId ? (
              <button
                className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-bold rounded-xl transition-all hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/25"
              >
                🚀 ЗАНЯТЬ
              </button>
            ) : bug.status === "claimed" && bug.claimedBy === userId ? (
              <div className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-xl text-sm">
                Ты на этом
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
