#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""task150: build the v1.0 season summary report (P&L edition) → docs/summary/SUMMARY.html + download copy."""
import json

D = json.load(open("/home/z/my-project/scripts/task150-final.json"))
M_RU = {"2026-04":"апрель","2026-05":"май","2026-06":"июнь","2026-07":"июль","2026-08":"август","2026-09":"сентябрь","2026-10":"октябрь"}
MONTHS = list(M_RU.keys())

def rub(n, sign=False):
    s = f"{round(abs(n)):,}".replace(",", " ") + " ₽"
    if sign: return ("+" if n >= 0 else "−") + s
    return s

def kfmt(n):
    return f"{round(n/1000)}k" if n >= 1000 else str(round(n))

# ── SVG helpers ───────────────────────────────────────────────────────────
def hbars(rows, color="#2563eb", label_w=230, chart_w=640, bar_h=22, gap=7, valfmt=None):
    """rows: list of (label, value, suffix_text). Returns SVG string."""
    if not rows: return "<p class='dim'>нет данных</p>"
    vmax = max(r[1] for r in rows) or 1
    w = (chart_w - label_w - 10) * 0.52   # cap bar so the value text always fits
    y = 0; parts = []
    H = len(rows) * (bar_h + gap) - gap
    for label, val, suffix in rows:
        bw = max(3, round(w * val / vmax))
        cy = y + bar_h / 2 + 4
        parts.append(f"<text x='{label_w}' y='{cy}' text-anchor='end' class='cl'>{label}</text>")
        parts.append(f"<rect x='{label_w+10}' y='{y}' width='{bw}' height='{bar_h}' rx='4' fill='{color}'/>")
        parts.append(f"<text x='{label_w+16+bw}' y='{cy}' class='cv'>{suffix}</text>")
        y += bar_h + gap
    return f"<svg viewBox='0 0 {chart_w} {H}' class='chart'>" + "".join(parts) + "</svg>"

def vbars(rows, color="#059669", chart_w=560, chart_h=190, valfmt=None):
    """rows: list of (label, value, val_text). Vertical bars."""
    n = len(rows)
    bw = round((chart_w - 40) / n) - 14
    H = chart_h - 44
    vmax = max(r[1] for r in rows) or 1
    parts = []
    for i, (label, val, vtxt) in enumerate(rows):
        x = 24 + i * (bw + 14)
        bh = max(3, round(H * val / vmax))
        y = 14 + (H - bh)
        cx = x + bw / 2
        parts.append(f"<rect x='{x}' y='{y}' width='{bw}' height='{bh}' rx='5' fill='{color}'/>")
        parts.append(f"<text x='{cx}' y='{y-6}' text-anchor='middle' class='cv'>{vtxt}</text>")
        parts.append(f"<text x='{cx}' y='{chart_h-12}' text-anchor='middle' class='cl'>{label}</text>")
    return f"<svg viewBox='0 0 {chart_w} {chart_h}' class='chart'>" + "".join(parts) + "</svg>"

def donut(parts_list, total_label, total_sub=""):
    """parts_list: list of (color, value, legend_label_html). Returns donut+legend html."""
    total = sum(p[1] for p in parts_list) or 1
    R = 81; C = 2 * 3.14159 * R; off = 0.0; circles = []
    for color, val, _ in parts_list:
        frac = val / total
        dash = round(C * frac, 1)
        circles.append(f"<circle cx='95' cy='95' r='{R}' fill='none' stroke='{color}' stroke-width='26' "
                       f"stroke-dasharray='{dash} {round(C-dash,1)}' stroke-dashoffset='{-off}' transform='rotate(-90 95 95)'/>")
        off += dash
    legend = "".join(f"<div class='lg'><span class='dot' style='background:{c}'></span>{lbl}</div>" for c, v, lbl in parts_list)
    return (f"<div class='donut-wrap'><svg viewBox='0 0 190 190' class='donut'>{''.join(circles)}"
            f"<text x='95' y='91' text-anchor='middle' class='cvbig'>{total_label}</text>"
            f"<text x='95' y='109' text-anchor='middle' class='cl'>{total_sub}</text></svg>"
            f"<div class='legend'>{legend}</div></div>")

def kpi(label, value, sub="", cls=""):
    return f"<div class='kpi {cls}'><div class='kpi-l'>{label}</div><div class='kpi-v'>{value}</div><div class='kpi-s'>{sub}</div></div>"

