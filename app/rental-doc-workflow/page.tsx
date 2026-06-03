import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Image as ImageIcon,
  LockKeyhole,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";

const doneItems = [
  "Договор собирается автоматически из сообщения оператора, фото паспорта и фото водительского удостоверения.",
  "Мотоцикл ищется в базе по названию, ID или похожей фразе: например, «кавасаки» → нужный Kawasaki.",
  "В договор подставляются данные байка, клиента, даты, цена, адрес и служебные поля передачи мотоцикла.",
  "Готовый DOCX отправляется в Telegram без повторной отправки дублем.",
  "К договору добавлен QR-код: клиент сканирует его и попадает в Telegram Mini App для следующей быстрой аренды.",
  "Секретные данные арендатора вынесены в приватные таблицы, чтобы паспортные данные не светились в публичной части приложения.",
  "Для байков уже есть уровни доступа: базовый, средний и pro — они нужны для будущего VIP-повтора без лишних проверок.",
];

const operatorSteps = [
  {
    title: "1. Отправьте команду",
    text: "В Telegram/Slack пишем обычным языком: «создай документ на Kawasaki с 30.05 20:00 до 23:00, сумма 6000 ₽». Главное — назвать байк и период аренды.",
    icon: MessageCircle,
  },
  {
    title: "2. Приложите две фотографии",
    text: "Нужны фото паспорта и водительского удостоверения. Если фото нечитаемое или не хватает даты аренды, система попросит уточнение, а не будет выдумывать данные.",
    icon: ImageIcon,
  },
  {
    title: "3. AI достаёт данные клиента",
    text: "Из фото берутся ФИО, дата рождения, паспорт, адрес регистрации и номер водительского удостоверения. В публичные отчёты полные персональные данные не попадают.",
    icon: UserCheck,
  },
  {
    title: "4. Байк подтягивается из базы",
    text: "Оператору не нужно вручную переписывать VIN, модель, госномер и характеристики. Система сама находит карточку мотоцикла и подставляет поля в договор.",
    icon: Bike,
  },
  {
    title: "5. Получите DOCX + QR",
    text: "На выходе в Telegram приходит договор аренды и QR-код. DOCX можно печатать и подписывать, QR открывает путь к следующей аренде этого клиента.",
    icon: FileCheck2,
  },
];

const futureItems = [
  {
    status: "В работе",
    title: "QR как вход в быструю повторную аренду",
    text: "Скан QR должен открывать Mini App сразу с выбранным байком и проверенным документом, чтобы клиенту не приходилось снова фотографировать паспорт.",
  },
  {
    status: "Запланировано",
    title: "Команда /doc прямо в Telegram",
    text: "Бот проведёт оператора по шагам: паспорт → права → подтверждение данных → выбор байка → срок → готовый договор.",
  },
  {
    status: "Запланировано",
    title: "OCR и ручная проверка",
    text: "Фото документов будут распознаваться через OCR, а админ сможет быстро подтвердить или поправить результат перед сохранением.",
  },
  {
    status: "Запланировано",
    title: "VIP Club и уровни доступа",
    text: "После первой проверенной аренды клиент получает уровень доступа. Чем выше уровень, тем больше мотоциклов доступно для повторной аренды без лишней бюрократии.",
  },
  {
    status: "Исследование",
    title: "NFC-активация",
    text: "Дальняя идея: связать аренду, телефон и доступ к мотоциклу так, чтобы подтверждённая аренда превращалась в безопасный цифровой ключ.",
  },
];

const simpleInputs = [
  "фраза «создай документ» или «сделай договор»;",
  "название байка или понятный намёк: Kawasaki, Ducati, Falcon и т.п.;",
  "дата и время аренды: например, «с 20:00 до 23:00 30 мая»;",
  "цена или условия, если они отличаются от стандартных;",
  "фото паспорта;",
  "фото водительского удостоверения, если оно нужно для выбранного байка.",
];

export default function RentalDocWorkflowPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.24),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.22),_transparent_32%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            <Sparkles className="h-4 w-4" />
            Документы аренды по фото — понятная версия
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Один текст, две фотки — и договор аренды готов
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                Эта страница объясняет человеческим языком, как работает новый поток VIP Bike Rental: оператор отправляет короткое сообщение, прикладывает фото документов, а система сама находит мотоцикл в базе, собирает DOCX и добавляет QR-код для следующей аренды.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/vipbikerental"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300"
                >
                  Открыть VIP Bike
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/doc-verifier"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  Проверка документа
                  <ShieldCheck className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Что отправить</p>
                  <h2 className="mt-2 text-2xl font-black">Минимальный вход</h2>
                </div>
                <Bot className="h-10 w-10 text-amber-300" />
              </div>
              <ul className="space-y-3">
                {simpleInputs.map((item) => (
                  <li key={item} className="flex gap-3 rounded-2xl bg-slate-950/60 p-4 text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-amber-300">Рабочий сценарий</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Как это проходит на практике</h2>
          </div>
          <CalendarClock className="hidden h-12 w-12 text-slate-500 sm:block" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {operatorSteps.map((step) => (
            <article key={step.title} className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              <step.icon className="mb-5 h-8 w-8 text-cyan-300" />
              <h3 className="text-lg font-black text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-900/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">Уже сделано</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Зелёные галочки из ToDo — простыми словами</h2>
            <p className="mt-4 text-slate-300">
              Техническая ToDo уже содержит много закрытых пунктов. Ниже — не программистская расшифровка, что это означает для оператора и клиента.
            </p>
          </div>

          <div className="space-y-3">
            {doneItems.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-300" />
                <p className="text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-6">
            <QrCode className="h-10 w-10 text-cyan-200" />
            <h3 className="mt-5 text-2xl font-black">QR уже в логике</h3>
            <p className="mt-3 leading-7 text-cyan-50/85">
              QR нужен не «для красоты»: он связывает конкретный договор, конкретный байк и будущую быструю аренду через Telegram Mini App.
            </p>
          </div>
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-6">
            <LockKeyhole className="h-10 w-10 text-amber-200" />
            <h3 className="mt-5 text-2xl font-black">Данные защищены</h3>
            <p className="mt-3 leading-7 text-amber-50/85">
              Паспортные данные и права должны храниться только в приватной зоне. В интерфейсах и отчётах показываем минимум, нужный для работы.
            </p>
          </div>
          <div className="rounded-3xl border border-violet-300/20 bg-violet-300/10 p-6">
            <Clock3 className="h-10 w-10 text-violet-200" />
            <h3 className="mt-5 text-2xl font-black">Повторная аренда быстрее</h3>
            <p className="mt-3 leading-7 text-violet-50/85">
              После первой проверенной аренды клиент сможет идти по короткому пути: выбрать доступный байк, подтвердить условия и получить договор.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-slate-400">Планы дальше</p>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Что ещё запланировано</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {futureItems.map((item) => (
            <article key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-300">
                {item.status}
              </span>
              <h3 className="mt-4 text-xl font-black text-white">{item.title}</h3>
              <p className="mt-3 leading-7 text-slate-300">{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
