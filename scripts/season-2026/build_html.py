#!/usr/bin/env python3
"""Build SUMMARY.html iteration 1 -> /home/z/my-project/download/SUMMARY.html"""
import json, html

D = json.load(open("/home/z/my-project/scripts/summary_data.json"))
OUT = "/home/z/my-project/download/SUMMARY.html"

def money(x):
    return f"{x:,.0f}".replace(",", " ") + " ₽"

def esc(s):
    return html.escape(str(s if s is not None else "—"))

# ---------- tables ----------
def miss_table(rows, extra_note=None):
    if not rows:
        return "<p class='muted'>Нет данных</p>"
    th = ("<tr><th>№ дог.</th><th>Дата</th><th>Арендатор</th><th>ТС</th><th>Сумма</th><th>Залог</th></tr>")
    trs = []
    for m in rows:
        tot = money(m["total"]) if m.get("total") else "<span class='tbd'>уточнить</span>"
        dep = money(m["deposit"]) if m.get("deposit") else "—"
        note = f" <span class='warn'>({esc(m.get('note'))})</span>" if m.get("note") else ""
        trs.append(
            f"<tr><td>{esc(m['no'])}</td><td>{esc(m['date'])}</td><td>{esc(m['renter'])}{note}</td>"
            f"<td>{esc(m['vehicle'])}</td><td>{tot}</td><td>{dep}</td></tr>")
    return f"<table>{th}{''.join(trs)}</table>"

xlsx_tbl_rows = [
    ("Мотоцикл «Zero»", "2 дн + дефект + экип", "Платонов Данил", 30000, "нет договора в архиве"),
    ("Мотоцикл Зелёный Хорвин", "2 часа", "Коля «наш Бог»", 2000, "нет договора в архиве"),
    ("Кава зелёная", "—", "слава", 4000, "оплата «в счёт работ» (бартер)"),
    ("Кава зелёная", "2 суток", "Борский", 19000, "залог 20 000→18 500; «из Горелых разбил Вайвольт»"),
]
xlsx_tbl = "".join(
    f"<tr><td>{esc(a)}</td><td>{esc(b)}</td><td>{esc(c)}</td><td>{money(d)}</td><td class='muted'>{esc(e)}</td></tr>"
    for a, b, c, d, e in xlsx_tbl_rows)

P = D["projection"]
db = D["db"]
kpis = [
    ("281", "аренд в Supabase", "blue"),
    (money(db["revenue_total"]), "аренда учтена в БД", "blue"),
    (f"≈ 30", "аренд вне базы (май–июль)", "red"),
    (money(D["missing_doc_era_sum"] + P["xlsx_only_sum"]), "известных сумм вне базы", "red"),
    (money(P["projected_total"]) + "+", "сезон аренды после импорта", "green"),
    (money(D["cash"]["sale_sum"]), "продажи через кассу БД", "teal"),
    (money(D["xlsx_sales"]["profit_total"]), "прибыль продаж (Excel)", "teal"),
]
kpi_html = "".join(f"<div class='kpi {c}'><div class='kpi-v'>{v}</div><div class='kpi-l'>{l}</div></div>"
                   for v, l, c in kpis)

july_rows = sorted(D["missing_doc_era"], key=lambda m: m["date"] or "")
may_rows = sorted(D["missing_pre_doc"], key=lambda m: m["date"] or "")

