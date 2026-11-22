#!/usr/bin/env python3
"""
make-contract-template.py
Converts source rental contract .docx into a docxtemplater template.
Replaces _____-blanks with {placeholder} tags matching lib/types.ts schema.
Order: MOST SPECIFIC → LEAST SPECIFIC to avoid partial-match corruption.

Run:
  python3 scripts/make-contract-template.py
Output:
  templates/contract-rental.docx
"""

import zipfile, shutil
from pathlib import Path

SRC    = Path("/Users/user/Downloads/Telegram Desktop/Договор_проката_аренды_электромотоцикла.docx")
WORK   = Path("/tmp/contract-tmpl-work2")
OUTDIR = Path(__file__).parents[1] / "templates"
OUT    = OUTDIR / "contract-rental.docx"

# ── Setup ──────────────────────────────────────────────────────────────────
shutil.rmtree(WORK, ignore_errors=True)
WORK.mkdir(parents=True)
OUTDIR.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(SRC, "r") as z:
    z.extractall(WORK)

doc_path = WORK / "word" / "document.xml"
xml = doc_path.read_text(encoding="utf-8")

def r(old: str, new: str) -> None:
    global xml
    xml = xml.replace(old, new)

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 1 — HEADER
# ═══════════════════════════════════════════════════════════════════════════
r("ДОГОВОР № ____", "ДОГОВОР № {contractNumber}")

# Date pattern: «  in its own run + ___» __________ 2026 in next run
# Strip « from its run so contractDate can include «ДД» месяц ГГГГ
r("   «</w:t>", "   </w:t>")
# Single-run date in appendices
r("«___» __________ 2026г.", "{contractDate}г.")
r("«___» __________ 2026 г.", "{contractDate} г.")
# Split date run (preamble date line) — after « was removed from previous run
r("___» __________ 2026</w:t>", "{contractDate}</w:t>")
# Appendix dates: « was also stripped from their split runs → match without «
r("___» __________ 2026г.", "{contractDate}г.")   # covers variants with г. already in run
r("___» __________ 2026 г.", "{contractDate} г.")

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 2 — АРЕНДОДАТЕЛЬ (lessor)
# ═══════════════════════════════════════════════════════════════════════════

# Single-run full version (Appendix 1) — MUST come before two-run version
r(
    "Индивидуальный предприниматель/Общество с ограниченной ответственностью"
    " __________________________, ОГРНИП/ОГРН __________________, ИНН __________________,"
    " адрес: __________________________, в лице __________________________, действующего"
    " на основании __________________________, именуемый в дальнейшем «Арендодатель»,"
    " с одной стороны,",
    "{lessor.entityType} {lessor.name}, ОГРНИП/ОГРН {lessor.ogrn}, ИНН {lessor.inn},"
    " адрес: {lessor.address}, в лице {lessor.signatory}, действующего на основании"
    " {lessor.basis}, именуемый в дальнейшем «Арендодатель», с одной стороны,"
)

# Two-run version (preamble): run 1
r(
    "Индивидуальный предприниматель/Общество с ограниченной ответственностью"
    " __________________________, ОГРНИП/ОГРН",
    "{lessor.entityType} {lessor.name}, ОГРНИП/ОГРН"
)
# Two-run version: run 2 (continuation of preamble lessor para)
r(
    "__________________, ИНН __________________, адрес: __________________________,"
    " в лице __________________________, действующего на основании __________________________,"
    " именуемый",
    "{lessor.ogrn}, ИНН {lessor.inn}, адрес: {lessor.address},"
    " в лице {lessor.signatory}, действующего на основании {lessor.basis}, именуемый"
)

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 3 — АРЕНДАТОР (client)
# ═══════════════════════════════════════════════════════════════════════════

# Single-run version (Appendix 1): 'и гражданин/ИП/ООО__________________________,'
r(
    "и гражданин/ИП/ООО__________________________,",
    "и {client.entityType} {client.fullName},"
)
# Also the appended ', именуемый' run in Appendix 1
r(
    "<w:t>__________________________, именуемый</w:t>",
    "<w:t xml:space=\"preserve\"> {client.fullName}, именуемый</w:t>"
)

