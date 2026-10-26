#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""task144b: patch season-2026-report.html with fresh stats (June finish: prices deduced,
7 held rows inserted, 8 leads, verifications 230/pool 239600, exact funnel counts)."""
import json, re, os

HTML = "/home/z/my-project/download/season-2026-report.html"
DATA = json.load(open("/home/z/my-project/scripts/task144-report-data.json"))

fleet_lines = "  fleet: [\n" + ",\n".join(
    f'    {{ name: {json.dumps(f["name"], ensure_ascii=False)}, revenue: {f["revenue"]}, deals: {f["deals"]}, days: {f["days"]} }}'
    for f in DATA["fleet"]) + "\n  ],"

# exact funnel counts (count=exact API, 26.10 evening)
FUN = {"intents": 901, "viewed": 411, "dismissed": 39, "configured": 98,
       "contacted": 52, "checkout": 152, "contracts": 149, "testdrives": 75, "sale": 37}

s = open(HTML, encoding="utf-8").read()
orig = s

def sub1(old, new):
    global s
    assert s.count(old) == 1, f"anchor not unique/found: {old[:80]!r} (count={s.count(old)})"
    s = s.replace(old, new)

# 1) meta line
sub1("источники: rentals (293 строки), service-работы (74), rental_verifications (223), franchize_intents (723 rent-сигнала)",
     "источники: rentals (374 строки), service-работы (74), rental_verifications (230), franchize_intents (901 rent-сигнала)")

# 2) DATA comment + generatedAt
sub1("/* ═══════════ DATA SNAPSHOT (prod DB 2026-10-26, после бэкфилла июня task144) ═══════════ */",
     "/* ═══ DATA SNAPSHOT (prod DB 2026-10-26 веч., доводка июня task144b: цены deduce по решению босса, 7 отложенных строк, 8 лидов) ═══ */")
sub1('generatedAt: "2026-10-26T18:30:00Z"', 'generatedAt: "2026-10-26T20:50:00Z"')

# 3) months june
sub1('{ key: "Июнь", revenue: 208000, deals: 37 }', '{ key: "Июнь", revenue: 350000, deals: 44 }')

# 4) statusMix
sub1("statusMix: { completed: 348, active: 0, cancelled: 14, pending: 5 }",
     "statusMix: { completed: 355, active: 0, cancelled: 14, pending: 5 }")

# 5) fleet array (28 bikes now, Y-VOLT Surge V joins)
s = re.sub(r"  fleet: \[.*?\n  \],", fleet_lines.replace("\\", "\\\\"), s, count=1, flags=re.S)

# 6) scalars
sub1("bikesTouched: 27,", "bikesTouched: 28,")
sub1("rentDays: 159.3,", "rentDays: 165.2,")
sub1("deals: 274,", "deals: 281,")
sub1("revenueTotal: 2187932,", "revenueTotal: 2329932,")
sub1("renters: { total: 157, repeat: 11 },", "renters: { total: 165, repeat: 11 },")

# 7) operator + verifications
sub1("operatorDeals: { count: 173, revenue: 1680991 },", "operatorDeals: { count: 180, revenue: 1792991 },")
sub1("verifications: { total: 223, verified: 95, commissionPool: 232754, retroPool: 71324 },",
     "verifications: { total: 230, verified: 102, commissionPool: 239600, retroPool: 78170 },")

# 8) funnel (exact counts)
sub1('{ name: "Сигналы «аренда» (intents)", value: 723, color: "#38bdf8" }',
     '{ name: "Сигналы «аренда» (intents)", value: 901, color: "#38bdf8" }')
sub1('{ name: "Настраивали заказ (configured)", value: 88, color: "#38bdf8" }',
     '{ name: "Настраивали заказ (configured)", value: 98, color: "#38bdf8" }')
sub1('{ name: "Старты чекаута", value: 122, color: "#a78bfa" }',
     '{ name: "Старты чекаута", value: 152, color: "#a78bfa" }')
sub1('{ name: "Сгенерированные договоры", value: 83, color: "#f5a524" }',
     '{ name: "Сгенерированные договоры", value: 149, color: "#f5a524" }')
sub1('{ name: "Тест-драйвы", value: 73, color: "#a78bfa" }',
     '{ name: "Тест-драйвы", value: 75, color: "#a78bfa" }')

# 9) expenses salary line
sub1('hint: "канон из rental_verifications — 232 754 ₽ пула; выплачено — проставь", value: 232754, computed: true',
     'hint: "канон из rental_verifications — 239 600 ₽ пула (ретро 78 170); выплачено — проставь", value: 239600, computed: true')

# 10) funnel note hardcoded pct
sub1("Конверсия «сигнал → договор»: <b>${pct(83, 723)}%</b>",
     "Конверсия «сигнал → договор»: <b>${pct(149, 901)}%</b>")

# 11) June achievement card
sub1('{ ico: "🧾", t: "Июнь закрыт из тетради", p: `9 строк → 37 сделок на ${fmt(208000)} ₽: вся диктовка 26.10 разобрана ASR\'ом, декодирована по парку и внесена с проверкой на дубли.` },',
     '{ ico: "🧾", t: "Июнь закрыт из тетради — целиком", p: `44 сделки на ${fmt(350000)} ₽: диктовка 26.10 разобрана ASR\'ом и сверенна с базой; вечером 26.10 босс сказал «deduce prices yourself» — 8 цен выведены по примерам, 7 отложенных строк вставлены, каждый клиент — лид за djorudjov.` },')

open(HTML, "w", encoding="utf-8").write(s)

# report
import subprocess
diff_n = sum(1 for a, b in zip(orig.splitlines(), s.splitlines()) if a != b)
print(f"patched lines: {diff_n}; html size {len(orig)} -> {len(s)}")
for pat in ["350000", "2329932", "239600", "78170", "Y-VOLT", "pct(149, 901)", "44 сделки"]:
    print(f"  contains {pat!r}:", pat in s)