CSS = """
:root{--bg:#F6F8FB;--card:#FFFFFF;--ink:#1A2332;--mut:#5A6B7E;--blue:#0F4C81;--red:#C0392B;
--amber:#B97A1A;--green:#2E8B57;--teal:#2C7A7B;--line:#E3E9F1}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 'Segoe UI',system-ui,-apple-system,Roboto,sans-serif}
.wrap{max-width:1120px;margin:0 auto;padding:28px 20px 60px}
header.hero{background:linear-gradient(135deg,#0F4C81 0%,#123B63 60%,#0E2F52 100%);color:#fff;border-radius:16px;padding:30px 34px;margin-bottom:22px}
header.hero h1{margin:0 0 6px;font-size:26px}
header.hero .sub{opacity:.85;font-size:14px}
.badge{display:inline-block;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:20px;padding:2px 12px;font-size:12.5px;margin-right:8px;margin-top:10px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:12px;margin-bottom:24px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;border-top:3px solid var(--blue)}
.kpi.red{border-top-color:var(--red)}.kpi.green{border-top-color:var(--green)}.kpi.teal{border-top-color:var(--teal)}
.kpi-v{font-size:19px;font-weight:700;white-space:nowrap}
.kpi-l{font-size:12.5px;color:var(--mut);margin-top:2px}
section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px 26px;margin-bottom:20px}
h2{margin:0 0 4px;font-size:19px;color:var(--blue)}
h2 .num{color:#9FB0C3;font-weight:600;margin-right:8px}
h3{margin:18px 0 8px;font-size:15.5px}
p.lead{color:var(--mut);margin:2px 0 14px;font-size:14px}
img.chart{width:100%;height:auto;border:1px solid var(--line);border-radius:10px;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:13.5px;margin:10px 0}
th{background:#EEF3F9;text-align:left;padding:7px 10px;border:1px solid var(--line);font-weight:600;white-space:nowrap}
td{padding:6px 10px;border:1px solid var(--line);vertical-align:top}
tr:nth-child(even) td{background:#FBFCFE}
.muted{color:var(--mut)}
.tbd{color:var(--amber);font-weight:600}
.warn{color:var(--amber)}
.note{background:#FFF7E8;border:1px solid #F0D9A8;border-left:4px solid var(--amber);border-radius:8px;padding:10px 14px;font-size:13.5px;margin:12px 0}
.danger{background:#FDF0EE;border:1px solid #EFC5BE;border-left:4px solid var(--red);border-radius:8px;padding:10px 14px;font-size:13.5px;margin:12px 0}
.ok{background:#EFF8F2;border:1px solid #C4E3D0;border-left:4px solid var(--green);border-radius:8px;padding:10px 14px;font-size:13.5px;margin:12px 0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:860px){.two{grid-template-columns:1fr}}
ol.steps{margin:8px 0;padding-left:22px}
ol.steps li{margin:7px 0}
.foot{color:var(--mut);font-size:12.5px;text-align:center;margin-top:26px}
.tag{display:inline-block;background:#EEF3F9;border:1px solid var(--line);border-radius:6px;padding:1px 8px;font-size:12px;margin:2px 3px 2px 0;color:var(--blue)}
"""

from collections import Counter
_st = Counter(r.get("status") for r in json.load(open("/home/z/my-project/scripts/rentals_full.json")))
completed_n = _st.get("completed", 0)
pending_n = _st.get("pending_confirmation", 0)