# Multi-run version (preamble): 'и гражданин' | '/' | 'ИП' | '/' | 'ООО' | '____________' | '______________,'
# Step A: replace 'и гражданин' run text (no space variant)
r("<w:t>и гражданин</w:t>", "<w:t xml:space=\"preserve\">и {client.entityType}</w:t>")
# Step B: replace first ____________ (the entity-name blank) → fullName
# Use most specific version first (the exact 12-underscore run)
r(
    "<w:t>____________</w:t>",
    "<w:t xml:space=\"preserve\"> {client.fullName}</w:t>"
)
# Step C: replace second blank run that follows (12+2 underscores + comma)
r(
    "<w:t xml:space=\"preserve\">______________, </w:t>",
    "<w:t></w:t>"
)

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 4 — ТС SPECS
# ═══════════════════════════════════════════════════════════════════════════
r("марка/модель __________________,", "марка/модель {bike.makeModel},")
# VIN — text split: first run ends with '(VIN', second starts with ') __________________,'
r(") __________________,", ") {bike.vin},")
r("год выпуска ________,", "год выпуска {bike.year},")
r("цвет ________,", "цвет {bike.color},")
r("мощность двигателя (номинальная) ____ кВт,", "мощность двигателя (номинальная) {bike.powerKw} кВт,")
r("максимальная конструктивная скорость ____ км/ч,", "максимальная конструктивная скорость {bike.maxSpeedKmh} км/ч,")
r("аккумулятор: тип/емкость __________", "аккумулятор: тип/емкость {bike.battery}")
# Battery line is split: run1 = 10 underscores (done above), run2 = '________. ' (8+period)
r("________. </w:t>", ". </w:t>")

# Appendix 1 ТС line (different run split)
r("ТС: марка/модель __________________, № рамы (", "ТС: {bike.makeModel}, № рамы (")
r(") _______________", ") {bike.vin}")
r("___, цвет ________", ", цвет {bike.color}")

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 5 — RENTAL PERIOD
# ═══════════════════════════════════════════════════════════════════════════
# "Срок аренды: с «___» __________ 2026 г. ____:____ по «___» __________ 2026 г. ____:____."
# This is split across 3 runs. We replace each piece.
r("Срок аренды: с «___» __________ 2026 г. ___", "Срок аренды: с {rentStart}")
r("___ по «___» ________", " по {rentEnd}")
r("__ 2026 г. ____:____.", ".")

# Return address — SPLIT across two runs: 12 underscores + '__, если'
r("Возврат ТС осуществляется по адресу: ____________",
  "Возврат ТС осуществляется по адресу: {returnAddress}")
# Clean up the leftover '__' from the second run of the return address
r("<w:t>__, если</w:t>", "<w:t xml:space=\"preserve\">, если</w:t>")

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 6 — PRICE & DEPOSIT
# ═══════════════════════════════════════════════════════════════════════════
r("Размер арендной платы: ________ руб. за час / ________ руб. за сутки",
  "Размер арендной платы: {priceHour} руб. за час / {priceDay} руб. за сутки")
# deposit — match the partial run text (paragraph starts mid-word)
r("ечительный платеж (депозит): ________ руб.,",
  "ечительный платеж (депозит): {deposit} руб.,")

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 7 — APPENDIX 3 (tariffs/fines — p3_* placeholders)
# ═══════════════════════════════════════════════════════════════════════════

# Vehicle value for loss/total loss
r("Стоимость ТС для целей возмещения при утрате/тотальной гибели: _________",
  "Стоимость ТС для целей возмещения при утрате/тотальной гибели: {p3_vehicleValue}")
# The split __ руб. run right after:
r("__ руб.</w:t>", "{p3_vehicleValue_rub} руб.</w:t>")

# Tariff description lines
r("Тарифы аренды и перерасчет времени: __________",
  "Тарифы аренды и перерасчет времени: {p3_tariffDescription}")

# Idle rate / downtime
r("Тариф простоя/упущенной выгоды (если применяется): ________ руб./сутки, максимум ____ суток.",
  "Тариф простоя/упущенной выгоды (если применяется): {p3_idleRate} руб./сутки, максимум {p3_idleDays} суток.")
r("убытки в виде упущенной выгоды/платы за простой по тарифу ________ руб. за сутки, но",
  "убытки в виде упущенной выгоды/платы за простой по тарифу {p3_idleRate} руб. за сутки, но")
r("не более ____ суток, или", "не более {p3_idleDays} суток, или")

# Fine amounts (штрафы)
r("а) передача управления третьему лицу – штраф ________ руб.;",
  "а) передача управления третьему лицу – штраф {p3_fine_transfer} руб.;")
