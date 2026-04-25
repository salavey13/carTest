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
        <h1 className="text-4xl font-bold mb-4">🇷🇺 ИСТОРИЯ РОССИИ</h1>
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
        <p>👑 правители</p>
        <p>⚔️ события</p>
        <p>📚 термины</p>
      </div>
    ),
  },

  {
    id: "1480",
    content: (
      <div>
        <h2 className="text-4xl font-bold">1480</h2>
        <p className="mt-2">Стояние на Угре</p>
        <p className="text-green-400 mt-4">конец ига</p>
      </div>
    ),
  },

  {
    id: "1552",
    content: (
      <div>
        <h2 className="text-4xl font-bold">1552</h2>
        <p>Взятие Казани</p>
        <p className="text-yellow-400 mt-2">Иван IV</p>
      </div>
    ),
  },

  {
    id: "1572",
    content: (
      <div>
        <h2 className="text-4xl font-bold">1572</h2>
        <p>Битва при Молодях</p>
        <p className="text-green-400 mt-2">победа над Крымом</p>
      </div>
    ),
  },

  {
    id: "smuta",
    content: (
      <div>
        <h2 className="text-3xl font-bold">СМУТА</h2>
        <p className="mt-2">1598–1613</p>
        <p className="mt-4">💀 нет царя</p>
        <p>⚔️ войны</p>
        <p>👤 самозванцы</p>
      </div>
    ),
  },

  {
    id: "1613",
    content: (
      <div>
        <h2 className="text-4xl font-bold">1613</h2>
        <p>Михаил Романов</p>
        <p className="text-green-400 mt-2">конец Смуты</p>
      </div>
    ),
  },

  {
    id: "1649",
    content: (
      <div>
        <h2 className="text-4xl font-bold">1649</h2>
        <p>Соборное уложение</p>
        <p className="text-yellow-400 mt-2">главный закон</p>
      </div>
    ),
  },

  {
    id: "ivan3",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ИВАН III</h2>
        <p>📍 собрал земли</p>
        <p>📍 конец ига</p>
      </div>
    ),
  },

  {
    id: "ivan4",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ИВАН IV</h2>
        <p>🔥 Казань</p>
        <p>⚔️ Молоди</p>
        <p className="text-red-400 mt-2">❗ опричнина ≠ внешка</p>
      </div>
    ),
  },

  {
    id: "terms",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ТЕРМИНЫ</h2>
        <p>опричнина = террор</p>
        <p>стрельцы = армия</p>
        <p>ярмарка = торговля</p>
      </div>
    ),
  },

  {
    id: "culture",
    content: (
      <div>
        <h2 className="text-3xl font-bold">КУЛЬТУРА</h2>
        <p>⛪ храм Василия</p>
        <p>📖 книги</p>
        <p>🏰 кремли</p>
      </div>
    ),
  },

  {
    id: "map",
    content: (
      <div>
        <h2 className="text-3xl font-bold">КАРТА</h2>
        <p>🔥 Разин → Волга</p>
        <p>🔥 Смута → XVII век</p>
      </div>
    ),
  },

  {
    id: "traps",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ЛОВУШКИ</h2>
        <p>1514 → Василий III</p>
        <p>1613 → 1 половина XVII</p>
      </div>
    ),
  },

  {
    id: "test",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ПРОВЕРЬ СЕБЯ</h2>
        <p>1. Первый царь?</p>
        <p>2. 1613?</p>
        <p>3. Кто спас Москву?</p>
      </div>
    ),
  },

  {
    id: "answers",
    content: (
      <div>
        <h2 className="text-3xl font-bold">ОТВЕТЫ</h2>
        <p>Иван IV</p>
        <p>Романов</p>
        <p>Минин и Пожарский</p>
      </div>
    ),
  },
];