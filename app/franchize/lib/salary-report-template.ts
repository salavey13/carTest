// app/franchize/lib/salary-report-template.ts
//
// Task 77 (boss 2026-10-07): «add ability to receive salary report as tg
// file similarly to subrenters reports».
//
// Pure rendering layer for the member salary report DOCX (the TG-file the
// salary page / «Мои доходы» panel sends). Zero server deps — unit-tested
// in tests/franchize/salary-report.spec.ts and consumed by
// app/franchize/server-actions/salary-report.ts, which assembles variables
// (calculateSalaryForPeriod + crew_member_shifts detail) and pushes the
// bytes through buildFranchizeDocxFromTemplate → sendTelegramDocument, the
// exact pipeline the subrenter weekly report uses.
//
// Placeholder syntax = the shared applyTemplateVariables mustache dialect
// ({{var}}, {{#if var}}), same as SUBRENT_WEEKLY_REPORT_TEMPLATE.html.

export interface SalaryReportShiftRow {
  /** Human date, e.g. «25.09.2026». */
  dateLabel: string;
  /** Human duration, e.g. «10 ч 00 м». */
  hoursLabel: string;
  /** Hourly rate, ₽/h. */
  rateRub: number;
  /** Accrued for the shift, ₽. */
  amountRub: number;
}

export interface SalaryReportDetailRow {
  description: string;
  amount: number;
}

const fmtRub = (n: number): string => Math.round(n).toLocaleString("ru-RU");

/** One <tr> per shift for the shifts table (mirrors the subrenter rows idiom). */
export function renderSalaryShiftRowsHtml(rows: SalaryReportShiftRow[]): string {
  return rows
    .map(
      (r) =>
        `<tr>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: center;">${r.dateLabel}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: center;">${r.hoursLabel}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: right;">${fmtRub(r.rateRub)}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: right;">${fmtRub(r.amountRub)}</td>` +
        `</tr>`,
    )
    .join("\n");
}

/** One <tr> per breakdown line (Смены / Аренда (…) / Продажа (…) / …). */
export function renderSalaryBreakdownRowsHtml(details: SalaryReportDetailRow[]): string {
  if (details.length === 0) {
    return `<tr><td colspan="2" style="border: 1px solid #000; padding: 4pt 6pt; text-align: center;">Начислений за период не было</td></tr>`;
  }
  return details
    .map(
      (d) =>
        `<tr>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt;">${d.description}</td>` +
        `<td style="border: 1px solid #000; padding: 4pt 6pt; text-align: right;">${fmtRub(d.amount)}</td>` +
        `</tr>`,
    )
    .join("\n");
}

/**
 * The salary report HTML template. Variables:
 *   crew_name, member_full_name, member_tg, date_from, date_to, generated_at,
 *   zero_shifts ("1"/""), shifts_table_rows, shifts_count, shifts_hours,
 *   shifts_total_rub, breakdown_table_rows, commissions_total_rub, total_rub
 * (the calculation-rules footnote is static — it names the crew's
 * «Как считаются деньги» page so members see the constants' source).
 */
export const SALARY_REPORT_TEMPLATE = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Отчет о начислениях зарплаты</title>
<style>
  body { font-family: "Times New Roman", serif; font-size: 11pt; margin: 0; }
  p { margin: 4pt 0; }
  table { border-collapse: collapse; width: 100%; }
</style>
</head>
<body>

<p style="text-align: right;">Экипаж: {{crew_name}}</p>
<p style="text-align: right;">Сформировано: {{generated_at}}</p>

<p style="text-align: center; font-weight: bold; margin-top: 14pt;">ОТЧЕТ О НАЧИСЛЕНИЯХ ЗАРПЛАТЫ</p>
<p style="text-align: center;">{{member_full_name}} (Telegram {{member_tg}})</p>
<p style="text-align: center; font-weight: bold;">с {{date_from}} по {{date_to}}</p>

<p style="font-weight: bold; margin-top: 12pt;">1. Смены за период</p>

{{#if zero_shifts}}
<p>Смен за отчетный период не было.</p>
{{else}}
<table style="border: 1px solid #000; margin-top: 6pt;">
<tr>
  <th style="border: 1px solid #000; padding: 4pt 6pt; width: 25%;">Дата (МСК)</th>
  <th style="border: 1px solid #000; padding: 4pt 6pt; width: 25%;">Длительность</th>
  <th style="border: 1px solid #000; padding: 4pt 6pt; width: 25%;">Ставка, руб./ч</th>
  <th style="border: 1px solid #000; padding: 4pt 6pt; width: 25%;">Начислено, руб.</th>
</tr>
{{shifts_table_rows}}
</table>
{{/if}}

<p style="font-weight: bold; margin-top: 12pt;">2. Итоги за период</p>
<table style="border: 1px solid #000; margin-top: 6pt; width: 100%;">
<tr>
  <td style="border: 1px solid #000; padding: 4pt 8pt; width: 70%;">Смен за период</td>
  <td style="border: 1px solid #000; padding: 4pt 8pt; text-align: right;">{{shifts_count}}</td>
</tr>
<tr>
  <td style="border: 1px solid #000; padding: 4pt 8pt;">Отработано часов</td>
  <td style="border: 1px solid #000; padding: 4pt 8pt; text-align: right;">{{shifts_hours}}</td>
</tr>
<tr>
  <td style="border: 1px solid #000; padding: 4pt 8pt;">Начислено за смены, руб.</td>
  <td style="border: 1px solid #000; padding: 4pt 8pt; text-align: right;">{{shifts_total_rub}}</td>
</tr>
<tr>
  <td style="border: 1px solid #000; padding: 4pt 8pt;">Комиссии с аренд и продаж, руб.</td>
  <td style="border: 1px solid #000; padding: 4pt 8pt; text-align: right;">{{commissions_total_rub}}</td>
</tr>
</table>

<p style="font-weight: bold; margin-top: 12pt;">3. Детализация начислений (смены, комиссии с аренд и продаж)</p>
<table style="border: 1px solid #000; margin-top: 6pt; width: 100%;">
<tr>
  <th style="border: 1px solid #000; padding: 4pt 6pt; width: 70%;">Статья</th>
  <th style="border: 1px solid #000; padding: 4pt 6pt; width: 30%;">Сумма, руб.</th>
</tr>
{{breakdown_table_rows}}
</table>

<p style="font-weight: bold; margin-top: 12pt;">Итого начислено за период: {{total_rub}} руб.</p>

<p style="margin-top: 14pt; font-size: 10pt;">Начисление за смену = длительность × часовая ставка. Комиссии с аренд и продаж — категориальные бонусы по правилам экипажа. Ставки и формулы: страница экипажа → «Как считаются деньги».</p>

</body>
</html>`;
