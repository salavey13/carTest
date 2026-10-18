#!/usr/bin/env python3
"""Generate infographics for SUMMARY.html iteration 1 (Russian labels)."""
import json, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
          "/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf"):
    try:
        fm.fontManager.addfont(p)
    except Exception:
        pass
import matplotlib.pyplot as plt

plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Noto Sans SC"]
plt.rcParams["axes.unicode_minus"] = False
plt.rcParams["axes.edgecolor"] = "#C9D2DE"
plt.rcParams["axes.labelcolor"] = "#1A2332"
plt.rcParams["xtick.color"] = "#3D4A5C"
plt.rcParams["ytick.color"] = "#3D4A5C"
plt.rcParams["text.color"] = "#1A2332"

OUT = "/home/z/my-project/download/charts"
os.makedirs(OUT, exist_ok=True)
D = json.load(open("/home/z/my-project/scripts/summary_data.json"))

BLUE, AMBER, GREEN, RED, GRAY, TEAL = "#0F4C81", "#E8A33D", "#2E8B57", "#C0392B", "#98A6B3", "#3D8B8B"

def save(fig, name):
    fig.savefig(f"{OUT}/{name}", dpi=150, facecolor="white")
    plt.close(fig)
    print("chart:", name)

MONTHS = {"2026-05": "май", "2026-06": "июнь", "2026-07": "июль", "2026-08": "август",
          "2026-09": "сентябрь", "2026-10": "октябрь", "unknown": "н/д"}

# ---------- 1. Coverage timeline: contracts vs DB ----------
ms = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
db_cnt = [D["db"]["months_cnt"].get(m, 0) for m in ms]
doc_cnt = [0, 0, 0, 0, 0, 0]
for m in D["missing_doc_era"]:
    d = (m["date"] or "")[:7]
    if d in ms:
        doc_cnt[ms.index(d)] += 1
for m in D["missing_pre_doc"]:
    d = (m["date"] or "")[:7]
    if d in ms:
        doc_cnt[ms.index(d)] += 1
xlsx_cnt = [2, 2, 0, 0, 0, 0]  # Платонов+Коля+слава+Борский в мае(4)/.. roughly: май 4 (Платонов, Коля, слава, Борский), 0 иначе
xlsx_cnt = [4, 0, 0, 0, 0, 0]

fig, ax = plt.subplots(figsize=(9.5, 4.6), constrained_layout=True)
x = range(len(ms))
w = 0.38
b1 = ax.bar([i - w/2 for i in x], db_cnt, w, label="Аренды в Supabase", color=BLUE)
b2 = ax.bar([i + w/2 for i in x], doc_cnt, w, label="Договоры НЕ в базе (из архива)", color=RED)
b3 = ax.bar([i + w/2 for i in x], xlsx_cnt, w, bottom=doc_cnt, label="Ручные аренды только из Excel", color=AMBER)
for i, v in enumerate(db_cnt):
    ax.text(i - w/2, v + 1.5, str(v), ha="center", fontsize=9, color=BLUE, fontweight="bold")
for i, v in enumerate([doc_cnt[i] + xlsx_cnt[i] for i in x]):
    if v:
        ax.text(i + w/2, v + 1.5, str(v), ha="center", fontsize=9, color=RED, fontweight="bold")
ax.set_xticks(list(x))
ax.set_xticklabels([MONTHS[m] for m in ms], fontsize=10)
ax.set_ylabel("Аренды")
ax.set_title("Покрытие данными: Supabase vs бумажный архив (по дате начала аренды)", fontsize=12, fontweight="bold")
ax.legend(loc="upper left", fontsize=9, frameon=False)
ax.spines[["top", "right"]].set_visible(False)
ax.set_ylim(0, max(db_cnt) * 1.18)
save(fig, "ch1_coverage.png")

# ---------- 2. Zip classification donut ----------
z = D["zip"]["kinds"]
labels_map = [
    ("MATCHED_DB", "Совпало с базой", GREEN),
    ("DOC_ERA_UNMATCHED", "Договоры июля — НЕТ в базе", RED),
    ("PRE_DOC_ERA", "Договоры мая — НЕТ в базе", AMBER),
    ("TEMPLATE", "Шаблоны (пустые)", GRAY),
    ("TESTDRIVE", "Тест-драйвы", TEAL),
    ("SALE_CONTRACT", "ДКП (продажи)", BLUE),
]
vals = [z.get(k, 0) for k, _, _ in labels_map]
labels = [f"{lbl}\n{v}" for (_, lbl, _), v in zip(labels_map, vals)]
colors = [c for _, _, c in labels_map]
fig, ax = plt.subplots(figsize=(8.6, 4.8), constrained_layout=True)
wedges, _ = ax.pie(vals, colors=colors, startangle=90, counterclock=False,
                   wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2))
ax.text(0, 0.08, "145", ha="center", fontsize=26, fontweight="bold", color="#1A2332")
ax.text(0, -0.18, "файлов\nв архиве", ha="center", fontsize=10, color="#3D4A5C")
ax.legend(wedges, labels, loc="center left", bbox_to_anchor=(1.02, 0.5), fontsize=9, frameon=False)
ax.set_title("Состав архива «все договора.zip»", fontsize=12, fontweight="bold")
save(fig, "ch2_zip_class.png")