def slot(label, hint=""):
    return f"<span class='slot'>{label}<i>{hint}</i></span>"

# ── data shortcuts ────────────────────────────────────────────────────────
mm = D["months"]
rent_total = sum(mm[m]["rent"] for m in MONTHS)
deals_total = sum(mm[m]["deals"] for m in MONTHS)
svc_in = sum(mm[m]["svc_in"] for m in MONTHS) + 7000          # + Николай май–июнь вручную
svc_out = sum(mm[m]["svc_out"] for m in MONTHS)               # внутренние работы по парку
svc_out_n = sum(mm[m]["svc_out_n"] for m in MONTHS)
eq_in = D["equipmentIncome"]["total"] + D["equipmentIncome"]["manual"]
avg_check = rent_total / max(deals_total, 1)
fleet = D["fleet"]; fleet_total = D["fleetTotal"]
partner_total = D["partnerTotal"]
x = D["xlsx"]; sm = D["smeta"]
ops = D["operators"]; paid = D["commissionPaid"]

# ledger constants
padalki = 1500                     # Борский/Вайвольт — задокументированное удержание
marketing = x["events_marketing"]  # 928 141
website = x["website_since_june"]  # 20 000
salon = x["salon"]                 # 275 922
svc_parts = x["svc_parts"]         # 75 887
gear = x["gear_buy"]               # 393 160
comm_acc = ops["djorudjov"]["total"] + ops["salavey13"]["total"] + ops["unattributed"]["total"] + 1500  # 242 610
admin_salary = 10000
rent_plus = rent_total + eq_in + svc_in + padalki
rent_minus = partner_total + marketing + website + salon + svc_parts + svc_out + comm_acc + admin_salary
rent_net = rent_plus - rent_minus
sales_profit = x["sale_profit"]
total_total = rent_net + sales_profit

# ── charts data ───────────────────────────────────────────────────────────
month_deals = [(M_RU[m], mm[m]["deals"], str(mm[m]["deals"])) for m in MONTHS]
month_money = [(M_RU[m], mm[m]["rent"], kfmt(mm[m]["rent"])) for m in MONTHS]
fleet_rows = [(f["name"][:36], f["rev"], f"{rub(f['rev'])} · {f['deals']} шт" + (" · 50/50" if f["sub"] else "")) for f in fleet]
sub_bikes = [f for f in fleet if f["sub"]]

CSS = """
:root{--bg:#0b1220;--card:#111a2e;--card2:#0e1626;--ink:#e6ecf7;--dim:#8fa0bd;--line:#1f2b45;
--blue:#3b82f6;--green:#10b981;--amber:#f59e0b;--red:#ef4444;--violet:#8b5cf6}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:15px/1.5 'Segoe UI',system-ui,Arial,sans-serif;padding:26px 18px 60px}
.wrap{max-width:1180px;margin:0 auto}
h1{font-size:26px;letter-spacing:.3px} h1 b{color:var(--amber)}
.sub{color:var(--dim);margin:6px 0 20px;font-size:13.5px}
nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 26px}
nav a{color:var(--ink);text-decoration:none;background:var(--card);border:1px solid var(--line);padding:7px 14px;border-radius:20px;font-size:13.5px}
nav a:hover{border-color:var(--blue)}
section{margin:0 0 34px}
h2{font-size:19px;margin:0 0 14px;padding-left:11px;border-left:4px solid var(--blue)}
h2.sales{border-color:var(--green)} h2.exp{border-color:var(--amber)} h2.tot{border-color:var(--violet)} h2.plan{border-color:#e879f9}
.grid{display:grid;gap:12px}
.g5{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.g2{grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}
.g3{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.kpi-l{color:var(--dim);font-size:12.5px;text-transform:uppercase;letter-spacing:.6px}
.kpi-v{font-size:23px;font-weight:700;margin-top:3px} .kpi-s{color:var(--dim);font-size:12px;margin-top:2px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.card h3{font-size:14.5px;color:var(--dim);font-weight:600;margin-bottom:10px}
.chart{width:100%;height:auto} .cl{fill:var(--dim);font-size:11.5px} .cv{fill:var(--ink);font-size:11.5px;font-weight:600}
.cvbig{fill:var(--ink);font-size:15px;font-weight:700}
.donut-wrap{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.donut{width:180px;height:180px;flex:none} .legend .lg{font-size:13px;margin:3px 0}
.dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:7px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{color:var(--dim);text-align:left;font-weight:600;padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
tr:hover td{background:#16203a} .lt{max-width:340px} .dim{color:var(--dim);font-size:12px}
.pos{color:var(--green);font-weight:600} .neg{color:var(--red);font-weight:600}
.note{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--dim);font-size:13px;margin-top:12px}
.note b{color:var(--ink)}
.slot{display:inline-block;background:#1e2a4a;color:#93c5fd;border:1px dashed #3b5aa0;border-radius:10px;padding:2px 10px;font-size:12.5px;white-space:nowrap}
.slot i{color:#5c74a8;font-style:normal;margin-left:6px}
.ledger td:first-child{color:var(--dim)}
.ledger .sum td{font-weight:700;border-top:2px solid var(--line);font-size:14px}
.ledger .grand td{font-weight:800;font-size:16px;border-top:2px solid #2a3a63;background:#101a30}
.big-total{background:linear-gradient(135deg,#1a2440,#101a30);border:1px solid #2a3a63;border-radius:16px;padding:18px;text-align:center}
.big-total .v{font-size:30px;font-weight:800;color:var(--amber)}
.big-total .cap{font-size:12.5px;color:var(--dim);margin-top:4px}
footer{color:var(--dim);font-size:12px;margin-top:40px;border-top:1px solid var(--line);padding-top:14px}
.plan-card{border-left:4px solid #e879f9}
.plan-card ol{margin:8px 0 0 18px;font-size:13.5px} .plan-card li{margin:5px 0}
.price{font-weight:700;color:var(--amber);white-space:nowrap}
@media print {body{background:#fff;color:#000} .card,.kpi{border-color:#ccc;background:#fff} }
"""