r("ния – штраф ________ руб.;", "ния – штраф {p3_fine_boundary} руб.;")
r("/средств контроля – штраф ________ руб. плюс стоимость восстановления;",
  "/средств контроля – штраф {p3_fine_tracker} руб. плюс стоимость восстановления;")
r("Арендодателя – штраф ________ руб.;", "Арендодателя – штраф {p3_fine_accident} руб.;")
r("ние правил зарядки – штраф ________ руб. плюс стоимость восстановления АКБ/электрооборудования.",
  "ние правил зарядки – штраф {p3_fine_charging} руб. плюс стоимость восстановления АКБ/электрооборудования.")

# ________ руб. за сутки (from main body §7.3)
r("________ руб. за сутки [(нужное отметить).]{.mark}",
  "{p3_idleRate} руб. за сутки (нужное отметить).")

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 8 — APPENDIX 4 (PDN consent — клиент + арендодатель данные)
# ═══════════════════════════════════════════════════════════════════════════
r(
    "Я, _______________________,дата рождения: __.__.____, паспорт: серия ______ № __________,"
    " выдан «___» __________ ____ г. ______________,",
    "Я, {client.fullName}, дата рождения: {client.birthDate},"
    " паспорт: серия {client.passportSeries} № {client.passportNumber},"
    " выдан {client.passportIssuedDate}, {client.passportIssuedBy},"
    " к/п {client.passportDeptCode},"
)
r("адрес регистрации: _____________________________,",
  "адрес регистрации: {client.registrationAddress},")
r("телефон: ______________________,", "телефон: {client.phone},")
r(": ______________________,", ": {client.telegram},")
r(
    "даю свое согласие Оператору персональных данных - ИП/ООО _______________________________,",
    "даю свое согласие Оператору персональных данных — {lessor.entityType} {lessor.name},"
)
r(
    "ОГРНИП/ОГРН ______________________, ИНН _______________, адрес: ___________________________,",
    "ОГРНИП/ОГРН {lessor.ogrn}, ИНН {lessor.inn}, адрес: {lessor.address},"
)

# ═══════════════════════════════════════════════════════════════════════════
# SECTION 9 — SIGNATURE BLOCK & REMAINING STRUCTURAL BLANKS
# ═══════════════════════════════════════════════════════════════════════════

# Signature table cells (e.g. «___/__________/») — leave as {{уточнить}} markers
# These are structural/hand-filled items in the Act
r("Уровень заряда АКБ при передаче: ____ %; при возврате: ____ %",
  "Уровень заряда АКБ при передаче: {p1_chargeIn} %; при возврате: {p1_chargeOut} %")
r("Показания (если применимо): пробег/моточасы __________________",
  "Показания (если применимо): пробег/моточасы {p1_odometer}")
r("Дата и время передачи: «___» __________ 2026 г. ___",
  "Дата и время передачи: {rentStart}")
r("«___» __________ 2026 г. ___", "{rentEnd}")

# Appendix 3 dates
r("__.___.2026г.", "{contractDate}г.")

# ═══════════════════════════════════════════════════════════════════════════
# Save template
# ═══════════════════════════════════════════════════════════════════════════
doc_path.write_text(xml, encoding="utf-8")

OUT.unlink(missing_ok=True)
with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zout:
    for fpath in sorted(WORK.rglob("*")):
        if fpath.is_file():
            zout.write(fpath, fpath.relative_to(WORK))

print(f"✅ Template written to: {OUT}")
print(f"   Size: {OUT.stat().st_size:,} bytes")

# Verification
import re as re_mod
with zipfile.ZipFile(OUT) as zv:
    xml_check = zv.read("word/document.xml").decode("utf-8")

remaining = re_mod.findall(r'<w:t[^>]*>[^<]*____[^<]*</w:t>', xml_check)
placeholders = sorted(set(re_mod.findall(r'\{[a-zA-Z][^}]*\}', xml_check)))

print(f"\n📋 Placeholders ({len(placeholders)}):")
for p in placeholders:
    print(f"   {p}")

if remaining:
    print(f"\n⚠  Remaining ____-blanks ({len(remaining)}):")
    for l in remaining[:15]:
        # extract text content
        txt = re_mod.search(r'<w:t[^>]*>([^<]+)</w:t>', l)
        if txt:
            print(f"   {txt.group(1)[:100]}")
else:
    print("\n✅ No remaining ____-blanks")
