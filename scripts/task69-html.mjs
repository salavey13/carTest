// task69-html.mjs — self-contained September 2026 infographic reports for the
// three bikes, one visual family, per-bike accent. Numbers come from
// /tmp/task69-computed.json (real builder output, verified 104/104 by
// task69-reports.mjs independent math).
import { readFileSync, writeFileSync } from "fs";

const dump = JSON.parse(readFileSync("/tmp/task69-computed.json", "utf8"));

const MSK = (iso, withTime = true) => {
  if (!iso) return "—";
  const d = new Date(Date.parse(iso) + 3 * 36e5);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}${withTime ? ` ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : ""}`;
};
const fmt = (n) => `${Math.round(n).toLocaleString("ru-RU").replace(/\u00A0/g, " ")} ₽`;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const STATUS_LABEL = {
  completed: ["Завершена", "#22c55e"],
  active: ["В аренде", "#22c55e"],
  confirmed: ["Подтверждена", "#a78bfa"],
  pending_confirmation: ["Ожидает", "#f59e0b"],
  expired: ["Просрочена", "#ef4444"],
  cancelled: ["Отменена", "#9aa7b8"],
};
const PAY_LABEL = { fully_paid: ["оплачен", "ok"], interest_paid: ["предоплата", "no"], pending: ["не оплачен", "no"] };

