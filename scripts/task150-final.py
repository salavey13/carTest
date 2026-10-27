#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""task150: FINAL season P&L numbers → task150-final.json (single source for the report)."""
import json
from collections import defaultdict

raw = json.load(open("/home/z/my-project/scripts/task150-raw.json"))
rentals, cars, vers, cash, users = raw["rentals"], raw["cars"], raw["verifications"], raw["cash"], raw["users"]
carmap = {c["id"]: c for c in cars}
IN = lambda m: "2026-04" <= m <= "2026-10"
def month_of(r):
    return str(r.get("agreed_start_date") or r.get("requested_start_date") or r.get("created_at") or "")[:7]
def is_svc(r):
    c = carmap.get(r["vehicle_id"]) or {}
    return c.get("type") == "service" or c.get("make") == "VIP_BIKE"

M = ["2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10"]

# ── money by month ────────────────────────────────────────────────────────
mm = {m: {"rent": 0.0, "deals": 0, "svc_in": 0.0, "svc_out": 0.0, "svc_in_n": 0, "svc_out_n": 0} for m in M}
for r in rentals:
    m = month_of(r)
    if not IN(m) or r["status"] == "cancelled" or not is_svc(r) and False: pass
    if not IN(m) or r["status"] == "cancelled": continue
    if is_svc(r):
        name = (carmap.get(r["vehicle_id"]) or {}).get("model") or ""
        meta = r.get("metadata") or {}
        label = str(meta.get("bike") or name or "")
        client = ("клиентск" in label.lower()) or ("не из арендного" in label) or ("клиент" in str(meta.get("service_name") or "").lower())
        if client: mm[m]["svc_in"] += r.get("total_cost") or 0; mm[m]["svc_in_n"] += 1
        else: mm[m]["svc_out"] += r.get("total_cost") or 0; mm[m]["svc_out_n"] += 1
    else:
        c = carmap.get(r["vehicle_id"]) or {}
        if c.get("type") == "equipment":
            mm[m]["rent"] += 0  # equipment tracked separately
        else:
            mm[m]["rent"] += r.get("total_cost") or 0; mm[m]["deals"] += 1

# equipment income
eq_in = 0.0; eq_n = 0
for r in rentals:
    c = carmap.get(r["vehicle_id"]) or {}
    if c.get("type") == "equipment" and r["status"] != "cancelled" and IN(month_of(r)):
        eq_in += r.get("total_cost") or 0; eq_n += 1

# ── fleet full list ───────────────────────────────────────────────────────
bikes = defaultdict(lambda: {"name":"","rev":0.0,"deals":0,"sub":False})
sub_rev = defaultdict(float); sub_partner = defaultdict(float)
for r in rentals:
    if r["status"]=="cancelled" or is_svc(r) or not IN(month_of(r)): continue
    c = carmap.get(r["vehicle_id"]) or {}
    if c.get("type") not in ("bike", None): continue
    b = bikes[r["vehicle_id"]]
    b["name"] = ((c.get("make") or "")+" "+(c.get("model") or "")).strip()
    b["rev"] += r.get("total_cost") or 0; b["deals"] += 1
    sp = c.get("specs") or {}
    if sp.get("subrenter_chat_id"):
        b["sub"] = True
        meta = r.get("metadata") or {}
        eq = meta.get("equipment_price") or 0
        part = max(0.0,(r.get("total_cost") or 0) - (eq if isinstance(eq,(int,float)) else 0))
        sub_partner[r["vehicle_id"]] += part*0.5
        sub_rev[r["vehicle_id"]] += r.get("total_cost") or 0
fleet = [{"name":b["name"],"rev":round(b["rev"]),"deals":b["deals"],"sub":b["sub"],
          "partner":round(sub_partner.get(k,0)) if b["sub"] else None} for k,b in bikes.items()]
fleet.sort(key=lambda x:-x["rev"])

