import { ReactNode } from "react";

export type Story = {
  id: string;
  content: ReactNode;
};

export const STORIES: Story[] = [
  {
    id: "cover",
    content: (
      <div>
        <h1 className="text-4xl font-bold mb-4">🌍 ВСЕОБЩАЯ ИСТОРИЯ</h1>
        <p className="text-lg opacity-80">7 класс за 5 минут</p>
        <p className="mt-6 text-yellow-400">👉 листай</p>
      </div>
    ),
  },

  {
    id: "how",
    content: (
      <div>
        <h2 className="text-3xl font-bold mb-4">КАК СДАТЬ ВПР</h2>
        <p>📅 даты</p>
        <p>👑 личности</p>
        <p>⚔️ события</p>
        <p>📚 термины</p>
      </div>
    ),
  },

  // ⚔️ СРЕДНЕВЕКОВЬЕ БАЗА
  {
    id: "feudalism",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ФЕОДАЛИЗМ</h2>
        <p className="mt-2">земля = власть</p>
        <p>сеньор → вассал</p>
        <p className="text-yellow-400 mt-3">главная система Европы</p>
      </div>
    ),
  },

  {
    id: "knights",
    content: (
      <div>
        <h2 className="text-3xl font-bold">РЫЦАРИ</h2>
        <p>⚔️ война</p>
        <p>🏰 служба феодалу</p>
        <p className="text-green-400 mt-2">кодекс чести</p>
      </div>
    ),
  },

  {
    id: "church",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ЦЕРКОВЬ</h2>
        <p>⛪ огромная власть</p>
        <p>📖 контроль знаний</p>
        <p className="text-red-400 mt-2">инквизиция</p>
      </div>
    ),
  },

  // ⚔️ КРЕСТОВЫЕ ПОХОДЫ
  {
    id: "crusades",
    content: (
      <div>
        <h2 className="text-3xl font-bold">КРЕСТОВЫЕ ПОХОДЫ</h2>
        <p>1096–1270</p>
        <p>⚔️ за Иерусалим</p>
        <p className="text-yellow-400 mt-2">Европа vs Восток</p>
      </div>
    ),
  },

  // 🏙 ГОРОДА
  {
    id: "cities",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ГОРОДА</h2>
        <p>🏘 ремесло</p>
        <p>💰 торговля</p>
        <p className="text-green-400 mt-2">рост экономики</p>
      </div>
    ),
  },

  {
    id: "guilds",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ЦЕХИ</h2>
        <p>ремесленники</p>
        <p>контроль качества</p>
        <p className="text-yellow-400 mt-2">как профсоюзы</p>
      </div>
    ),
  },

  // 💀 ЧУМА
  {
    id: "plague",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ЧЁРНАЯ СМЕРТЬ</h2>
        <p>1347–1351</p>
        <p>☠️ умерло ~1/3 Европы</p>
        <p className="text-red-400 mt-2">кризис</p>
      </div>
    ),
  },

  // ⚔️ ВОЙНЫ
  {
    id: "hundred",
    content: (
      <div>
        <h2 className="text-3xl font-bold">100-ЛЕТНЯЯ ВОЙНА</h2>
        <p>1337–1453</p>
        <p>🇫🇷 vs 🇬🇧</p>
        <p className="text-green-400 mt-2">Жанна д’Арк</p>
      </div>
    ),
  },

  // 👑 АБСОЛЮТИЗМ
  {
    id: "absolutism",
    content: (
      <div>
        <h2 className="text-3xl font-bold">АБСОЛЮТИЗМ</h2>
        <p>вся власть у короля</p>
        <p>без ограничений</p>
        <p className="text-yellow-400 mt-2">Людовик XIV</p>
      </div>
    ),
  },

  // 🎨 ВОЗРОЖДЕНИЕ
  {
    id: "renaissance",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ВОЗРОЖДЕНИЕ</h2>
        <p>🎨 искусство</p>
        <p>🧠 наука</p>
        <p className="text-green-400 mt-2">человек в центре</p>
      </div>
    ),
  },

  {
    id: "da_vinci",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ЛЕОНАРДО ДА ВИНЧИ</h2>
        <p>🎨 Мона Лиза</p>
        <p>🛠 изобретения</p>
      </div>
    ),
  },

  // ⛪ РЕФОРМАЦИЯ
  {
    id: "reformation",
    content: (
      <div>
        <h2 className="text-3xl font-bold">РЕФОРМАЦИЯ</h2>
        <p>1517</p>
        <p>📜 Мартин Лютер</p>
        <p className="text-red-400 mt-2">раскол церкви</p>
      </div>
    ),
  },

  // 🌍 ВЕЛИКИЕ ОТКРЫТИЯ
  {
    id: "discoveries",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ГЕОГРАФИЧЕСКИЕ ОТКРЫТИЯ</h2>
        <p>🌊 новые земли</p>
        <p>💰 торговля</p>
      </div>
    ),
  },

  {
    id: "columbus",
    content: (
      <div>
        <h2 className="text-3xl font-bold">КОЛУМБ</h2>
        <p>1492</p>
        <p className="text-yellow-400 mt-2">открыл Америку</p>
      </div>
    ),
  },

  {
    id: "magellan",
    content: (
      <div>
        <h2 className="text-3xl font-bold">МАГЕЛЛАН</h2>
        <p>первое кругосветное</p>
      </div>
    ),
  },

  // ⚠️ ЛОВУШКИ
  {
    id: "traps",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ЛОВУШКИ</h2>
        <p>Колумб ≠ доказал шар</p>
        <p>Лютер ≠ католик</p>
        <p>рыцари ≠ крестьяне</p>
      </div>
    ),
  },

  // 🧪 ТЕСТ
  {
    id: "test",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ПРОВЕРЬ СЕБЯ</h2>
        <p>1. Кто начал Реформацию?</p>
        <p>2. Когда Колумб?</p>
        <p>3. Что такое феодализм?</p>
      </div>
    ),
  },

  {
    id: "answers",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ОТВЕТЫ</h2>
        <p>Мартин Лютер</p>
        <p>1492</p>
        <p>система земли и вассалов</p>
      </div>
    ),
  },
];