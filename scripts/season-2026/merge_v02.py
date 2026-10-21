#!/usr/bin/env python3
"""Merge iteration-2 findings (zip archive parsed) into task108's docs/summary/SUMMARY.html -> v0.2"""
import re, shutil, os

REPO = "/home/z/my-project/cartest"
SRC = f"{REPO}/docs/summary/SUMMARY.html"
html = open(SRC).read()

# 0. charts: copy PNGs into repo docs/summary/charts/
os.makedirs(f"{REPO}/docs/summary/charts", exist_ok=True)
for f in os.listdir("/home/z/my-project/download/charts"):
    shutil.copy(f"/home/z/my-project/download/charts/{f}", f"{REPO}/docs/summary/charts/{f}")

# 1. header version
html = html.replace(
    "собрано 18.10.2026 · до дедлайна 25.10.2026 · <b>версия v0.1 (итерация 1)</b>",
    "собрано 18.10, обновлено 19.10 · до дедлайна 25.10.2026 · <b>версия v0.2 (итерация 2: архив договоров распарсен)</b>")

# 2. nav item
html = html.replace(
    '<a href="#rent">📍 Аренда</a>',
    '<a href="#rent">📍 Аренда</a><a href="#arch">📦 Архив договоров</a>')

# 3. new archive section BEFORE sales section
arch = """
<section id="arch">
<h2 class="sales">1b · АРХИВ ДОГОВОРОВ — «все договора.zip» распарсен (19.10)</h2>
<div class="grid g5">
<div class="kpi "><div class="kpi-l">Файлов в архиве</div><div class="kpi-v">145</div><div class="kpi-s">docx 143 · pdf 1 · txt 1</div></div>
<div class="kpi kpi-win"><div class="kpi-l">Совпало с базой</div><div class="kpi-v">88 аренд</div><div class="kpi-s">матч «ТС+дата+фамилия»</div></div>
<div class="kpi kpi-bad"><div class="kpi-l">НЕ в базе</div><div class="kpi-v">26 договоров</div><div class="kpi-s">≈ 226 250 ₽ известных сумм</div></div>
<div class="kpi "><div class="kpi-l">Только в Excel</div><div class="kpi-v">4 аренды</div><div class="kpi-s">55 000 ₽, договоров нет</div></div>
<div class="kpi "><div class="kpi-l">Тест-драйвы / ДКП</div><div class="kpi-v">11 / 4</div><div class="kpi-s">+ 9 пустых шаблонов</div></div>
</div>

<div class="grid g2" style="margin-top:12px">
<div class="card" style="background:#fff"><h3 style="color:#5A6B7E">Состав архива (145 файлов)</h3><img class="chart" src="charts/ch2_zip_class.png" alt="Состав архива"></div>
<div class="card" style="background:#fff"><h3 style="color:#5A6B7E">Покрытие сезона: Supabase vs бумага</h3><img class="chart" src="charts/ch1_coverage.png" alt="Покрытие"></div>
</div>

<div class="card" style="margin-top:12px;background:#fff"><h3 style="color:#5A6B7E">Вне базы: известные суммы (к импорту retro_backfill_v2)</h3><img class="chart" src="charts/ch4_missing_money.png" alt="Суммы вне базы"></div>

<div class="card" style="margin-top:12px">
<h3>Июль — начало августа: 19 договоров, которых нет в базе (17 июльских + 2 от 05.08)</h3>
<p class="dim" style="font-size:12.5px;margin-bottom:8px">Ранний «бумажный» период /doc-команды (до эры атрибуции 25.07). Суммы из тел договоров («Итого к оплате»). Полная таблица — в DOWNLOAD/SUMMARY.html (светлая версия, раздел 4).</p>
<table>
<tr><th>Дата</th><th>№ дог.</th><th>Арендатор</th><th>ТС</th><th>Сумма</th></tr>
<tr><td>05.08</td><td>05.08/APRILIA</td><td>Ларин А.А. <span class="flag">файл назван 29.06</span></td><td>Aprilia Shiver</td><td>6 500 ₽</td></tr>
<tr><td>02.07</td><td>2.7/KAWASAKI</td><td>Галанов Андрей</td><td>Kawasaki EX650K</td><td>20 000 ₽</td></tr>
<tr><td>03.07</td><td>3.7_2/BMW</td><td>Фимин Максим</td><td>BMW F800R</td><td>12 000 ₽</td></tr>
<tr><td>03.07</td><td>3.7/DUCATI</td><td>Сидоров Андрей</td><td>Ducati P. S-Electro</td><td class="dim">в теле</td></tr>
<tr><td>03.07</td><td>3.7_2/DUCATI</td><td>Томашевский Нектарий</td><td>Ducati P. S-Electro</td><td class="dim">в теле</td></tr>
<tr><td>03.07</td><td>3.7/JILANG</td><td>Сухарев Андрей</td><td>Jilang Max Pro</td><td>5 000 ₽</td></tr>
<tr><td>03.07</td><td>888</td><td>Кузовлев Иван</td><td>Suzuki GSX-S1000F</td><td class="dim">в теле</td></tr>
<tr><td>04.07</td><td>4.7/BMW</td><td>Локтев Дмитрий</td><td>BMW F800R</td><td>12 000 ₽</td></tr>
<tr><td>04.07</td><td>4.7/DUCATI</td><td>Гречковский Сергей</td><td>Ducati P. S-Electro</td><td>10 000 ₽</td></tr>
<tr><td>04.07</td><td>4.7/DUCATI</td><td>Заваленский Игорь</td><td>Ducati P. S-Electro</td><td>3 750 ₽</td></tr>
<tr><td>04–06.07</td><td>4.7/5.7 NIBBLER</td><td>Новиков Алексей ×2</td><td>Nibbler 300</td><td>2 250 ₽ ×2</td></tr>
<tr><td>05.07</td><td>5.7/DUCATI-RED</td><td>Чуфыркин Михаил</td><td>Ducati P. S-Electro Red</td><td>12 000 ₽</td></tr>
<tr><td>06.07</td><td>6.7/NIBBLER</td><td>Шевчук Эдуард</td><td>Nibbler 300</td><td>8 000 ₽</td></tr>
<tr><td>08.07</td><td>8.7/DUCATI-RED</td><td>Халикова Диана</td><td>Ducati P. S-Electro Red</td><td>17 000 ₽</td></tr>
<tr><td>10.07</td><td>10.7/BMW</td><td>Павликов Дмитрий</td><td>BMW F800R</td><td>28 000 ₽</td></tr>
<tr><td>10.07</td><td>10.7/RERODE</td><td>Ворожейкин Степан</td><td>Rerode R1+</td><td>32 500 ₽</td></tr>
<tr><td>11.07</td><td>11.07</td><td>Алиев Амаль</td><td>Nibbler 300</td><td class="dim">в теле</td></tr>
<tr><td>05.08</td><td>№4</td><td>Буробин Даниил (Сидоров И.О.)</td><td>Ducati</td><td class="dim">долгосрочный 05.08→30.11</td></tr>
</table>
<p class="dim" style="font-size:12px;margin-top:6px">⚠ Red Panigale (Чуфыркин, Халикова) — байка нет в cars: вопрос боссу (создать карточку?).</p>
</div>

<div class="card" style="margin-top:12px">
<h3>Май — начало июня: ещё 7 договоров старого образца (суммы в теле)</h3>
<table>
<tr><th>Дата</th><th>№ дог.</th><th>Арендатор</th><th>ТС</th></tr>
<tr><td>09.05</td><td>9-05/1</td><td>Стерлягов Алексей</td><td>Sequence Zero (2 часа, тариф 3 000/час)</td></tr>
<tr><td>16.05</td><td>16-5</td><td>Калинин Илья</td><td>Falcon GT/PRO (тариф 3 000+4 000/час)</td></tr>
<tr><td>18.05</td><td>16-5/1</td><td>Могучев Иван</td><td>Falcon GT/PRO</td></tr>
<tr><td>20.05</td><td>20-05/1</td><td>Мирошников Станислав</td><td>Horwin CR1 («стоимость 8000 за 2 дня»)</td></tr>
<tr><td>20.05</td><td>20-05/2</td><td>Шкитин Михаил</td><td>Ducati Panigale</td></tr>
<tr><td>26.05</td><td>26.5/1</td><td>Воронцов Денис</td><td>Kawasaki EX650K (VIN JKAEX650KKDA31636)</td></tr>
<tr><td>01.06</td><td>20-05/2 (копия)</td><td>Голубев Валерий</td><td>Ducati Panigale</td></tr>
</table>
</div>

<div class="note" style="margin-top:12px"><b>Статус майской дыры:</b> ✅ залито ранее 5 аренд (46 000 ₽, retro_backfill_v1: Коняхин, Zero 04.05, Ульви, Забалдин, Шаронов+экип).
📦 теперь найдены договоры ещё на <b>7 майских + 19 июльских</b> аренд; из Excel — 4 строки без договоров (Платонов 30 000, Коля 2 000, слава 4 000 бартер, Борский 19 000).
<b>Прогноз сезона аренды после импорта: ≈ 2 019 716 ₽+</b> (сейчас учтено 1 793 466 ₽).</div>
</section>
"""
html = html.replace('<section id="sales">', arch + '\n<section id="sales">')