# ── operators accrual (snapshots) ────────────────────────────────────────
op_acc = defaultdict(lambda: defaultdict(float)); op_n = defaultdict(lambda: defaultdict(int))
for v in vers:
    s=v.get("snapshot") or {}
    t=s.get("total")
    if t is None: continue
    m=str(v.get("requested_at") or "")[:7]
    if not IN(m): continue
    k=str(v.get("operator_chat_id") or "?")
    op_acc[k][m]+=t; op_n[k][m]+=1
operators={
 "djorudjov":{"label":"djorudjov (Джоруджов)","chat":"7813830016",
   "months":{m:round(op_acc["7813830016"].get(m,0)) for m in M},"total":round(sum(op_acc["7813830016"].values())),
   "n":sum(op_n["7813830016"].values())},
 "salavey13":{"label":"salavey13 (Paul)","chat":"413553377",
   "months":{m:round(op_acc["413553377"].get(m,0)) for m in M},"total":round(sum(op_acc["413553377"].values())),
   "n":sum(op_n["413553377"].values())},
 "unattributed":{"label":"без атрибуции (входящие/босс)","chat":"?",
   "months":{m:round(op_acc["?"].get(m,0)) for m in M},"total":round(sum(op_acc["?"].values())),
   "n":sum(op_n["?"].values())},
}
# cash payouts by month (actual money out)
cash_pay = defaultdict(float)
for c in cash:
    if c.get("transaction_type")=="expense_commission":
        cash_pay[str(c.get("transaction_date"))[:7]] += c.get("amount") or 0
paid_total = sum(cash_pay.values())

# ── xlsx constants (boss's ledger) ───────────────────────────────────────
xlsx = {
 "rent_fleet_buy": 4_113_000, "rent_fleet_n": 11,
 "gear_buy": 393_160, "svc_parts": 75_887, "salon": 275_922, "events_marketing": 928_141,
 "sale_buy": 16_612_515, "sale_revenue": 17_793_800, "sale_profit": 3_995_460,
 "stock_ours": 3_125_900, "stock_partner": 1_483_000, "stock_date": "29.09.2026",
 "events_detail": [
   ["МОТО ВЕСНА 2026","01.04",255056,"проживание 63 989 · питание 17 725 · газель/бензин/штрафы 62 193 · Илье на карту 15 000 · детейлинг 28 120 · печать 4 080 · Артём (полиграфия) 45 100 · футболки 6 344 · % за снятие/оплату 12 505"],
   ["Форум А","23.04",20000,"участие"],
   ["Океанис","май",179406,"аренда+презентация 106 140 · диджей+такси 9 650 · ТВ+стойка 36 094 · мебель 6 954 · прочее 20 598"],
   ["Велобор","16.05",20100,"участие 15 000 · доставака 3 900 · питание 1 200"],
   ["Молодые предприниматели","25.05",10000,"доставака+питание"],
   ["Беги герой","30.05",9000,"возврат мото + питание"],
   ["АвтоФест","20.06",25600,"доставка мото 11 000 · питание 3 800 · печать в Байкленд 10 800"],
   ["Яндекс Карты 3 мес","—",52000,"реклама"],
   ["Сайт Олегу (КУГА)","—",93000,"БАРТЕР — без денег"],
   ["Поездка МСК 1","—",46800,"23 400 Георгий вернул"],
   ["Поездка МСК 2","21.07",30000,"поездка, уточнить"],
   ["Поездка МСК 3","10.08",74994,"Я, Илья и Георгий"],
   ["Парк победы","05.09",112185,"доставка 5 885 · медали 33 600 · флаги/листовки 72 700"],
 ],
 "rent_fleet_rows": [
   ["Falcon GT чёрный","321 000"],["Ducati «зубик» (Black Z)","350 000"],["Motoland Breakout 300","222 000"],
   ["Regulmoto Nibbler 300","222 000"],["BMW F800R","423 000"],["Ducati чёрн/золотая 130А","404 000"],
   ["Harley Davidson","1 200 000"],["Jilang Max PRO","100 000"],["Honda CBR600RR","421 000"],
   ["Малыш/пиздюк","45 000"],["Ducati чёрн/золотая","405 000"]],
 "stock_ours_rows": [
   ["Falcon GT белый ×2","612 000"],["Sequence Zero ×2","1 223 000"],["Falcon Linx фиолет ×2","526 600"],
   ["Falcon Lite","228 300"],["Falcon Pro серб/фиолет","256 000"],["R1+ зелёный (тест)","280 000"],["Малыш","45 000"]],
 "website_since_june": 20000,  # 4 000 × июнь–октябрь
}
# smeta (showroom expansion)
smeta = {
 "place":"Нижний Новгород · 194 м² · октябрь 2026",
 "client_budget": 1_993_000, "recommended": 3_160_300,
 "outdoor": 628_000, "indoor": 1_365_000, "extra": 880_000, "reserve": 287_300,
 "outdoor_rows":[["Входная группа (изготовление+монтаж)","350 000"],["Монолитная плита у входа","30 000"],
   ["Перенос пожарной лестницы под 90°","20 000"],["Демонтаж кондиционеров/коробов","8 000"],
   ["Покраска лестницы и навеса","20 000"],["Покраска профнастила фасада","60 000"],
   ["Рекламные конструкции","100 000"],["Освещение фасада","40 000"]],
 "indoor_rows":[["Конструкция второго уровня","140 000"],["Перенос коммуникаций","100 000"],
   ["Санузел, перегородка, отопление, вентиляция","120 000"],["Кухня под ключ","120 000"],
   ["Шумоизоляция труб","35 000"],["Покраска стен и потолка","350 000"],["Мебель: столы, полки, стеллажи","100 000"],
   ["Электромонтаж и освещение","200 000"],["Зарядки для электромото","100 000"],["Лаунж-зона","100 000"]],
 "extra_rows":[["Мотосервис-зона (верстаки, инструмент)","150 000"],["Пожарная сигнализация","120 000"],
   ["Подготовка/ремонт пола","120 000"],["Художественная роспись","80 000"],["Видеонаблюдение и охрана","80 000"],
   ["Проектирование и согласования","80 000"],["Доп. вентиляция и климат","100 000"],
   ["Касса, терминал, рабочее место","35 000"],["Декоративные деревья и озеленение","40 000"],
   ["Навигация и указатели","25 000"],["Интернет, Wi-Fi, локальная сеть","25 000"],["Уборка и вывоз отходов","25 000"]],
}