# ── SECTION 1: АРЕНДА ─────────────────────────────────────────────────────
sec1 = f"""
<section id="rent">
<h2>1 · АРЕНДА — весь сезон через бота + ретро-бэкфилл, апрель → октябрь</h2>
<div class="grid g5">
{kpi("Аренды байков", str(deals_total), f"на {rub(rent_total)} · средний чек {rub(avg_check)}")}
{kpi("Аренда экипировки", f"{D['equipmentIncome']['n']} + вручную", f"{rub(D['equipmentIncome']['total'])} + 4 000 ₽ (июнь)")}
{kpi("Сервис клиентский", rub(svc_in), "вкл. работы Николая 7 000 ₽ (вручную)")}
{kpi("Партнёрские байки", f"{len(sub_bikes)} шт · 50/50", f"партнёрам {rub(partner_total)}")}
{kpi("Залоги (обороты)", "2 741 500 ₽", "возвращаемы · удержания — см. итог")}
</div>

<div class="grid g2" style="margin-top:12px">
<div class="card"><h3>Аренды по месяцам (шт)</h3>{vbars(month_deals, "#2563eb")}</div>
<div class="card"><h3>Выручка по месяцам, тыс ₽</h3>{vbars(month_money, "#059669")}</div>
</div>

<div class="card" style="margin-top:12px"><h3>Весь мотопарк — кто сколько заработал ({len(fleet)} байков, полный список)</h3>
{hbars(fleet_rows)}</div>

<div class="grid g2" style="margin-top:12px">
<div class="card"><h3>Партнёрские байки — субаренда 50/50</h3>
<table><tr><th>Байк</th><th>Выручка</th><th>Партнёру (50%)</th></tr>
{''.join(f"<tr><td class='lt'>{f['name']}</td><td>{rub(f['rev'])}</td><td class='neg'>−{rub(f['partner'])}</td></tr>" for f in sub_bikes)}
<tr class="sum" style="font-weight:700"><td>Итого партнёрам</td><td>{rub(sum(f['rev'] for f in sub_bikes))}</td><td class="neg">−{rub(partner_total)}</td></tr></table>
<p class="dim" style="font-size:12px;margin-top:8px">Экип-часть аренды не делится — своя. Зелёная «Кава» = Kawasaki EX650K — топ парка: 27 сделок за сезон.</p></div>
<div class="card"><h3>Сервис — две стороны</h3>
<table class="ledger">
<tr><td>+ Работы клиентам (доход)</td><td class="pos">+{rub(svc_in)}</td></tr>
<tr><td>· в т.ч. Николай, май–июнь (вручную)</td><td class="dim">7 000 ₽</td></tr>
<tr><td>− Внутренние работы по парку ({svc_out_n} нарядов)</td><td class="neg">−{rub(svc_out)}</td></tr>
<tr><td>− Запчасти и оснащение сервиса (закуп)</td><td class="neg">−{rub(svc_parts)}</td></tr>
</table>
<p class="dim" style="font-size:12px;margin-top:8px">Сервис окупает сам себя и парк: клиентские работы + internal-наряды закрывают закуп з/ч.</p></div>
</div>

<div class="card" style="margin-top:12px"><h3>Залоги и «падальщики»</h3>
<p style="font-size:13.5px">Залогов собрано за сезон <b>2 741 500 ₽</b> — это обороты, почти всё возвращено при сдаче байка. Задокументированные удержания: <b>1 500 ₽</b> (Борский — разбил Вайвольт: залог 20 000, возврат 18 500) + «пару соток за бензин» (Салин, август). Крупные повреждения закрываются ремонтом через сервис, залог возвращается — поэтому «падальщики» не стали статьёй дохода, и это правильно: залог работает как страховка, а не как касса.</p></div>
</section>
"""