# 4. Sales: add cash verification KPI note
html = html.replace(
    '<div class="card" style="margin-top:12px"><h3>Ведомость продаж',
    """<div class="card" style="margin-top:12px"><h3>Сверка с кассой БД (cash_transactions)</h3>
<p style="font-size:13.5px">В кассе БД зафиксировано <b>35 оплат продаж на 14 593 000 ₽</b> (income_sale): июнь 3 930 000 · июль 6 063 000 · август 2 615 000 · сентябрь 1 675 000 · октябрь 310 000 ₽.
Excel даёт 17 793 800 ₽ — разница = наличные/USDT/бартер мимо кассы («карта китайца», «БАРТЕР ОЛЕГ», «в аренду ушел») и продажи до запуска кассы (апрель–май). Для итоговой статистики источник — Excel, касса — для контроля.</p></div>

<div class="card" style="margin-top:12px"><h3>Ведомость продаж""")

# 5. Update "next" section: zip arrived
html = html.replace(
    "1) <b>.zip с договорами не загрузился</b> — пришлите повторно: докуплю оставшиеся майские аренды (Zero/Платонов 30 000, Борский 19 000, Хорвин 2 000, слава 4 000, 1.5 дня) и сверю по документам;",
    "1) <b>.zip получен и распарсен (19.10)</b> — найдены 26 договоров вне базы + 4 аренды только в Excel; следующий шаг — импорт retro_backfill_v2 (суммы 5 майских договоров добираются из тел);")

# 6. footer
html = html.replace(
    "Сгенерировано task108 · SUMMARY.html v0.1",
    "Сгенерировано task108 · обновлено task-«архив договоров» 19.10 · SUMMARY.html v0.2 · +98 250 ₽ к предварительной оценке сезона после импорта")

open(SRC, "w").write(html)
print("patched:", SRC, len(html), "bytes")