out = {
 "generatedAt":"2026-10-27",
 "months": mm,
 "equipmentIncome": {"total": round(eq_in), "n": eq_n, "manual": 4000},
 "fleet": fleet,
 "fleetTotal": round(sum(f["rev"] for f in fleet)),
 "partnerTotal": round(sum(f["partner"] or 0 for f in fleet)),
 "operators": operators,
 "commissionPaid": {"total": round(paid_total), "months": {m: round(cash_pay.get(m,0)) for m in sorted(cash_pay)}},
 "xlsx": xlsx, "smeta": smeta,
}
json.dump(out, open("/home/z/my-project/scripts/task150-final.json","w"), ensure_ascii=False, indent=1)

print("RENT by month:", {m:(round(mm[m]["rent"]),mm[m]["deals"]) for m in M})
print("svc income:", round(sum(mm[m]["svc_in"] for m in M)), "n=",sum(mm[m]["svc_in_n"] for m in M),
      "| svc internal(cost):", round(sum(mm[m]["svc_out"] for m in M)), "n=",sum(mm[m]["svc_out_n"] for m in M))
print("equipment:", round(eq_in), eq_n)
print("fleet:", len(fleet), "bikes, total", out["fleetTotal"])
print("partner 50/50 total:", out["partnerTotal"])
for f in fleet:
    if f["sub"]: print("  SUB", f["name"], f["rev"], "→ partner", f["partner"])
print("operators:", {k:v["total"] for k,v in operators.items()})
print("commission paid:", out["commissionPaid"])