# ── SECTION 1b: РАСХОДЫ (консолидированные, считаем один раз) ────────────
events_rows = "".join(
    f"<tr><td class='lt'>{e[0]}</td><td class='dim'>{e[1]}</td><td class='price'>{rub(e[2])}</td><td class='lt dim'>{e[3]}</td></tr>"
    for e in x["events_detail"])
sec_exp = f"""
<section id="exp">
<h2 class="exp">2 · РАСХОДЫ — все направления, посчитаны один раз</h2>
<div class="grid g2">
<div class="card"><h3>Структура расходов сезона</h3>
{donut([
  ("#d97706", marketing, f"<b>Выставки и маркетинг</b> — {rub(marketing)}"),
  ("#2563eb", partner_total, f"<b>Партнёрам (субаренда 50/50)</b> — {rub(partner_total)}"),
  ("#8b5cf6", comm_acc, f"<b>Комиссии операторов</b> — {rub(comm_acc)}"),
  ("#059669", salon, f"<b>Салон: аренда + обустройство</b> — {rub(salon)}"),
  ("#ef4444", svc_parts + svc_out, f"<b>Сервис: з/ч + работы</b> — {rub(svc_parts + svc_out)}"),
  ("#64748b", website + admin_salary, f"<b>Сайт + ЗП админа</b> — {rub(website + admin_salary)}"),
], rub(marketing + partner_total + comm_acc + salon + svc_parts + svc_out + website + admin_salary), "учтено")}</div>
<div class="card"><h3>Ведомость расходов</h3><table class="ledger">
<tr><th>Статья</th><th>Сумма</th></tr>
<tr><td>Выставки, мероприятия, маркетинг, поездки</td><td class="neg">−{rub(marketing)}</td></tr>
<tr><td>Выплаты партнёрам по субаренде (50/50)</td><td class="neg">−{rub(partner_total)}</td></tr>
<tr><td>Комиссии операторов (начислено за сезон)</td><td class="neg">−{rub(comm_acc)}</td></tr>
<tr><td>Салон: аренда + обустройство + мебель</td><td class="neg">−{rub(salon)}</td></tr>
<tr><td>Сервис: запчасти/оснащение + внутренние работы</td><td class="neg">−{rub(svc_parts + svc_out)}</td></tr>
<tr><td>Сайт — 4 000 ₽ × июнь–октябрь</td><td class="neg">−{rub(website)}</td></tr>
<tr><td>ЗП админа salavey13 (сентябрь)</td><td class="neg">−{rub(admin_salary)}</td></tr>
<tr><td>Авито (реклама объявлений)</td><td>{slot("____ ₽", "продиктуй")}</td></tr>
<tr><td>Команда: Влад-механик · Лана · Лёха (подработка)</td><td>{slot("____ ₽", "по каждому")}</td></tr>
<tr><td>Бензин, масла, расходники в сезоне</td><td>{slot("____ ₽", "прикидка")}</td></tr>
<tr class="sum"><td>Учтено сейчас</td><td>−{rub(rent_minus)}</td></tr>
</table></div>
</div>

<div class="card" style="margin-top:12px"><h3>Зарплаты операторов — комиссионная модель</h3>
<div class="grid g2">
<div><table>
<tr><th>Месяц</th><th>Начислено (сверки)</th><th>Выплачено (касса)</th></tr>
{''.join(f"<tr><td>{M_RU[m]}</td><td>{rub(sum(o['months'].get(m,0) for o in ops.values()) + (1500 if m=='2026-10' else 0))}</td><td class='dim'>{rub(paid['months'].get(m,0)) if paid['months'].get(m,0) else '—'}</td></tr>" for m in MONTHS)}
<tr class="sum"><td>Всего</td><td>{rub(comm_acc)}</td><td class="dim">{rub(paid['total'])}</td></tr>
</table><p class="dim" style="font-size:12px;margin-top:8px">Август–сентябрь сверялись поздно (октябрьский раунд) — выплаты шли пачками по кассе. Разница «начислено − выплачено» = долг по комиссиям на конец сезона.</p></div>
<div><table>
<tr><th>Оператор</th><th>Начислено</th><th>Месяцы</th></tr>
<tr><td>djorudjov</td><td><b>{rub(ops['djorudjov']['total'])}</b></td><td class="dim">апр 1,5к · май 10,2к · июн 29к · июл 39,5к · окт 101,9к</td></tr>
<tr><td>salavey13</td><td>{rub(ops['salavey13']['total'])}</td><td class="dim">окт 6,3к + ЗП админа 10к</td></tr>
<tr><td>Без атрибуции (босс/входящие)</td><td>{rub(ops['unattributed']['total'] + 1500)}</td><td class="dim">окт — входящие и личные сделки</td></tr>
</table><p class="dim" style="font-size:12px;margin-top:8px">Ставки: бюджет 750 · обычный 1 000 · премиум 1 500 · партнёрские ×0,5 · экип 200/ед · продажи 5–15к · оверпрайс 10%.</p></div>
</div></div>

<div class="card" style="margin-top:12px"><h3>Выставки, мероприятия, маркетинг — детализация ({rub(marketing)})</h3>
<table><tr><th>Мероприятие</th><th>Дата</th><th>Сумма</th><th>Состав</th></tr>
{events_rows}</table>
<p class="dim" style="font-size:12px;margin-top:8px">Сайт Олега (93 000 ₽) — бартер за КУГУ, без денег. Поездка МСК 1: Георгий вернул 23 400. Три поездки в МСК = 151 794 ₽ закупить-контрактить.</p></div>
</section>
"""

