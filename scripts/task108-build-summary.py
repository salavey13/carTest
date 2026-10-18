#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate SUMMARY.html — Статистика VIP BIKE 2026 (v0.1, iteration 1).
Data: Supabase rentals snapshot + xlsx transcription. Self-contained inline SVG."""
import json
import os
from collections import defaultdict
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
rentals = json.load(open(f"{BASE}/rentals_snapshot.json"))
cars = json.load(open(f"{BASE}/cars_snapshot.json"))
xlsx = json.load(open(f"{BASE}/xlsx_data.json"))

CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"
car_by_id = {c["id"]: c for c in cars}
BIKE_TYPES = {"bike"}

def rub(x, sign=False):
    s = f"{x:,.0f}".replace(",", " ")
    return (f"+{s}" if sign and x > 0 else (f"−{abs(x):,.0f}".replace(",", " ") if sign and x < 0 else s)) + " ₽"

# ---------------- classify rentals (vip-bike crew only) ----------------
bike_r, equip_r, svc_r, other_r = [], [], [], []
for r in rentals:
    if r.get("crew_id") != CREW:
        continue
    src = (r.get("metadata") or {}).get("source")
    t = (car_by_id.get(r.get("vehicle_id")) or {}).get("type")
    if src == "service_work" or (r.get("vehicle_id") or "").startswith("vip-bike-svc"):
        svc_r.append(r)
    elif t in BIKE_TYPES:
        bike_r.append(r)
    elif t == "equipment":
        equip_r.append(r)
    else:
        other_r.append(r)

def month_key(r):
    return (r.get("agreed_start_date") or r.get("created_at") or "")[:7]

months = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
m_labels = {"2026-05": "май", "2026-06": "июнь", "2026-07": "июль", "2026-08": "август", "2026-09": "сентябрь", "2026-10": "октябрь*"}

m_cnt = defaultdict(int); m_sum = defaultdict(float); m_ekip = defaultdict(float)
for r in bike_r:
    m = month_key(r)
    m_cnt[m] += 1
    m_sum[m] += r.get("total_cost") or 0
    md = r.get("metadata") or {}
    if md.get("ekip_rub"):
        m_ekip[m] += md["ekip_rub"]

# per-bike revenue
bike_rev = defaultdict(lambda: [0.0, 0])
for r in bike_r:
    bike_rev[r["vehicle_id"]][0] += r.get("total_cost") or 0
    bike_rev[r["vehicle_id"]][1] += 1
bike_rows = sorted(bike_rev.items(), key=lambda kv: -kv[1][0])

total_bike_sum = sum(v[0] for v in bike_rev.values())
total_bike_cnt = sum(v[1] for v in bike_rev.values())
ekip_sum = sum(m_ekip.values())
equip_sum = sum(r.get("total_cost") or 0 for r in equip_r)
equip_cnt = len(equip_r)
svc_sum = sum(r.get("total_cost") or 0 for r in svc_r)
svc_cnt = len(svc_r)
deposit_sum = sum(r.get("deposit_amount") or 0 for r in bike_r)

# partner candidates (not in rental purchase list: Zero / Кава зелёная / Хорвин)
PARTNER_IDS = {"sequence-zero", "kawasaki-ex650k"}
partner_sum = sum(v[0] for k, v in bike_rev.items() if k in PARTNER_IDS)
partner_cnt = sum(v[1] for k, v in bike_rev.items() if k in PARTNER_IDS)

# ---------------- xlsx numbers ----------------
P = xlsx["prodazha"]
sales_profit = P["totals"]["profit_sum"]          # 3,995,460
sales_cost = P["totals"]["cost_sum"]              # 16,612,515
sales_price = P["totals"]["price_sum"]            # 17,793,800
inv_salon = P["inventory"]["salon_our_tech"]      # 3,125,900
inv_partner = P["inventory"]["partner_investors"] # 1,483,000
fleet_cost = xlsx["arenda"]["zakup_total"]        # 4,113,000
mkt = xlsx["marketing"]["total"]                  # 928,141
salon = xlsx["salon"]["total"]                    # 275,922
ekip_buy = xlsx["ekip"]["total"]                  # 393,160
svc_buy = xlsx["service_zakup"]["total"]          # 75,887
svc_rev = xlsx["service_pribyl"]["total"]         # 7,000

sold_rows = [r for r in P["rows"] if (r.get("status") or "").lower().startswith("прод")]
top_sales = sorted([r for r in P["rows"] if r.get("profit")], key=lambda r: -r["profit"])[:10]
mkt_groups = sorted(xlsx["marketing"]["groups"], key=lambda g: -g["sum"])

expenses_total = mkt + salon + ekip_buy + svc_buy

# ---------------- SVG helpers ----------------
def hbars(data, width=560, bar_h=22, gap=7, color="#2563eb", fmt=rub, maxval=None):
    mx = maxval or max((v for _, v, *_ in data), default=1) or 1
    lab_w = 190
    right_w = 150
    parts = []
    for i, item in enumerate(data):
        label, val = item[0], item[1]
        extra = item[2] if len(item) > 2 else ""
        w = max(2, (width - lab_w - right_w) * val / mx)
        y = i * (bar_h + gap)
        parts.append(
            f'<text x="{lab_w-8}" y="{y+bar_h*0.72}" text-anchor="end" class="cl">{label}</text>'
            f'<rect x="{lab_w}" y="{y}" width="{w:.1f}" height="{bar_h}" rx="4" fill="{color}"/>'
            f'<text x="{lab_w+w+6:.1f}" y="{y+bar_h*0.72}" class="cv">{fmt(val)}{" · "+extra if extra else ""}</text>'
        )
    H = len(data) * (bar_h + gap)
    return f'<svg viewBox="0 0 {width} {H}" class="chart">{"".join(parts)}</svg>'

def vbars(labels, values, color="#2563eb", width=560, height=190, fmt=lambda v: f"{v:,.0f}"):
    mx = max(values) or 1
    n = len(values)
    bw = min(64, (width - 20) / n * 0.62)
    step = (width - 20) / n
    parts = []
    for i, (lb, v) in enumerate(zip(labels, values)):
        h = max(2, (height - 56) * v / mx)
        x = 10 + i * step + (step - bw) / 2
        y = height - 34 - h
        parts.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bw:.1f}" height="{h:.1f}" rx="5" fill="{color}"/>')
        parts.append(f'<text x="{x+bw/2:.1f}" y="{y-6:.1f}" text-anchor="middle" class="cv">{fmt(v)}</text>')
        parts.append(f'<text x="{x+bw/2:.1f}" y="{height-16}" text-anchor="middle" class="cl">{lb}</text>')
    return f'<svg viewBox="0 0 {width} {height}" class="chart">{"".join(parts)}</svg>'

def donut(items, size=190, colors=["#2563eb","#059669","#d97706","#dc2626","#7c3aed","#0891b2"]):
    total = sum(v for _, v in items) or 1
    r, cx, cy, sw = size/2 - 14, size/2, size/2, 26
    C = 2 * 3.14159 * r
    off = 0; parts = []
    for i, (lb, v) in enumerate(items):
        frac = v / total
        dash = f'{frac*C:.1f} {C - frac*C:.1f}'
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{colors[i%len(colors)]}" '
                     f'stroke-width="{sw}" stroke-dasharray="{dash}" stroke-dashoffset="{-off*C:.1f}" '
                     f'transform="rotate(-90 {cx} {cy})"/>')
        off += frac
    parts.append(f'<text x="{cx}" y="{cy-4}" text-anchor="middle" class="cvbig">{rub(total) if total < 10000000 else f"{total/1e6:.1f} млн ₽"}</text>')
    parts.append(f'<text x="{cx}" y="{cy+14}" text-anchor="middle" class="cl">всего</text>')
    leg = "".join(f'<div class="lg"><span class="dot" style="background:{colors[i%len(colors)]}"></span>{lb} — <b>{rub(v)}</b></div>' for i, (lb, v) in enumerate(items))
    return f'<div class="donut-wrap"><svg viewBox="0 0 {size} {size}" class="donut">{"".join(parts)}</svg><div class="legend">{leg}</div></div>'

def kpi(label, value, sub="", cls=""):
    return f'<div class="kpi {cls}"><div class="kpi-l">{label}</div><div class="kpi-v">{value}</div><div class="kpi-s">{sub}</div></div>'

def ph(text="ждём цифры"):
    return f'<span class="ph">{text}</span>'

def month_row(m):
    return (f'<tr><td>{m_labels.get(m, m)}</td><td>{m_cnt.get(m,0)}</td>'
            f'<td>{rub(m_sum.get(m,0))}</td><td>{rub(m_ekip.get(m,0)) if m_ekip.get(m) else "—"}</td></tr>')

# sales table rows
sales_tr = "".join(
    f'<tr><td>{r["n"]}</td><td class="lt">{r["item"]}</td><td>{r.get("client") or "—"}</td>'
    f'<td>{rub(r["cost"]) if r.get("cost") else "—"}</td><td>{rub(r["price"]) if r.get("price") else "—"}</td>'
    f'<td class="{"pos" if (r.get("profit") or 0) >= 0 else "neg"}">{rub(r["profit"], sign=True) if r.get("profit") is not None else "—"}</td>'
    f'<td>{r.get("date") or "—"}</td><td>{r.get("status") or "—"}</td></tr>'
    for r in P["rows"] if r.get("item")
)

fleet_tr = "".join(f'<tr><td>{r["n"]}</td><td class="lt">{r["item"]}</td><td>{rub(r["cost"])}</td></tr>'
                   for r in xlsx["arenda"]["zakup_pod_arendu"])

mkt_tr = "".join(f'<tr><td class="lt">{g["event"]}</td><td>{g.get("date") or "—"}</td><td>{rub(g["sum"])}</td><td class="lt dim">{g["items"]}</td></tr>'
                 for g in xlsx["marketing"]["groups"])

# pending rows (skipped from backfill)
pending_tr = "".join(
    f'<tr><td class="lt">{m["moto"]}</td><td>{m.get("client") or "—"}</td><td>{m.get("duration") or "—"}</td>'
    f'<td>{rub(m["profit"]) if m.get("profit") else "—"}</td><td class="dim">{m.get("note") or "нет даты"}</td></tr>'
    for m in xlsx["arenda"]["rentals_manual"] if not m.get("date")
)

bk_rows = sorted(((k, v[0], v[1]) for k, v in bike_rev.items()), key=lambda x: -x[1])
bike_chart = hbars([(f"{(car_by_id.get(k) or {}).get('make','')} {(car_by_id.get(k) or {}).get('model','')}".strip()[:26], v, f"{c} шт") for k, v, c in bk_rows[:14]])
top_sales_chart = hbars([(r["item"][:30], r["profit"]) for r in top_sales], color="#059669")
mkt_chart = hbars([(g["event"][:26], g["sum"]) for g in mkt_groups[:8]], color="#d97706")
month_cnt_chart = vbars([m_labels[m] for m in months], [m_cnt.get(m, 0) for m in months], fmt=lambda v: str(int(v)))
month_sum_chart = vbars([m_labels[m] for m in months], [m_sum.get(m, 0)/1000 for m in months], color="#059669", fmt=lambda v: f"{v:,.0f}k")

TOTAL_SEASON = total_bike_sum + ekip_sum

html = f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Статистика VIP BIKE 2026 — SUMMARY</title>
<style>
:root{{--bg:#0b1220;--card:#111a2e;--card2:#0e1626;--ink:#e6ecf7;--dim:#8fa0bd;--line:#1f2b45;
--blue:#3b82f6;--green:#10b981;--amber:#f59e0b;--red:#ef4444;--violet:#8b5cf6}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:var(--bg);color:var(--ink);font:15px/1.5 'Segoe UI',system-ui,Arial,sans-serif;padding:26px 18px 60px}}
.wrap{{max-width:1180px;margin:0 auto}}
h1{{font-size:26px;letter-spacing:.3px}} h1 b{{color:var(--amber)}}
.sub{{color:var(--dim);margin:6px 0 20px;font-size:13.5px}}
nav{{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 26px}}
nav a{{color:var(--ink);text-decoration:none;background:var(--card);border:1px solid var(--line);padding:7px 14px;border-radius:20px;font-size:13.5px}}
nav a:hover{{border-color:var(--blue)}}
section{{margin:0 0 34px}}
h2{{font-size:19px;margin:0 0 14px;padding-left:11px;border-left:4px solid var(--blue)}}
h2.sales{{border-color:var(--green)}} h2.exp{{border-color:var(--amber)}} h2.tot{{border-color:var(--violet)}}
.grid{{display:grid;gap:12px}}
.g5{{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}}
.g2{{grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}}
.kpi{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}}
.kpi-l{{color:var(--dim);font-size:12.5px;text-transform:uppercase;letter-spacing:.6px}}
.kpi-v{{font-size:23px;font-weight:700;margin-top:3px}} .kpi-s{{color:var(--dim);font-size:12px;margin-top:2px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}}
.card h3{{font-size:14.5px;color:var(--dim);font-weight:600;margin-bottom:10px}}
.chart{{width:100%;height:auto}} .cl{{fill:var(--dim);font-size:11.5px}} .cv{{fill:var(--ink);font-size:11.5px;font-weight:600}}
.cvbig{{fill:var(--ink);font-size:15px;font-weight:700}}
.donut-wrap{{display:flex;gap:16px;align-items:center;flex-wrap:wrap}}
.donut{{width:180px;height:180px;flex:none}} .legend .lg{{font-size:13px;margin:3px 0}}
.dot{{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:7px}}
table{{width:100%;border-collapse:collapse;font-size:13px}}
th{{color:var(--dim);text-align:left;font-weight:600;padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap}}
td{{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}}
tr:hover td{{background:#16203a}} .lt{{max-width:320px}} .dim{{color:var(--dim);font-size:12px}}
.pos{{color:var(--green);font-weight:600}} .neg{{color:var(--red);font-weight:600}}
.ph{{background:#3a2c07;color:var(--amber);border:1px dashed var(--amber);padding:1px 8px;border-radius:10px;font-size:12px;white-space:nowrap}}
.note{{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--dim);font-size:13px;margin-top:12px}}
.note b{{color:var(--ink)}}
.flag{{display:inline-block;background:#1e2a4a;color:#93c5fd;border-radius:8px;padding:1px 8px;font-size:11.5px;margin-left:6px}}
.ledger td:first-child{{color:var(--dim)}}
.ledger .sum td{{font-weight:700;border-top:2px solid var(--line);font-size:14px}}
.big-total{{background:linear-gradient(135deg,#1a2440,#101a30);border:1px solid #2a3a63;border-radius:16px;padding:18px;text-align:center}}
.big-total .v{{font-size:30px;font-weight:800;color:var(--amber)}}
footer{{color:var(--dim);font-size:12px;margin-top:40px;border-top:1px solid var(--line);padding-top:14px}}
.steps{{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}}
.step{{background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:12.5px;color:var(--dim)}}
.step b{{color:var(--ink)}}
@media print {{body{{background:#fff;color:#000}} .card,.kpi{{border-color:#ccc;background:#fff}} }}
</style></head><body><div class="wrap">

<h1>СТАТИСТИКА <b>VIP BIKE</b> · сезон 2026</h1>
<div class="sub">май — октябрь 2026 · собрано 18.10.2026 · до дедлайна 25.10.2026 · <b>версия v0.1 (итерация 1)</b>
· <span class="flag">амбер-плашки = ждём данные</span></div>

<nav>
<a href="#rent">📍 Аренда</a><a href="#sales">💰 Продажи</a><a href="#exp">🧾 Расходы</a>
<a href="#tot">🧮 Итог ±</a><a href="#next">🗺️ Дальше</a>
</nav>

<section id="rent">
<h2>1 · АРЕНДА — все аренды через бота, май → октябрь</h2>
<div class="grid g5">
{kpi('Аренд байков', f'{total_bike_cnt}', f'на {rub(total_bike_sum)}')}
{kpi('Средний чек', rub(total_bike_sum / max(total_bike_cnt,1)), 'за аренду байка')}
{kpi('Экипировка', f'{equip_cnt} аренд', f'на {rub(equip_sum)} + {rub(ekip_sum)} вручную')}
{kpi('Залоги собрано', rub(deposit_sum), 'по строкам с залогом')}
{kpi('Сервис/работы', f'{svc_cnt} нарядов', f'на {rub(svc_sum)} (вкл. manual 7 000)')}
</div>

<div class="grid g2" style="margin-top:12px">
<div class="card"><h3>Аренды по месяцам (шт)</h3>{month_cnt_chart}</div>
<div class="card"><h3>Выручка по месяцам, тыс ₽</h3>{month_sum_chart}</div>
</div>

<div class="card" style="margin-top:12px"><h3>Сколько заработал каждый байк</h3>{bike_chart}</div>

<table style="margin-top:12px">
<tr><th>Месяц</th><th>Аренд байков</th><th>Выручка</th><th>Экип (вручную)</th></tr>
{''.join(month_row(m) for m in months)}
<tr><th>Итого</th><th>{total_bike_cnt}</th><th>{rub(total_bike_sum)}</th><th>{rub(ekip_sum)}</th></tr>
</table>

<div class="grid g2" style="margin-top:12px">
<div class="card"><h3>Партнёрские байки 50/50 <span class="flag">требует подтверждения</span></h3>
  <p style="font-size:13.5px">В закупе под аренду (4,113,000 ₽) нет «Zero», «Кава зелёная» и «Хорвин» — похоже, это партнёрские байки.
  Если так, их выручка делится 50/50:</p>
  <div class="big-total" style="margin-top:10px"><div class="v">{rub(partner_sum)}</div>
  <div class="sub">Zero + Кава зелёная · {partner_cnt} аренд → компании ~{rub(partner_sum/2)}</div></div>
  <p class="dim" style="font-size:12px;margin-top:8px">Подтвердите список партнёрских байков — пересчитаю.</p></div>
<div class="card"><h3>Расходы по аренде</h3>
  <table><tr><th>Статья</th><th>Сумма</th></tr>
  <tr><td>Бензин</td><td>{ph('примерно?')}</td></tr>
  <tr><td>Масла / расходники</td><td>{ph('примерно?')}</td></tr>
  <tr><td>Мойка / мелкий ремонт в сезон</td><td>{ph('?')}</td></tr>
  <tr><td>Ремонт после «падальщиков»</td><td>{ph('?')}</td></tr></table>
  <p class="dim" style="font-size:12px;margin-top:8px">В боте расходы не фиксируются (только одометры). Назовите прикидку — внесу.</p></div>
</div>

<div class="card" style="margin-top:12px"><h3>Майский ручной период — статус загрузки</h3>
<p style="font-size:13.5px;margin-bottom:8px">✅ В базу добавлены 5 аренд мая—начала июня (46 000 ₽ + 4 000 ₽ экип): Коняхин (Ducati, 04.05), Zero (04.05, без ФИО), Ульви Мамед (Zero, 06.05), Забалдин (Кава, 30.05, залог 20 000), Шаронов (Кава, 05.06 + экип 4 000).</p>
<p style="font-size:13.5px;margin-bottom:4px">⏳ Ожидают даты из архива договоров (.zip не загрузился — пришлите ещё раз):</p>
<table><tr><th>Байк</th><th>Клиент</th><th>Срок</th><th>Сумма</th><th>Почему ждём</th></tr>{pending_tr}</table></div>
</section>

<section id="sales">
<h2 class="sales">2 · ПРОДАЖИ — закуп → реализация → прибыль</h2>
<div class="grid g5">
{kpi('Закуп под продажу', rub(sales_cost), f"{sum(r.get('qty') or 1 for r in P['rows']):.0f} мото в учёте")}
{kpi('Выручка (реализация)', rub(sales_price), 'сумма продаж')}
{kpi('Прибыль с продаж', rub(sales_profit), 'по столбцу «Прибыль»', 'kpi-win')}
{kpi('Остаток: салон/склад', rub(inv_salon), 'наша техника, на 29.09')}
{kpi('Остаток: партнёрская', rub(inv_partner), 'инвесторы, на 29.09')}
</div>

<div class="grid g2" style="margin-top:12px">
<div class="card"><h3>Структура остатков техники</h3>{donut([('Салон/склад (наша)', inv_salon), ('Партнёрская (инвесторы)', inv_partner)])}</div>
<div class="card"><h3>Топ-10 прибыльных продаж</h3>{top_sales_chart}</div>
</div>

<div class="card" style="margin-top:12px"><h3>Ведомость продаж (лист «Закупка продажа»)</h3>
<div style="max-height:420px;overflow:auto"><table>
<tr><th>№</th><th>Товар</th><th>Клиент</th><th>Закуп</th><th>Продажа</th><th>Прибыль</th><th>Дата</th><th>Статус</th></tr>
{sales_tr}
</table></div>
<p class="dim" style="font-size:12px;margin-top:8px">⚠ Сверка: 17 793 800 − 16 612 515 = 1 181 285 ₽ ≠ 3 995 460 ₽ (прибыль по строкам).
Расхождение объяснимо (в закуп-сумму входит нераспроданный склад) — проверим построчно на следующей итерации по оригиналу xlsx.</p></div>

<div class="card" style="margin-top:12px"><h3>Закуп мото под аренду — 4 113 000 ₽ (11 мото)</h3>
<table><tr><th>№</th><th>Мотоцикл</th><th>Закуп</th></tr>{fleet_tr}</table>
<p class="dim" style="font-size:12px;margin-top:8px">Плюс техники вне списка в аренде: «Zero», «Кава зелёная», «Хорвин» — вероятно партнёрские (см. блок 50/50).</p></div>

<div class="card" style="margin-top:12px"><h3>Доход от повреждений («падальщики»)</h3>{ph('сумма?')} <span class="dim">— по записям о повреждениях (Вайвольт и др.) — нужна цифра.</span></div>
</section>

<section id="exp">
<h2 class="exp">3 · РАСХОДЫ VipBike</h2>
<div class="grid g2">
<div class="card"><h3>Структура учтённых расходов</h3>{donut([('Выставки и маркетинг', mkt), ('Экипировка (закуп)', ekip_buy), ('Салон (аренда+обустройство)', salon), ('Сервис (закуп з/ч)', svc_buy)])}</div>
<div class="card"><h3>Затраты по статьям</h3>
<table><tr><th>Статья</th><th>Сумма</th></tr>
<tr><td>Выставки, мероприятия, маркетинг</td><td><b>{rub(mkt)}</b></td></tr>
<tr><td>Экипировка и комплектующие (закуп)</td><td><b>{rub(ekip_buy)}</b></td></tr>
<tr><td>Салон: аренда + обустройство</td><td><b>{rub(salon)}</b></td></tr>
<tr><td>Сервис: запчасти и оснащение</td><td><b>{rub(svc_buy)}</b></td></tr>
<tr><td>З/П сотрудников (Рустам, Коля, Паша, Лёха, Lama…)</td><td>{ph('?')}</td></tr>
<tr><td>Поездки (МСК ×3 учтены в маркетинге: 151 794)</td><td class="dim">в маркетинге</td></tr>
<tr><td>Электричество / текущие</td><td>{ph('?')}</td></tr>
<tr class="sum"><td>Учтено сейчас</td><td><b>{rub(expenses_total)}</b></td></tr></table></div>
</div>
<div class="card" style="margin-top:12px"><h3>Мероприятия и маркетинг — детализация</h3>{mkt_chart}
<table style="margin-top:10px"><tr><th>Мероприятие</th><th>Дата</th><th>Сумма</th><th>Состав</th></tr>{mkt_tr}</table>
<p class="dim" style="font-size:12px;margin-top:8px">«Поездка МСК 2» = 30 000 (в таблице помечено «посчитать»); сайт Олега 93 000 — бартер за КУГУ.</p></div>
<div class="card" style="margin-top:12px"><h3>Сервис (ремонтные работы, май—июнь)</h3>
<table><tr><th>Работа</th><th>Дата</th><th>Мастер</th><th>Сумма</th><th>Заметка</th></tr>
{''.join(f'<tr><td class="lt">{r["item"]}</td><td>{r["date"]}</td><td>{r["master"]}</td><td>{rub(r["sum"])}</td><td class="dim">{r.get("note") or ""}</td></tr>' for r in xlsx['service_pribyl']['rows'])}
<tr class="sum"><td colspan="3">Итого сервис-выручка</td><td>{rub(svc_rev)}</td></tr></table></div>
</section>

<section id="tot">
<h2 class="tot">4 · ИТОГ — свести все суммы ±</h2>
<div class="grid g2">
<div class="card"><h3>Сводный баланс сезона (что известно)</h3>
<table class="ledger">
<tr><th>Строка</th><th>Сумма</th></tr>
<tr><td>+ Прибыль с продаж</td><td class="pos">{rub(sales_profit, True)}</td></tr>
<tr><td>+ Выручка аренды (бот, байки)</td><td class="pos">{rub(total_bike_sum, True)}</td></tr>
<tr><td>+ Аренда экипировки + экип вручную</td><td class="pos">{rub(equip_sum + ekip_sum, True)}</td></tr>
<tr><td>+ Сервис/работы</td><td class="pos">{rub(svc_sum + svc_rev, True)}</td></tr>
<tr><td>+ Доход от повреждений</td><td>{ph('вопрос')}</td></tr>
<tr><td>− Маркетинг и мероприятия</td><td class="neg">{rub(-mkt, True)}</td></tr>
<tr><td>− Экипировка (закуп)</td><td class="neg">{rub(-ekip_buy, True)}</td></tr>
<tr><td>− Салон</td><td class="neg">{rub(-salon, True)}</td></tr>
<tr><td>− Сервис (закуп з/ч)</td><td class="neg">{rub(-svc_buy, True)}</td></tr>
<tr><td>− З/П сотрудников</td><td>{ph('вопрос')}</td></tr>
<tr><td>− Кредит (расход/остаток)</td><td>{ph('вопрос')}</td></tr>
<tr><td>− Прочие расходы</td><td>{ph('вопрос')}</td></tr>
<tr class="sum"><td>ИТОГ (без «вопросов»)</td><td>{rub(sales_profit + total_bike_sum + equip_sum + ekip_sum + svc_sum + svc_rev - expenses_total, True)}</td></tr>
</table>
<p class="dim" style="font-size:12px;margin-top:8px">Не входит в арендную выручку: депозитные обороты (залоги возвращаемы), нереализованный склад техники (4 608 900 ₽), закуп парка под аренду 4 113 000 ₽ (это актив, не расход сезона).</p></div>

<div class="card"><h3>Итог по владельцам (50/50)</h3>
<div class="big-total"><div class="v">{rub((sales_profit + total_bike_sum + equip_sum + ekip_sum + svc_sum + svc_rev - expenses_total) / 2)}</div>
<div class="sub">Илье / Роману — по половине (без учёта «вопросов»)</div></div>
<table style="margin-top:12px">
<tr><th></th><th>Илья</th><th>Роман</th></tr>
<tr><td>Сколько вышло денег (вложено/получено)</td><td>{ph('вопрос')}</td><td>{ph('вопрос')}</td></tr>
<tr><td>Доля сезона 50/50 (предварительно)</td><td>{rub((sales_profit + total_bike_sum + equip_sum + ekip_sum + svc_sum + svc_rev - expenses_total) / 2)}</td><td>{rub((sales_profit + total_bike_sum + equip_sum + ekip_sum + svc_sum + svc_rev - expenses_total) / 2)}</td></tr>
</table>
<div class="note"><b>Как в рукописной памятке:</b> итог сводится по трём колонкам — деньги / продажи / аренда (+ техника).
Когда закроем «вопросы» (кредит, з/п, полученные Илья/Роман, падальщики, бензин), разложу итог по этим колонкам.</div></div>
</div>
</section>

<section id="next">
<h2>5 · Дальнейшие шаги (план из памятки)</h2>
<div class="steps">
<div class="step"><b>1.</b> Ремонт + открытие шоурума + сервис</div>
<div class="step"><b>2.</b> Закуп на зиму</div>
<div class="step"><b>3.</b> Закуп на сезон + оптимизация работы</div>
</div>
<div class="note" style="margin-top:14px">
<b>Что нужно для v1.0 (собрать всё точно):</b>
1) <b>.zip с договорами не загрузился</b> — пришлите повторно: докуплю оставшиеся майские аренды (Zero/Платонов 30 000, Борский 19 000, Хорвин 2 000, слава 4 000, 1.5 дня) и сверю по документам;
2) оригинал <b>xlsx</b> (в чат пришла выжимка — свержу построчно);
3) цифры-«вопросы»: кредит, з/П, полученные Илья/Роман, бензин/масла, повреждения;
4) подтвердите список <b>партнёрских байков 50/50</b>.
</div>
</section>

<footer>
Источники: Supabase public.rentals ({len(rentals)} строк, выгрузка 18.10.2026) · «Все движения по ВипБайкЭлектро 2026.xlsx» (листы Аренда / Закупка продажа / Экип / сервис / Выставки,маркетинг / салон) · рукописные памятки-спецификации от 18.10.2026.
Сгенерировано task108 · SUMMARY.html v0.1 · метки <span class="ph">вопрос</span> — данные pending, не выдуманы.
</footer>
</div></body></html>
"""

out = "docs/summary/SUMMARY.html (repo copy)"
with open(out, "w") as f:
    f.write(html)
print("written", out, len(html), "bytes")
print("check:", total_bike_cnt, "bike rentals,", rub(total_bike_sum), "| partner", rub(partner_sum), "| season total", rub(TOTAL_SEASON))