body = f"""
<div class="wrap">

<header class="hero">
  <h1>VipBike Электро — сезон 2026 · сводка данных</h1>
  <div class="sub">Сверка Supabase ↔ бумажный архив договоров ↔ Excel-журнал · итерация 1 · {esc('19.10.2026')}</div>
  <span class="badge">Цель босса: полная статистика сезона к 25.10.2026</span>
  <span class="badge">Аренды: май → октябрь</span>
  <span class="badge">Продажи: отдельная таблица (private.sale_contract_artifacts + касса)</span>
</header>

<div class="kpis">{kpi_html}</div>

<section id="s1">
  <h2><span class="num">1.</span>Архив «все договора.zip»: 145 файлов</h2>
  <p class="lead">Telegram-выгрузка договоров за весь сезон. Каждый файл распарсен: номер договора, дата, арендатор, ТС,
  период, сумма, залог, телефон. Классификация: аренды / продажи / тест-драйвы / шаблоны.</p>
  <img class="chart" src="charts/ch2_zip_class.png" alt="Состав архива">
  <p><span class="tag">88 аренд уже в базе</span><span class="tag">26 договоров аренды НЕ в базе (7 майских + 17 июльских + 2 долгосрочных)</span>
  <span class="tag">4 аренды только в Excel (без договоров)</span><span class="tag">11 тест-драйвов</span><span class="tag">4 ДКП продаж</span><span class="tag">9 пустых шаблонов</span><span class="tag">дубли Telegram («Восстановлен», «(1)»)</span></p>
  <div class="note"><b>Дубли — норма.</b> Telegram создаёт копии («Восстановлен» = автосохранение Word, «(1)» = повторная отправка).
  88 уникальных договоров заматчены на строки базы по связке «ТС + дата ±1–2 дня + фамилия арендатора».</div>
</section>

<section id="s2">
  <h2><span class="num">2.</span>Покрытие сезона данными: где разрыв</h2>
  <p class="lead">Бот-команда /doc заработала 04.06.2026, полная атрибуция — с 25.07.2026. Всё, что оформлялось «на бумаге» до этого,
  в базе отсутствует — его и доимпортируем.</p>
  <img class="chart" src="charts/ch1_coverage.png" alt="Покрытие">
  <div class="ok"><b>Уже сделано ранее (5 аренд, 46 000 ₽):</b> Коняхин 04.05 · Zero 04.05 · Ульви Мамед 06.05 ·
  Забалдин 30.05 · Шаронов 05.06 — импортированы с источником <code>retro_backfill_v1</code>. Эти строки исключены из плана импорта, задвоения не будет.</div>
</section>

<section id="s3">
  <h2><span class="num">3.</span>Аренда в Supabase: что уже учтено</h2>
  <img class="chart" src="charts/ch3_db_revenue.png" alt="Выручка по месяцам">
  <div class="two">
    <div>
      <h3>Источники строк</h3>
      <img class="chart" src="charts/ch6_sources.png" alt="Источники">
    </div>
    <div>
      <h3>Состояние базы (281 строка)</h3>
      <table>
        <tr><th>Статус</th><th>Кол-во</th></tr>
        <tr><td>completed</td><td>{completed_n}</td></tr>
        <tr><td>active (сейчас на аренде)</td><td>{db['active_rows']}</td></tr>
        <tr><td>pending_confirmation</td><td>{pending_n}</td></tr>
        <tr><td>cancelled</td><td>{db['cancelled']}</td></tr>
      </table>
      <p class="muted">Учтённая выручка {money(db['revenue_total'])} — это только цифровой учёт (без ручного мая).
      Касса подтверждает: <code>income_rental</code> = {money(D['cash']['income']['income_rental'])} за 173 операции —
      расхождение с суммой договоров объясняется депозитами/экипировкой/корректировками и станет частью итерации 2.</p>
    </div>
  </div>
</section>

<section id="s4">
  <h2><span class="num">4.</span>РАЗРЫВ: аренды, которых нет в базе</h2>
  <img class="chart" src="charts/ch4_missing_money.png" alt="Суммы вне базы">

  <h3>4.1 · Июль — начало августа: 19 договоров, которых нет в базе (17 июльских + 2 от 05.08)</h3>
  {miss_table(july_rows)}
  <p class="muted">Суммы извлечены из тел договоров («Итого к оплате»). У 5 договоров сумма в свободной форме — уточню на следующей итерации.
  «Ларин»: файл называется 29.06, внутри — договор №05.08/APRILIA от 05.08.2026 на 6 500 ₽.</p>

  <h3>4.2 · Май — начало июня: 7 договоров старого образца</h3>
  {miss_table(may_rows)}
  <p class="muted">Старый формат: суммы и тарифы вписаны в тело («арендной платы: 3 000 ₽ час / 12 000 ₽ сутки», «стоимость 8000 за 2 дня»).
  Разбор каждого — итерация 2. Забалдин (30.05) и Шаронов (05.06) уже в базе и из списка убраны.</p>

  <h3>4.3 · Только в Excel «Движения по ВипБайкЭлектро» (договоров нет вообще)</h3>
  <table><tr><th>Байк</th><th>Срок</th><th>Клиент</th><th>Сумма</th><th>Комментарий</th></tr>{xlsx_tbl}</table>

  <div class="danger"><b>Итог разрыва: ≈ 30 аренд.</b> Известные суммы — 171 250 ₽ (июль) + 55 000 ₽ (Excel) ≈ <b>226 250 ₽</b>,
  плюс 6 майских договоров с суммами в теле (оценочно 40–60 тыс ₽). После импорта сезон аренды: <b>{money(P['projected_total'])}+</b> вместо {money(db['revenue_total'])}.</div>

  <div class="note"><b>Два долгосрочных договора-исключения</b> (аренда без экипажа с субарендой, Сидоров И.О. — совладелец):
  №15.06 (15.06→15.11, Молев) и №4 от 05.08 (05.08→30.11, Буробин, Ducati, тариф 12 000/сут).
  Это партнёрская схема, а не обычная аренда — <b>вопрос: включать в сезонную статистику отдельной строкой или не включать?</b></div>
</section>

<section id="s5">
  <h2><span class="num">5.</span>Продажи — отдельный контур (как и просил босс)</h2>
  <p class="lead">ДКП хранятся в <code>private.sale_contract_artifacts</code> (4 договора в архиве), деньги — в кассе БД
  <code>cash_transactions.income_sale</code> (35 операций). Журнал Excel даёт полную картину юнит-экономики.</p>
  <img class="chart" src="charts/ch5_sales.png" alt="Продажи">
  <table>
    <tr><th>Показатель</th><th>Касса БД</th><th>Excel (на 29.09)</th></tr>
    <tr><td>Выручка с продаж</td><td>{money(D['cash']['sale_sum'])} (35 оплат)</td><td>{money(D['xlsx_sales']['revenue_total'])}</td></tr>
    <tr><td>Закупка проданных мото</td><td>—</td><td>{money(D['xlsx_sales']['cost_total'])}</td></tr>
    <tr><td>Прибыль</td><td>—</td><td><b>{money(D['xlsx_sales']['profit_total'])}</b></td></tr>
    <tr><td>Склад на конец сезона</td><td>—</td><td>{money(D['xlsx_sales']['stock_salon'])} салон + {money(D['xlsx_sales']['stock_partner'])} партнёрская</td></tr>
  </table>
  <p class="muted">В кассу попали не все продажи (наличные мимо кассы, USDT, бартеры — видно по Excel: «карта китайца», «БАРТЕР ОЛЕГ», «в аренду ушел»).
  Для итоговой статистики босса источником продаж будет Excel, касса — для сверки.</p>
</section>

<section id="s6">
  <h2><span class="num">6.</span>План импорта (retro_backfill_v2)</h2>
  <ol class="steps">
    <li><b>Итерация 2:</b> глубокий разбор 6 майских договоров + 5 июльских без суммы — вытаскиваю суммы/залоги/телефоны. Сверю с распиской кассы.</li>
    <li><b>Итерация 3:</b> импорт 30 аренд в <code>rentals</code>: source=<code>retro_backfill_v2</code>, metadata: contract_no, file sha256, renter_name/phone,
    vehicle_id по слагам базы (для Red Panigale — создать или отнести к ducati-panigale-s-electro), walk-in user 356282674, crew vip-bike.</li>
    <li><b>Итерация 4:</b> пометить 5 старых retro-строк (дописать contract_no/sha в metadata), TOTAL SEASON дашборд: аренда+продажи+расходы, прибыль по байкам, 50/50 партнёрских.</li>
  </ol>
  <p class="muted">Идемпотентность: перед вставкой — проверка по (дата+ТС+сумма) и по contract_no; каждая строка получает запись в metadata.history («импорт из архива 19.10.2026»).</p>
</section>

<section id="s7">
  <h2><span class="num">7.</span>Вопросы боссу (по ходу дела)</h2>
  <ol class="steps">
    <li>Долгосрочные договоры Сидорова (субаренда) — в статистику аренды или отдельным блоком «партнёрка»?</li>
    <li>Ducati Panigale <i>Red</i> (Чуфыркин 05.07, Халикова 08.07) — байка нет в <code>cars</code>. Создать карточку или падать на другой слаг?</li>
    <li>Борский 19 000 ₽ + «из Горелых разбил Вайвольт» — это аренда или страховой случай? Влияние на прибыль байка.</li>
    <li>Оплата «в счёт работ» (слава, 4 000 ₽) — бартер: считать в выручку сезона или нет?</li>
    <li>Экипировка 4 000 ₽ (Шаронов) — в базе лежит только 10 000 ₽ аренды; добирать ли отдельной строкой?</li>
  </ol>
</section>

<p class="foot">Сгенерировано автоматически · данные: Supabase (281 rentals, 331 cash_transactions) · архив 145 файлов · Excel «Все движения по ВипБайкЭлектро 2026» · итерация 1 из 4</p>
</div>
"""

html_doc = f"""<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VipBike Электро — сезон 2026 · сводка данных</title><style>{CSS}</style></head>
<body>{body}</body></html>"""

open(OUT, "w").write(html_doc)
print("written:", OUT, len(html_doc), "bytes")