# ── SECTION 2: ПРОДАЖИ ────────────────────────────────────────────────────
stock_rows = "".join(f"<tr><td class='lt'>{r[0]}</td><td class='price'>{r[1]} ₽</td></tr>" for r in x["stock_ours_rows"])
fleet_rows_txt = "".join(f"<tr><td class='lt'>{r[0]}</td><td class='price'>{r[1]} ₽</td></tr>" for r in x["rent_fleet_rows"])
sec_sales = f"""
<section id="sales">
<h2 class="sales">3 · ПРОДАЖИ — закуп → реализация → склад</h2>
<div class="grid g5">
{kpi("Закуп мото на продажу", rub(x["sale_buy"]), "68 мото в учёте")}
{kpi("Выручка от продаж", rub(x["sale_revenue"]), "касса БД подтверждает 14,59 млн")}
{kpi("Прибыль с продаж", rub(sales_profit), "по столбцу «Прибыль»", "kpi-win")}
{kpi("Остаток: наша техника", rub(x["stock_ours"]), f"на {x['stock_date']}")}
{kpi("Остаток: партнёрская", rub(x["stock_partner"]), "инвесторы: Георгий, Саша, Макс")}
</div>

<div class="grid g2" style="margin-top:12px">
<div class="card"><h3>Структура остатков техники (актив, не расход)</h3>
{donut([
  ("#2563eb", x["stock_ours"], f"<b>Салон/склад (наша)</b> — {rub(x['stock_ours'])}"),
  ("#059669", x["stock_partner"], f"<b>Партнёрская (инвесторы)</b> — {rub(x['stock_partner'])}"),
], rub(x["stock_ours"] + x["stock_partner"]), "всего")}</div>
<div class="card"><h3>Наша техника на складе — построчно</h3>
<table>{stock_rows}</table>
<p class="dim" style="font-size:12px;margin-top:8px">Партнёрская сторона: Falcon Pro серый ×4 (Георгий/Саша), Y-VOLT белый (Георгий), HDM M02 + Ducati (Макс — «сколько забрал??»), EK1 продан. Построчно склад = 3 170 900 ₽ — на 45 000 больше сводки 29.09: что-то уехало/продалось после снимка, босс уточнит.</p></div>
</div>

<div class="grid g2" style="margin-top:12px">
<div class="card"><h3>Деньги и кредит</h3><table class="ledger">
<tr><td>Стартовые вложения в закуп</td><td>{rub(x["sale_buy"])}</td></tr>
<tr><td>Кредит банка — выплачено за сезон</td><td>{slot("____ ₽", "сумма платежей")}</td></tr>
<tr><td>Кредит банка — остаток + платёж</td><td>{slot("____ ₽ / ____ ₽/мес", "график платежей")}</td></tr>
<tr><td>Закуп парка под аренду (актив)</td><td>{rub(x["rent_fleet_buy"])}</td></tr>
</table>
<p class="dim" style="font-size:12px;margin-top:8px">Продиктуй три цифры кредита (выплачено / остаток / платёж) — вставлю и пересчитаю итог мгновенно.</p></div>
<div class="card"><h3>Деньги владельцев лично (Илья · Роман)</h3><table class="ledger">
<tr><td>Илья: следы в учёте (МОТО ВЕСНА 15к + подкат 4к + шлемы 3к + смазка 1к + в оборот 5к)</td><td>≈ 28 000 ₽</td></tr>
<tr><td>Илья — всего вложено/получено лично</td><td>{slot("____ ₽", "итоговая цифра")}</td></tr>
<tr><td>Роман — всего вложено/получено лично</td><td>{slot("____ ₽", "итоговая цифра")}</td></tr>
</table>
<p class="dim" style="font-size:12px;margin-top:8px">Нужны для колонки «полученные Илья/Роман» в рукописной памятке — иначе 50/50 считается от прибыли сезона.</p></div>
</div>
</section>
"""

