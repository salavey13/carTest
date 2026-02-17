export const metadata = {
  title: "SQL шпаргалка — главные команды",
  description: "Короткая фото-шпаргалка по SQL: SELECT, WHERE, JOIN, GROUP BY, INSERT, UPDATE, DELETE.",
};

const blocks = [
  {
    title: "1) SELECT + WHERE",
    code: `SELECT id, name, email\nFROM users\nWHERE is_active = true\nORDER BY created_at DESC\nLIMIT 10;`,
  },
  {
    title: "2) JOIN",
    code: `SELECT o.id, u.name, o.total\nFROM orders o\nJOIN users u ON u.id = o.user_id\nWHERE o.status = 'paid';`,
  },
  {
    title: "3) GROUP BY",
    code: `SELECT user_id, COUNT(*) AS orders_count, SUM(total) AS revenue\nFROM orders\nGROUP BY user_id\nHAVING SUM(total) > 1000;`,
  },
  {
    title: "4) INSERT / UPDATE / DELETE",
    code: `INSERT INTO users (name, email) VALUES ('Alex', 'alex@mail.com');\n\nUPDATE users SET is_active = false WHERE id = 42;\n\nDELETE FROM sessions WHERE expires_at < NOW();`,
  },
];

export default function SqlCheatsheetPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">📸 SQL шпаргалка: главные команды</h1>
        <p className="text-zinc-300 mb-8">Сделал удобный лист, как «фото со шпаргалками» — быстро глянуть перед работой.</p>

        <section className="grid gap-4 md:grid-cols-2">
          {blocks.map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-lg">
              <h2 className="font-semibold text-lg mb-3 text-emerald-300">{item.title}</h2>
              <pre className="text-xs md:text-sm whitespace-pre-wrap rounded-xl bg-black/50 border border-zinc-800 p-4 overflow-x-auto">
                <code>{item.code}</code>
              </pre>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