# ---------- 3. DB revenue by month ----------
mm = [m for m in ms if D["db"]["months_cnt"].get(m)]
cnts = [D["db"]["months_cnt"][m] for m in mm]
sums = [D["db"]["months_sum"].get(m, 0) / 1000 for m in mm]
fig, ax = plt.subplots(figsize=(9.5, 4.4), constrained_layout=True)
bars = ax.bar([MONTHS[m] for m in mm], sums, 0.55, color=BLUE)
for b, s, c in zip(bars, sums, cnts):
    ax.text(b.get_x() + b.get_width()/2, s + 8, f"{s:,.0f}k".replace(",", " "),
            ha="center", fontsize=9.5, fontweight="bold", color=BLUE)
    ax.text(b.get_x() + b.get_width()/2, s/2 if s > 90 else s + 30, f"{c} шт",
            ha="center", fontsize=8.5, color="white" if s > 90 else "#3D4A5C")
ax.set_ylabel("Выручка, тыс ₽")
ax.set_title("Аренда в Supabase: выручка и кол-во по месяцам (сейчас в базе)", fontsize=12, fontweight="bold")
ax.spines[["top", "right"]].set_visible(False)
tot = D["db"]["revenue_total"] / 1000
ax.text(0.99, 0.96, f"Итого учтено: {tot:,.0f} тыс ₽".replace(",", " "),
        transform=ax.transAxes, ha="right", fontsize=10, fontweight="bold", color=GREEN)
save(fig, "ch3_db_revenue.png")

# ---------- 4. Missing money ----------
fig, ax = plt.subplots(figsize=(9.5, 4.2), constrained_layout=True)
cats = ["Договоры июля\n(16 с суммами)", "Только Excel\n(4 аренды)", "Договоры мая\n(7, суммы в теле)"]
vals = [D["missing_doc_era_sum"], D["projection"]["xlsx_only_sum"], 0]
tbd = [5, 0, 7]
bars = ax.barh(cats[::-1], vals[::-1], 0.5, color=[AMBER, RED, GRAY][::-1])
for i, (v, t) in enumerate(zip(vals[::-1], tbd[::-1])):
    ax.text(v + 2500, i, f"{v:,.0f} ₽".replace(",", " ") + (f"  +{t} без суммы" if t else ""),
            va="center", fontsize=9.5, fontweight="bold", color="#1A2332")
ax.set_xlabel("₽")
ax.set_title("Вне базы: известные суммы (к импорту)", fontsize=12, fontweight="bold")
ax.spines[["top", "right"]].set_visible(False)
ax.set_xlim(0, max(vals) * 1.45)
save(fig, "ch4_missing_money.png")

# ---------- 5. Sales ----------
fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.2), constrained_layout=True)
ms2 = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
sv = [D["cash"]["months_sale"].get(m, 0) / 1e6 for m in ms2]
axes[0].bar([MONTHS[m] for m in ms2], sv, 0.55, color=TEAL)
for i, v in enumerate(sv):
    axes[0].text(i, v + 0.1, f"{v:.2f}", ha="center", fontsize=9, fontweight="bold", color=TEAL)
axes[0].set_title("Продажи в кассе БД (cash_transactions)", fontsize=11, fontweight="bold")
axes[0].set_ylabel("млн ₽")
axes[0].spines[["top", "right"]].set_visible(False)
x2 = ["Выручка\n(ксц)", "Затраты\nна закупку", "Прибыль", "Склад\n(остаток)"]
y2 = [D["xlsx_sales"]["revenue_total"]/1e6, D["xlsx_sales"]["cost_total"]/1e6,
      D["xlsx_sales"]["profit_total"]/1e6, (D["xlsx_sales"]["stock_salon"]+D["xlsx_sales"]["stock_partner"])/1e6]
axes[1].bar(x2, y2, 0.55, color=[TEAL, RED, GREEN, GRAY])
for i, v in enumerate(y2):
    axes[1].text(i, v + 0.25, f"{v:.2f}", ha="center", fontsize=9, fontweight="bold")
axes[1].set_title("Excel «Закупка/продажа» (на 29.09.2026)", fontsize=11, fontweight="bold")
axes[1].set_ylabel("млн ₽")
axes[1].spines[["top", "right"]].set_visible(False)
save(fig, "ch5_sales.png")

# ---------- 6. DB sources ----------
src = D["db"]["sources"]
items = sorted(src.items(), key=lambda kv: -kv[1])[:9]
fig, ax = plt.subplots(figsize=(9.5, 4.2), constrained_layout=True)
names = [k for k, _ in items][::-1]
v = [x for _, x in items][::-1]
cols = [BLUE if n == "doc_command" else GRAY for n in names]
ax.barh(names, v, 0.6, color=cols)
for i, (n, x) in enumerate(zip(names, v)):
    ax.text(x + 1, i, str(x), va="center", fontsize=9, fontweight="bold")
ax.set_title("Источники строк в Supabase rentals (281 всего)", fontsize=12, fontweight="bold")
ax.spines[["top", "right"]].set_visible(False)
save(fig, "ch6_sources.png")

print("ALL CHARTS DONE ->", OUT)