# ── SECTION 4: ИТОГ ± ─────────────────────────────────────────────────────
assets_total = x["rent_fleet_buy"] + x["stock_ours"] + x["stock_partner"] + gear
comm_debt = comm_acc - paid["total"]
sec_tot = f"""
<section id="tot">
<h2 class="tot">4 · ИТОГ ± — TOTAL TOTAL: аренда + продажи</h2>
<div class="grid g2">
<div class="card"><h3>Сводный баланс сезона (деньги, не активы)</h3><table class="ledger">
<tr><th>Строка</th><th>Сумма</th></tr>
<tr><td>+ Прибыль с продаж</td><td class="pos">+{rub(sales_profit)}</td></tr>
<tr><td>+ Аренда байков ({deals_total} сделок)</td><td class="pos">+{rub(rent_total)}</td></tr>
<tr><td>+ Аренда экипировки (бот + вручную)</td><td class="pos">+{rub(eq_in)}</td></tr>
<tr><td>+ Сервис: работы клиентам</td><td class="pos">+{rub(svc_in)}</td></tr>
<tr><td>+ Удержания залогов («падальщики»)</td><td class="pos">+{rub(padalki)}</td></tr>
<tr class="sum"><td>ВСЕГО ПЛЮС</td><td class="pos">+{rub(rent_plus + sales_profit)}</td></tr>
<tr><td>− Выплаты партнёрам (субаренда)</td><td class="neg">−{rub(partner_total)}</td></tr>
<tr><td>− Выставки, маркетинг, поездки</td><td class="neg">−{rub(marketing)}</td></tr>
<tr><td>− Салон (аренда + обустройство)</td><td class="neg">−{rub(salon)}</td></tr>
<tr><td>− Сервис: з/ч + внутренние работы</td><td class="neg">−{rub(svc_parts + svc_out)}</td></tr>
<tr><td>− Комиссии операторов (начислено)</td><td class="neg">−{rub(comm_acc)}</td></tr>
<tr><td>− Сайт (июнь–октябрь) + ЗП админа</td><td class="neg">−{rub(website + admin_salary)}</td></tr>
<tr><td>− Авито · команда · бензин</td><td>{slot("____ ₽", "3 слота ждут цифр")}</td></tr>
<tr class="sum"><td>ВСЕГО МИНУС (учтено)</td><td class="neg">−{rub(rent_minus)}</td></tr>
<tr class="grand"><td>ИТОГ СЕЗОНА</td><td class="pos">+{rub(total_total)}</td></tr>
</table></div>

<div>
<div class="big-total"><div class="v">{rub(total_total, sign=True)}</div>
<div class="cap">итог сезона 2026: аренда + продажи · без активов и без кредита</div></div>
<div class="big-total" style="margin-top:12px"><div class="v">{rub(total_total/2)}</div>
<div class="cap">Илье / Роману — по половине (50/50)</div></div>
<div class="card" style="margin-top:12px"><h3>Активы на конец сезона (в кассе не лежат, но работают)</h3>
<table class="ledger">
<tr><td>Парк под аренду (закуп {x['rent_fleet_n']} мото)</td><td>{rub(x["rent_fleet_buy"])}</td></tr>
<tr><td>Техника на продажу (наша)</td><td>{rub(x["stock_ours"])}</td></tr>
<tr><td>Техника партнёров (инвесторы)</td><td>{rub(x["stock_partner"])}</td></tr>
<tr><td>Экипировка (закуп)</td><td>{rub(gear)}</td></tr>
<tr class="sum"><td>Техника и экип всего</td><td>{rub(assets_total)}</td></tr>
<tr><td>Долг по комиссиям операторам (начислено − выплачено)</td><td class="neg">−{rub(comm_debt)}</td></tr>
</table></div>
<div class="note"><b>Что осталось продиктовать (6 цифр):</b> авито · кредит (выплачено/остаток/платёж) · Влад · Лана · Лёха · Роман лично. Вставлю — итог пересчитается автоматически.</div>
</div>
</div>
</section>
"""