function topClients(rows) {
  const map = new Map();
  for (const r of rows) {
    if (r.status !== "completed" || r.total <= 0) continue;
    const name = r.client || "—";
    map.set(name, (map.get(name) || 0) + r.total);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function weekBuckets(rows) {
  const weeks = [0, 0, 0, 0, 0];
  for (const r of rows) {
    if (r.status !== "completed") continue;
    const d = new Date(Date.parse(r.dates) + 3 * 36e5);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.getUTCDate();
    weeks[Math.min(4, Math.floor((day - 1) / 7))] += r.total;
  }
  return weeks;
}

function donut(bike, revenue, bikeSum, gearSum) {
  const C = 2 * Math.PI * 78;
  const bikeFrac = revenue > 0 ? bikeSum / revenue : 0;
  const gearFrac = revenue > 0 ? gearSum / revenue : 0;
  const bikeLen = (C * bikeFrac).toFixed(1);
  const gearLen = (C * gearFrac).toFixed(1);
  const bikePct = (bikeFrac * 100).toFixed(1).replace(".", ",");
  const gearPct = (gearFrac * 100).toFixed(1).replace(".", ",");
  return `
      <div class="panel">
        <h3>Структура выручки — ${fmt(revenue)}</h3>
        <div style="display:flex;justify-content:center"><svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="Донат мото vs экип">
          <circle cx="100" cy="100" r="78" fill="none" stroke="#1b2532" stroke-width="26"/>
          <circle class="arcBike" cx="100" cy="100" r="78" fill="none" stroke="var(--acc)" stroke-width="26"
            stroke-dasharray="0 ${C}" stroke-dashoffset="${(C / 4).toFixed(1)}" transform="rotate(-90 100 100)" data-len="${bikeLen}" data-c="${C}"/>
          <circle class="arcGear" cx="100" cy="100" r="78" fill="none" stroke="var(--blue)" stroke-width="26"
            stroke-dasharray="0 ${C}" stroke-dashoffset="${(C / 4 - C * bikeFrac).toFixed(1)}" transform="rotate(-90 100 100)" data-len="${gearLen}"/>
          <text x="100" y="94" text-anchor="middle" fill="#e8eef6" font-size="22" font-weight="800">${fmt(revenue)}</text>
          <text x="100" y="114" text-anchor="middle" fill="#8fa0b5" font-size="10">сентябрь 2026</text>
        </svg></div>
        <div class="legend">
          <span><i style="background:var(--acc)"></i>Аренда мото — ${fmt(bikeSum)} (${bikePct}%)</span>
          <span><i style="background:var(--blue)"></i>Экипировка — ${fmt(gearSum)} (${gearPct}%)</span>
        </div>
      </div>`;
}

function partnerBars(bike) {
  const { indep, pct, partnerChat } = bike;
  if (!partnerChat) {
    return `
      <div class="panel">
        <h3>Кому какая часть</h3>
        <div class="bars">
          <div class="bar-row"><span class="bar-name">Экипажу — всё</span><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div><span class="bar-val">${fmt(indep.revenue)}</span></div>
          <div class="bar-row"><span class="bar-name">Партнёру</span><div class="bar-track"><div class="bar-fill" style="width:0%"></div></div><span class="bar-val">—</span></div>
        </div>
        <p style="color:var(--muted);font-size:12.5px;margin-top:12px">Байк владельца парка — субаренды нет, доля партнёра не назначена. Вся выручка (и мото, и экип) — экипажу.</p>
      </div>`;
  }
  const crewPart = indep.revenue - indep.partnerSum;
  const pW = indep.revenue > 0 ? Math.round((indep.partnerSum / indep.revenue) * 100) : 0;
  const cW = 100 - pW;
  return `
      <div class="panel">
        <h3>Кому какая часть</h3>
        <div class="bars">
          <div class="bar-row"><span class="bar-name">Партнёру (${pct}% мото)</span><div class="bar-track"><div class="bar-fill" style="width:${pW}%"></div></div><span class="bar-val">${fmt(indep.partnerSum)}</span></div>
          <div class="bar-row"><span class="bar-name">Экипажу</span><div class="bar-track"><div class="bar-fill equip" style="width:${cW}%"></div></div><span class="bar-val">${fmt(crewPart)}</span></div>
        </div>
        <p style="color:var(--muted);font-size:12.5px;margin-top:12px">Партнёр получает <b style="color:var(--text)">${pct}% от мото</b> — экипировка в базу не входит (собственность экипажа). Формула строки: <b style="color:var(--text)">мото × ${pct}%</b>.</p>
      </div>`;
}

function tableRows(bike) {
  return bike.rows.map((r, i) => {
    const [stLabel, stColor] = STATUS_LABEL[r.status] || [r.status, "#9aa7b8"];
    const [payLabel, payCls] = PAY_LABEL[r.payment] || [r.payment || "—", "no"];
    const dates = `${MSK(r.dates)} → ${r.end ? MSK(r.end) : "—"}`;
    const hours = r.end ? (Date.parse(r.end) - Date.parse(r.dates)) / 36e5 : null;
    const dur = hours == null || Number.isNaN(hours) || hours <= 0 ? "—" : hours < 24 ? `${Math.max(1, Math.floor(hours))} ч` : `${Math.max(1, Math.round(hours / 24))} дн`;
    return `<tr>
            <td>${i + 1}</td>
            <td style="white-space:nowrap">${dates}</td>
            <td>${dur}</td>
            <td>${esc(r.client || "—")}</td>
            <td><span class="st"><i style="background:${stColor}"></i>${stLabel}</span></td>
            <td><span class="pill ${payCls}">${payLabel}</span></td>
            <td class="num">${r.bike > 0 ? fmt(r.bike) : "—"}</td>
            <td class="num">${r.gear > 0 ? `${fmt(r.gear)}${r.estimated ? '<span class="tag-est">*</span>' : ""}` : "—"}</td>
            <td class="num">${r.mirror ? "выдача экипа" : r.total > 0 ? fmt(r.total) : "—"}</td>
            ${bike.partnerChat ? `<td class="num" style="color:var(--acc);font-weight:700">${r.partner > 0 ? fmt(r.partner) : "—"}</td>` : ""}
            <td style="white-space:nowrap">${MSK(r.createdAt)}</td>
          </tr>`;
  }).join("\n");
}

function clientBars(bike) {
  const top = topClients(bike.rows);
  if (!top.length) return "";
  const max = top[0][1];
  return top.map(([name, sum]) => `
          <div class="bar-row"><span class="bar-name">${esc(name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round((sum / max) * 100)}%"></div></div><span class="bar-val">${fmt(sum)}</span></div>`).join("");
}

function weekBars(bike) {
  const weeks = weekBuckets(bike.rows);
  const max = Math.max(...weeks, 1);
  const names = ["1–7", "8–14", "15–21", "22–28", "29–30"];
  return weeks.map((v, i) => `
          <div class="bar-row"><span class="bar-name">нед. ${names[i]}</span><div class="bar-track"><div class="bar-fill${i % 2 ? " equip" : ""}" style="width:${Math.round((v / max) * 100)}%"></div></div><span class="bar-val">${v ? fmt(v) : "—"}</span></div>`).join("");
}

function buildHtml(bike) {
  const { indep } = bike;
  const partnerHero = bike.partnerChat
    ? `Партнёр-собственник: <b>${esc(bike.partnerLabel)}</b><br>`
    : `Байк <b>владельца парка</b> — субаренды нет, вся выручка экипажу<br>`;
  const kpis = `
      <div class="kpi"><div class="label">Выручка (завершённые)</div><div class="value" data-count="${indep.revenue}">0 ₽</div><div class="note">${indep.revCount} аренд · из ${indep.rowsCount} строк</div></div>
      <div class="kpi"><div class="label">в т.ч. мото</div><div class="value" data-count="${indep.bikeSum}">0 ₽</div><div class="note">база доли партнёра · ${((indep.bikeSum / indep.revenue) * 100).toFixed(1).replace(".", ",")}%</div></div>
      <div class="kpi blue"><div class="label">в т.ч. экипировка</div><div class="value" data-count="${indep.gearSum}">0 ₽</div><div class="note">шлемы · перчатки · куртка · ${((indep.gearSum / indep.revenue) * 100).toFixed(1).replace(".", ",")}%</div></div>
      ${bike.partnerChat ? `<div class="kpi acc"><div class="label">Партнёру (${bike.pct}% мото)</div><div class="value" data-count="${indep.partnerSum}">0 ₽</div><div class="note">экип в базу не входит</div></div>` : `<div class="kpi acc"><div class="label">Экипажу — всё</div><div class="value" data-count="${indep.revenue}">0 ₽</div><div class="note">доля партнёра: нет</div></div>`}
      <div class="kpi"><div class="label">Средний чек</div><div class="value" data-count="${indep.avg}">0 ₽</div><div class="note">${fmt(indep.revenue)} / ${indep.revCount}</div></div>`;

  const anyEstimated = bike.rows.some((r) => r.estimated);
  const footnote = anyEstimated
    ? `<p class="explain-p"><span class="tag-est">*</span> — экипировка оценена по прайсу за срок аренды (в строке нет сохранённой разбивки мот/экип): меньше суток = половина прайса, далее 1-е сутки полный прайс + половина за каждые следующие.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(bike.label)} — сентябрь 2026 — отчёт по арендам</title>
<style>
  :root{
    --bg:#0b0f14; --card:#121821; --card2:#161e2a; --line:#232e3d;
    --text:#e8eef6; --muted:#8fa0b5; --faint:#5b6b80;
    --green:#22c55e; --amber:#f59e0b; --red:#ef4444; --blue:#38bdf8;
    --acc:${bike.accent}; --acc-dark:${bike.accentDark};
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.5;padding:24px 16px 64px}
  .wrap{max-width:960px;margin:0 auto}
  .hero{background:linear-gradient(135deg,#101a12 0%,#0d1420 60%);border:1px solid var(--line);border-radius:20px;padding:28px 24px;position:relative;overflow:hidden}
  .hero::after{content:'';position:absolute;right:-60px;top:-60px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--acc) 16%,transparent),transparent 70%)}
  .kicker{display:inline-flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);font-weight:700}
  .kicker .dot{width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 12px var(--acc)}
  h1{font-size:clamp(24px,4.5vw,34px);font-weight:800;margin-top:10px;letter-spacing:-.02em}
  .sub{color:var(--muted);margin-top:6px;font-size:14px}
  .sub b{color:var(--text)}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
  .chip{font-size:12px;padding:5px 12px;border-radius:999px;border:1px solid var(--line);color:var(--muted);background:rgba(255,255,255,.02)}
  .chip.on{color:var(--acc);border-color:color-mix(in srgb,var(--acc) 35%,transparent)}
  h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:34px 0 14px;font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px}
  .kpi .label{font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.08em}
  .kpi .value{font-size:26px;font-weight:800;margin-top:6px;font-variant-numeric:tabular-nums}
  .kpi .note{font-size:11px;color:var(--muted);margin-top:4px}
  .kpi.acc .value{color:var(--acc)}
  .kpi.blue .value{color:var(--blue)}
  .panels{display:grid;grid-template-columns:1fr;gap:12px}
  @media(min-width:720px){.panels{grid-template-columns:340px 1fr}}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
  .panel h3{font-size:13px;color:var(--muted);font-weight:600;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{color:var(--faint);font-weight:600;text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);font-size:11px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
  td{padding:9px 10px;border-bottom:1px solid rgba(35,46,61,.55);font-variant-numeric:tabular-nums;vertical-align:top}
  tr:last-child td{border-bottom:none}
  td.num,th.num{text-align:right;white-space:nowrap}
  .st{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
  .st i{width:8px;height:8px;border-radius:50%;display:inline-block}
  .pill{font-size:10px;padding:2px 8px;border-radius:999px;white-space:nowrap}
  .pill.ok{background:rgba(34,197,94,.12);color:var(--green)}
  .pill.no{background:rgba(239,68,68,.10);color:var(--red)}
  .tag-est{color:var(--amber);font-weight:700}
  .scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
  .explain{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
  .formula{background:var(--card2);border:1px dashed color-mix(in srgb,var(--acc) 40%,transparent);border-radius:12px;padding:14px;margin:12px 0;font-size:14px;text-align:center}
  .formula b{color:var(--acc)}
  .explain p{color:var(--muted);font-size:13px;margin-top:8px}
  .explain p b{color:var(--text)}
  .note{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.25);border-radius:12px;padding:12px 14px;font-size:12.5px;color:#d9c79a;margin-top:10px}
  .note b{color:var(--amber)}
  .bars{display:flex;flex-direction:column;gap:9px}
  .bar-row{display:grid;grid-template-columns:130px 1fr 92px;gap:10px;align-items:center;font-size:12px}
  .bar-name{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .bar-track{height:16px;background:var(--card2);border-radius:8px;overflow:hidden;position:relative}
  .bar-fill{height:100%;border-radius:8px;background:linear-gradient(90deg,var(--acc-dark),var(--acc))}
  .bar-fill.equip{background:linear-gradient(90deg,#0e7490,#38bdf8)}
  .bar-val{text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}
  .legend{display:flex;gap:16px;margin-top:12px;font-size:11.5px;color:var(--muted);flex-wrap:wrap}
  .legend span{display:inline-flex;align-items:center;gap:6px}
  .legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
  .foot{margin-top:34px;color:var(--faint);font-size:11.5px;text-align:center;line-height:1.7}
  .foot b{color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">

  <div class="hero">
    <span class="kicker"><span class="dot"></span>Мотопарк · аренды · сентябрь 2026</span>
    <h1>${esc(bike.label)}</h1>
    <p class="sub">${partnerHero}
    Отчёт по арендам байка в парке VIP_BIKE за <b>сентябрь 2026</b> — деньги разделены на мото / экипировку${bike.partnerChat ? " и долю партнёра" : ""}.</p>
    <div class="chips">
      ${bike.partnerChat ? `<span class="chip on">Доля партнёра: ${bike.pct}% от мото</span><span class="chip">Экипировка — собственность экипажа, не делится</span>` : `<span class="chip on">Субаренды нет — вся выручка экипажу</span>`}
      <span class="chip">${indep.rowsCount} строк · ${indep.revCount} завершены</span>
      <span class="chip">всё время: ${indep.allTimeCount} строк · ${fmt(indep.allTimeRevenue)}</span>
    </div>
  </div>

  <h2>Сводка месяца</h2>
  <div class="grid">${kpis}
  </div>

  <h2>Куда уходят деньги клиента</h2>
  <div class="panels">
    ${donut(bike, indep.revenue, indep.bikeSum, indep.gearSum)}
    ${partnerBars(bike)}
  </div>

  <h2>Все аренды месяца</h2>
  <div class="panel scroll">
    <table>
      <thead><tr>
        <th>#</th><th>Даты (МСК)</th><th>Длит.</th><th>Клиент</th><th>Статус</th><th>Оплата</th>
        <th class="num">Мот</th><th class="num">Экип</th><th class="num">Итого</th>${bike.partnerChat ? `<th class="num">Партнёру ${bike.pct}%</th>` : ""}<th>Создана</th>
      </tr></thead>
      <tbody>
${tableRows(bike)}
      </tbody>
    </table>
  </div>

  <h2>Клиенты и ритм месяца</h2>
  <div class="panels">
    <div class="panel">
      <h3>Топ клиентов (завершённые)</h3>
      <div class="bars">${clientBars(bike)}
      </div>
    </div>
    <div class="panel">
      <h3>Выручка по неделям</h3>
      <div class="bars">${weekBars(bike)}
      </div>
    </div>
  </div>

  <h2>Как считано</h2>
  <div class="explain">
    <div class="formula">${bike.partnerChat ? `Партнёру = <b>мото × ${bike.pct}%</b> · экип — мимо базы` : `Выручка = <b>мото + экип</b> · завершённые строки`}</div>
    <p>Разбивка мот/экип берётся из сохранённой цены сделки (metadata bike_price / equipment_price); где её нет — оценка по прайсу за срок аренды, помечена <span class="tag-est">*</span>. Зеркала выдачи экипа деньгами не считаются — деньги живут в основной аренде. Статус «просрочена» = активная аренда с окончанием раньше чем за 24 часа до отчёта.</p>
    ${footnote}
    ${(NOTES[bike.bike] || []).map((n) => `    <p class="note">${n}</p>`).join("\n")}
    <p>Выручка = завершённые + активные. Отменённые строки в деньгах не участвуют. Даты и «создана» — МСК. Цифры идентичны кнопке «Отчёт» на странице байка (тот же генератор, месяц сентябрь 2026).</p>
  </div>

  <div class="foot">
    <b>${esc(bike.label)} · ${esc(bike.bike)} · VIP_BIKE</b><br>
    Сформировано ${MSK(dump.generatedAt)} МСК · месяц сентябрь 2026 · доля по договору ${dump.pct}% (артефактов с другим процентом нет)<br>
    Проверка: генератор кнопки «Отчёт» сверен с независимым пересчётом — ${bike.rows.length} строк, расхождений нет
  </div>
</div>

<script>
  // count-up KPIs
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = Number(el.dataset.count) || 0; const t0 = performance.now(); const dur = 900;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur); const v = Math.round(target * (1 - Math.pow(1 - k, 3)));
      el.textContent = v.toLocaleString('ru-RU').replace(/\\u00A0/g, ' ') + ' ₽';
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // donut arcs
  document.querySelectorAll('.arcBike, .arcGear').forEach(el => {
    const len = Number(el.dataset.len) || 0; const c = Number(el.dataset.c) || 490;
    el.setAttribute('stroke-dasharray', '0 ' + c);
    requestAnimationFrame(() => { el.style.transition = 'stroke-dasharray .9s cubic-bezier(.22,1,.36,1)'; el.setAttribute('stroke-dasharray', len + ' ' + c); });
  });
</script>
</body>
</html>
`;
}

const NOTES = {
  "kawasaki-ex650k": [
    "<b>02.09 — тройное бронирование Наты Зайцевой:</b> три отмены + одна завершённая аренда на тот же период; в деньгах только завершённая (10 000 ₽).",
    "<b>15.09 Скворцов:</b> сумма исправлена владельцем 03.10 — аренда 10 000 ₽ (было записано 15 000 аренда + 15 000 залог; фактически 10 000 + залог 20 000). База партнёра по строке: 5 000 ₽.",
    "<b>24.09 Александр:</b> владелец пересчитал цену голосом (7 750 → 6 000 ₽), разбивки в строке нет — экип оценён каноном (3 ч = полдня: шлем 500 + куртка 250) со «*». Если экип фактически не выдавался — партнёру по строке 3 000 ₽ вместо 2 625 ₽ (правка одной строкой в данных).",
    "<b>29.09 Кирилл:</b> окно аренды 02–03 октября — строка ушла в октябрьский отчёт (скоуп месяца по дате начала аренды, МСК).",
  ],
  "ducati-1199-panigale-2012": [
    "<b>Байк владельца парка</b> — субаренды нет, колонки «Партнёру» нет, вся выручка (мото + экип) остаётся экипажу.",
    "<b>19.09 Мих:</b> флаги экипа в строке пустые — вся сумма 20 000 ₽ идёт в «мото».",
    "<b>21.08 Головин:</b> историческая строка с нулевой суммой — в выручку не попадает (вне сентября).",
  ],
  "ducati-panigale-s-electro-black-aero": [
    "<b>Все 4 строки сентября</b> идут в базу партнёра: строка 12.09 — со снапшотом чата на момент сделки, остальные — фолбэк на текущего партнёра из specs байка.",
    "<b>20.09 и 22.09 Артем/Даниил:</b> экип (перчатки/куртка/шлем) оценён каноном полудня со «*» — сохранённой разбивки в строках нет.",
    "<b>Июль–август:</b> 6 строк на 70 000 ₽ — вне этого отчёта (всё время: 10 строк · 89 250 ₽).",
  ],
};

const OUT_NAMES = {
  "kawasaki-ex650k": "kawasaki-september-2026-report.html",
  "ducati-1199-panigale-2012": "ducati-1199-september-2026-report.html",
  "ducati-panigale-s-electro-black-aero": "ducati-aero-september-2026-report.html",
};

for (const bike of dump.results) {
  const name = OUT_NAMES[bike.bike] || `${bike.bike}-september-2026-report.html`;
  writeFileSync(`/home/z/my-project/download/${name}`, buildHtml(bike), "utf8");
  console.log(`WROTE /home/z/my-project/download/${name}`);
}
console.log("done");