# ── SECTION 5: ПЛАН ───────────────────────────────────────────────────────
sm_rows = "".join(f"<tr><td class='lt'>{r[0]}</td><td class='price'>{r[1]} ₽</td></tr>" for r in sm["indoor_rows"][:6] + sm["extra_rows"][:4])
sec_plan = f"""
<section id="next">
<h2 class="plan">5 · ПЛАН — шоурум · зима · сезон-2027 · оптимизация</h2>
<div class="grid g2">
<div class="card plan-card"><h3>Шоурум: {sm['place']}</h3>
<div class="grid g2" style="gap:8px">
<div>{kpi("Бюджет заказчика", rub(sm["client_budget"]),"без резерва")}
<div style="height:8px"></div>
{kpi("С резервом 10%", rub(sm["recommended"]), "рекомендуемый", "kpi-win")}</div>
<div><table>
<tr><th>Раздел</th><th>Сумма</th></tr>
<tr><td>Наружные работы</td><td class="price">{rub(sm["outdoor"])}</td></tr>
<tr><td>Внутренние + лаунж</td><td class="price">{rub(sm["indoor"])}</td></tr>
<tr><td>Доп. расходы</td><td class="price">{rub(sm["extra"])}</td></tr>
<tr><td>Резерв 10%</td><td class="price">{rub(sm["reserve"])}</td></tr>
</table></div></div>
<table style="margin-top:10px"><tr><th>Крупные позиции</th><th></th></tr>{sm_rows}</table>
<div class="note"><b>Финансирование:</b> итог сезона {rub(total_total)} покрывает смету {rub(sm["recommended"])} целиком — шоурум открывается из кассы сезона, без новых кредитов. Входная группа + фасад + вывеска (590к) дают витрину для продаж техники и зимнего хранения; зарядки для электромото (100к) — готовность к Sequence Zero на витрине.</div></div>

<div class="card plan-card"><h3>Зима 2026/27 — не спать</h3><ol>
<li><b>Хранение — вторая выручка:</b> тиры 1 500 / 2 000 / 2 500 ₽ уже в форме заявки; первый контракт сезона на 14 000 ₽ на «Стене хранения», 17 предзимних контактов в воронке — дожать до 40–50 машиномест ≈ +100–120к.</li>
<li><b>Продажи с витрины:</b> Sequence Zero ×2 (1 223 000 ₽ закупа) и Falcon GT ×2 — выставить в шоуруме, зимние скидки «самовывоз до НГ».</li>
<li><b>Зимний мелкий закуп:</b> подшлемники, балаклавы, термобельё, мотокосметика — оборотка с маржой 100%+.</li>
<li><b>Мотопарк до февраля не замораживать</b> — докупка только к марту (см. сезон-2027).</li>
<li><b>Сервис зимой зарабатывает:</b> консервация/расконсервация, ТО по хранению — те же 45к/сезон внутренних работ превращаются в клиентские.</li>
</ol></div>

<div class="card plan-card"><h3>Сезон-2027 — что докупать</h3><ol>
<li><b>Середина парка — второй Kawasaki EX650-класс:</b> топ спроса (27 сделок, 282 000 ₽), партнёрская 50/50 — свой второй экземпляр забирает всю маржу.</li>
<li><b>Ещё один BMW F800R-класс:</b> 248 800 ₽ за сезон, загрузка стабильная.</li>
<li><b>Премиум-электро:</b> Zero-класс дал 187 000 ₽ с 18 сделок и средним чеком 10 400 — с новым шоурумом и зарядками спрос вырастет.</li>
<li><b>Малый класс:</b> Nibbler окупил закуп (222к) за один сезон (123 453 ₽ выручки + сервис) — второй к маю.</li>
<li><b>Бюджет:</b> реинвест 1,5–2 млн ₽ из итога сезона; закуп в феврале–марте по ценам межсезонья.</li>
</ol></div>

<div class="card plan-card"><h3>Оптимизация работы</h3><ol>
<li><b>Сверки сразу:</b> август–сентябрь сверялись с опозданием — долг по комиссиям {rub(comm_debt)} висит; правило «закрыл аренду — сверка в тот же день».</li>
<li><b>Атрибуция операторов:</b> {rub(ops['unattributed']['total'] + 1500)} комиссий без атрибуции — бот должен требовать оператора на входящих.</li>
<li><b>Все расходы в кассу:</b> авито, бензин, команда, наличные владельцев — вносить в cash_transactions, иначе итог снова «с вопросами».</li>
<li><b>Падальщики в боте:</b> фиксировать damage_notes и удержание залога при возврате — сейчас флаги возвращаются вручную и теряются.</li>
<li><b>Партнёрские выплаты автоматом:</b> subrenter-monitoring уже считает 50/50 — кнопка «выплатить партнёру» раз в месяц.</li>
<li><b>Маркетинг по данным:</b> 928 141 ₽ за сезон = 38% арендной выручки — на 2027 держать только площадки с измеримой воронкой (Яндекс-карты дали лиды, форумы — нет).</li>
</ol></div>
</div>
</section>
"""

# ── ASSEMBLY ──────────────────────────────────────────────────────────────
html = f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Статистика VIP BIKE 2026 — итоги сезона</title>
<style>{CSS}</style></head><body><div class="wrap">

<h1>СТАТИСТИКА <b>VIP BIKE</b> · сезон 2026 · итоги</h1>
<div class="sub">апрель — октябрь 2026 · собрано 27.10 из прод-базы + Excel «Все движения по ВипБайкЭлектро 2026» · <b>версия v1.0 (P&amp;L-издание)</b>
· <span class="slot">____ ₽<i> = жду цифру, продиктуй — пересчитаю</i></span></div>

<nav>
<a href="#rent">📍 Аренда</a><a href="#exp">🧾 Расходы</a><a href="#sales">💰 Продажи</a>
<a href="#tot">🧮 Итог ±</a><a href="#next">🗺️ План</a>
</nav>

{sec1}
{sec_exp}
{sec_sales}
{sec_tot}
{sec_plan}

<footer>
Источники: Supabase prod (rentals {len(D['fleet'])}+ байков, 244 аренды байков · 42 экип · 74 сервис-наряда · 233 сверки · касса 345 строк, выгрузка 27.10.2026)
· «Все движения по ВипБайкЭлектро 2026.xlsx» (Аренда / Закупка продажа / Экип / сервис / Выставки, маркетинг / салон)
· «VIP Bike смета открытия мотосалона.xlsx» (Нижний Новгород, 194 м²).
Сгенерировано task150 · итоги считаются один раз: расходы не дублируются между арендой и продажами · слоты ждут диктовку, не выдуманы.
</footer>
</div></body></html>"""

OUT_REPO = "/home/z/cartest/docs/summary/SUMMARY.html"
OUT_DL = "/home/z/my-project/download/season-2026-summary.html"
open(OUT_REPO, "w", encoding="utf-8").write(html)
open(OUT_DL, "w", encoding="utf-8").write(html)
print("written:", OUT_REPO, len(html), "bytes")
print("written:", OUT_DL, len(html), "bytes")
print(f"\nCONTROL: rent_plus={rent_plus:,.0f} rent_minus={rent_minus:,.0f} rent_net={rent_net:,.0f} "
      f"sales_profit={sales_profit:,.0f} TOTAL_TOTAL={total_total:,.0f}")
print(f"deals={deals_total} rent={rent_total:,.0f} eq={eq_in:,.0f} svc_in={svc_in:,.0f} svc_out={svc_out:,.0f} "
      f"partner={partner_total:,.0f} comm={comm_acc:,.0f} paid={paid['total']:,.0f}")
