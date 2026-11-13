"use client";

// /app/comic-book/CineEngine.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CB CINE v9 (task186) — движок «кинематографического комикса», развороты.
//
// v9: Ken Burns на картинках (плавный зум/дрейф вместо steps-idle, только на
// видимом кадре), прогресс автоплея — CSS-transition вместо rAF (60 записей
// стиля в секунду → одна на тик), каскад проявления медленнее (stagger 0.42s,
// ручка PANEL_STAGGER_S), TTL кадра короче (6.2/3.6/9.0s).
//
// Эволюция: v6 — fullscreen-кадры, скролл = камера, порог ≈ пол-экрана,
// следующий кадр накрывает предыдущий (steps-склейка). v6.1 — peek-выезд
// следующего кадра до порога + цепочка проявления. v6.2 — --ink-pace.
// v7 (супер-идея босса) — КОМИКС-СТРАНИЦА:
//  • кадры двух типов: splash (обложка/титры/финал — fullscreen) и row
//    («разворот»: ряд ПОРТРЕТНЫХ панелей — 3 в ряд на PC, 2 на планшете,
//    1 на мобиле); картинки панелей одни и те же для всех раскладок;
//  • мобайл: панели разворота листаются ГОРИЗОНТАЛЬНЫМ свайпом (трек с
//    steps-перекаткой, у пальца край следующей панели выезжает 1:1);
//    у края разворота свайп перекатывается на соседний разворот (кинокадр);
//  • вертикальный скролл/свайп = следующий разворот (как в v6, с peek и
//    лентой-зарядом);
//  • анти-проскас: после каждой склейки кулдаун 550мс — жесты игнорируются
//    БЕЗ очереди, один жест = один кадр (босс: «sometimes scrolling too fast
//    i skip more than one frame»);
//  • АВТОПЛЕЙ: таймер сам ведёт комикс (на мобиле — панель за панелью,
//    на PC — разворот за разворотом; scroll-кадры дольше и автоскроллятся
//    до низа); ЛЮБОЙ ручной жест ставит автоплей на паузу (onAutoInterrupt);
//    прогресс тика рисуется лентой-зарядом в HUD;
//  • проявление v7: НЕ steps-ступени (босс: «8fps reference was mistake»),
//    а плавный каскад — панель за панелью (0.3s сдвиг), внутри панели
//   caption → пузыри → нотификация → SFX, каждый элемент едет ~0.8s
//    ease-out — глаз успевает прочитать каждое появление; темп всей цепочки
//    по-прежнему умножается на --ink-pace из CSS;
//  • клавиатура: ↑/↓/Space/PgUp/PgDn — развороты, ←/→ — панели;
//  • deep-link #hash кадра, no-JS/боты — статичный вебтун (движок спит).
//
// v8 (текущий) — раунд босса после v7:
//  • ВЕРТИКАЛЬ ЕДЕТ ПО ПАНЕЛЯМ: на развороте со скрытыми панелями вертикальный
//    скролл/свайп/↓ сначала листает панели, у края перетекает в соседний кадр
//    («keeping just scrolling down i skipped these horisontal sections»);
//    вместо peek-выезда соседнего кадра пульсирует чип «ещё N» в HUD;
//  • чип «→ ещё N» — всегда видно, что в развороте есть скрытые части
//    (кликабелен), счётчик «панель N/M» теперь на всех раскладках;
//  • ПЕРФ: кадр вынесен в memo-компонент (свайп панели перерисовывает один
//    кадр, а не все 16), will-change только на активных кадрах, decoding=async;
//  • фиксы: .cb-hud__auto не имел pointer-events:auto (кнопка не кликалась —
//    наследовала none от .cb-hud), на мобиле кадры начинаются под мачтой.
// ─────────────────────────────────────────────────────────────────────────────

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CineAccent = "cyan" | "magenta" | "gold";

export type CinePanelDef = {
  key: string;
  num?: string; // бейдж панели (01, II·03, GLITCH...)
  title?: string; // заголовок панели
  accent: CineAccent;
  img?: string;
  alt?: string;
  custom?: "phone"; // вместо картинки — интерактивный телефон (узел в phone)
  phone?: ReactNode; // слот «картинки» для custom-панели
  node: ReactNode; // стопка текста панели (каптион снизу, пузыри выше)
  sfx?: ReactNode; // стикер-восклицание поверх панели
};

export type CineSceneDef = {
  id: string;
  title: string;
  num?: string;
  accent?: CineAccent;
  sound?: string;
  // splash — fullscreen-кадр (обложка, титры, финал, тизер):
  img?: string;
  alt?: string;
  contain?: boolean;
  chrome?: boolean; // рисовать номер+заголовок кадра
  overlay?: ReactNode;
  node?: ReactNode;
  shake?: boolean;
  glitch?: boolean;
  // row — разворот из портретных панелей:
  panels?: CinePanelDef[];
  // scroll — fullscreen-кадр с внутренним скроллом (счёт, Ведомость...):
  scrollable?: boolean;
};

// синхронно с CSS-переменными анимации (steps(8), 1050ms — v6.2 медленный кадр)
const TRANS_MS = 1050;
const RM_MS = 220;
const COOLDOWN_MS = 550; // анти-проскас: тишина после каждой склейки

// v9: сдвиг каскада между панелями разворота (движок ставит --pd картинке,
// ComicBookClient сдвигает на ту же цифру стопку текста). Одна ручка на оба
// файла — рассинхрон невозможен.
export const PANEL_STAGGER_S = 0.42;

// v9: TTL кадра в автоплее (босс: «shorten per section ttl») + лента-заряд
// рисуется CSS-transition'ом — rAF-цикл 60fps больше не нужен.
const AUTO_MS = { base: 6200, panel: 3600, scroll: 9000, scrollRide: 6600 };

// ── v8-перф: кадр вынесен в memo-компонент ──────────────────────────────────
// Свайп панели / смена кадра перерисовывает только затронутые кадры, а не все
// 16 (каждый кадр — сто+ узлов; на мобиле это была главная причина джанка).
// Классы cb-scene--cur/--in/--under по-прежнему ведёт DOM (prune/go) — здесь
// только статика кадра и --pidx его трека.
const SceneView = memo(function SceneView({
  s,
  i,
  pidxFor,
  eager,
}: {
  s: CineSceneDef;
  i: number;
  pidxFor: number;
  eager: boolean;
}) {
  return (
    <section
      data-scene={s.id}
      data-title={s.title}
      className={[
        "cb-scene",
        s.kind === "row" ? "cb-scene--row" : "cb-scene--full",
        s.kind === "scroll" ? "cb-scene--scroll" : "",
        `cb-scene--${s.accent ?? "cyan"}`,
        s.img ? "" : "cb-scene--nopic",
        s.contain ? "cb-scene--contain" : "",
        s.shake ? "cb-scene--shake" : "",
        s.glitch ? "cb-scene--glitch" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={s.title}
      {...(s.scrollable ? { "data-cb-scroll": "" } : {})}
    >
      {s.kind === "row" ? (
        <div className="cb-spread">
          <div className="cb-spread__track" style={{ ["--pidx" as string]: String(pidxFor) }}>
            {(s.panels ?? []).map((p, k) => (
              <figure
                key={p.key}
                className={`cb-panel cb-panel--${p.accent}`}
                style={{ ["--pd" as string]: `${(k * PANEL_STAGGER_S).toFixed(2)}s` }}
              >
                {p.custom === "phone" && p.phone ? (
                  <div className="cb-panel__custom">{p.phone}</div>
                ) : (
                  p.img && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      className="cb-panel__img"
                      src={p.img}
                      alt={p.alt ?? ""}
                      loading={eager ? undefined : "lazy"}
                      decoding="async"
                      draggable={false}
                    />
                  )
                )}
                <span className="cb-panel__scrim" aria-hidden="true" />
                <span className="cb-panel__num" aria-hidden="true">
                  {p.num ?? p.key}
                </span>
                {p.title && <b className="cb-panel__title">{p.title}</b>}
                {p.sfx}
                <div className="cb-panel__text">{p.node}</div>
              </figure>
            ))}
          </div>
        </div>
      ) : (
        <>
          {s.img && (
            <>
              <div
                className="cb-scene__blur"
                style={{ backgroundImage: `url(${s.img})` }}
                aria-hidden="true"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="cb-scene__img"
                src={s.img}
                alt={s.alt ?? ""}
                {...(eager
                  ? { fetchPriority: "high" as const }
                  : { loading: "lazy" as const })}
                decoding="async"
                draggable={false}
              />
            </>
          )}
          <div className="cb-scene__scrim" aria-hidden="true" />
          {s.overlay}
          {s.chrome !== false && (
            <>
              <span className="cb-scene__num" aria-hidden="true">
                {s.num ?? String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="cb-scene__title">{s.title}</h2>
            </>
          )}
          <div className="cb-scene__text">{s.node}</div>
        </>
      )}
    </section>
  );
});

export default function CineEngine({
  scenes,
  active,
  reduceMotion,
  onSceneShown,
  restartRef,
  auto,
  onAutoToggle,
  onAutoInterrupt,
  onAutoEnd,
}: {
  scenes: CineSceneDef[];
  active: boolean;
  reduceMotion: boolean;
  onSceneShown?: (index: number) => void;
  restartRef?: { current: (() => void) | null };
  auto: boolean; // автоплей включён (кнопка/звук)
  onAutoToggle?: () => void; // клик по кнопке ⏸/▶ в HUD
  onAutoInterrupt?: () => void; // ручной жест — пауза автоплея
  onAutoEnd?: () => void; // автоплей дошёл до конца
}) {
  const [idx, setIdx] = useState(0);
  const [pidx, setPidx] = useState(0);
  const [moved, setMoved] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [mid, setMid] = useState(false); // 861–1099px — две панели в ряд
  const stageRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);
  const pidxRef = useRef(0);
  const lockRef = useRef(false);
  const coolRef = useRef(0); // until-timestamp кулдауна анти-проскаса
  const accRef = useRef(0); // накопитель вертикального жеста
  const hAccRef = useRef(0); // накопитель горизонтального жеста (тачпад dx)
  const touchRef = useRef<{
    x: number;
    y: number;
    axis: "x" | "y" | null;
    axisData?: number; // для горизонтали — текущий px-офсет трека
    lastX?: number; // последний clientX жеста (для решения на touchend)
    scrollEl: HTMLElement | null;
    used: boolean; // жест уже привёл к склейке — до touchend тишина
  } | null>(null);
  const tapeRef = useRef<HTMLDivElement | null>(null);
  const idleRef = useRef<number | null>(null);
  const peekRef = useRef<{ dir: 1 | -1; px: number } | null>(null);
  const rmRef = useRef(reduceMotion);
  const shownRef = useRef(onSceneShown);
  const scenesRef = useRef(scenes);
  const narrowRef = useRef(false);
  const autoRef = useRef(auto);
  useEffect(() => {
    rmRef.current = reduceMotion;
    shownRef.current = onSceneShown;
    scenesRef.current = scenes;
    autoRef.current = auto;
  });
  useEffect(() => {
    narrowRef.current = narrow;
  }, [narrow]);

  // мобайл < 861px — панели по одной (горизонтальная навигация активна)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // планшет 861–1099px — --cb-vis: 2 (для чипа «ещё N» и счётчика панелей)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1099px)");
    const apply = () => setMid(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const visiblePanels = useCallback((s: CineSceneDef | undefined) => {
    if (!s || s.kind !== "row") return 1;
    return narrowRef.current ? 1 : Math.min(s.panels?.length ?? 1, window.innerWidth < 1100 ? 2 : 3);
  }, []);

  // вне окна [i-1, i+1] кадры скрываются (DOM-атрибут hidden) — экономим
  // память и не даём сотням оверлеев одновременно слушать IO
  const prune = useCallback((i: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    Array.from(stage.children).forEach((el, k) => {
      const node = el as HTMLElement;
      node.hidden = k < i - 1 || k > i + 1;
      node.style.removeProperty("--peek-start");
      node.style.removeProperty("--cb-pull");
      node.classList.toggle("cb-scene--cur", k === i);
      node.classList.remove(
        "cb-scene--in",
        "cb-scene--from-b",
        "cb-scene--from-t",
        "cb-scene--under",
      );
      const track = node.querySelector<HTMLElement>(".cb-spread__track");
      if (track) track.style.transform = "";
    });
  }, []);

  // ── v6.1 peek (вертикаль): жест вытягивает край следующего кадра ─────────
  const resetPeek = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const i = idxRef.current;
    [i - 1, i + 1].forEach((k) => {
      const el = stage.children[k] as HTMLElement | undefined;
      if (!el) return;
      el.classList.remove("cb-scene--peek");
      el.style.transform = "";
    });
    (stage.children[i] as HTMLElement | undefined)?.style.removeProperty("--cb-pull");
    if (tapeRef.current) tapeRef.current.style.transform = "scaleX(0)";
    peekRef.current = null;
  }, []);

  const showPeek = useCallback(
    (dir: 1 | -1, ratio: number, px?: number) => {
      if (lockRef.current) return; // во время склейки не трогаем
      const stage = stageRef.current;
      if (!stage) return;
      const i = idxRef.current;
      const targetIdx = i + dir;
      if (targetIdx < 0 || targetIdx >= scenesRef.current.length) {
        resetPeek(); // дальше кадров нет — заряд уходит в ноль
        return;
      }
      const r = Math.max(0, Math.min(1, ratio));
      const maxPeek = Math.round(Math.min(window.innerHeight * 0.16, 130));
      const p = Math.max(2, Math.min(maxPeek, Math.round(px ?? r * maxPeek)));
      [i - 1, i + 1].forEach((k) => {
        if (k === targetIdx) return;
        const el = stage.children[k] as HTMLElement | undefined;
        if (!el) return;
        el.classList.remove("cb-scene--peek");
        el.style.transform = "";
      });
      const el = stage.children[targetIdx] as HTMLElement | undefined;
      if (el) {
        if (el.hidden) el.hidden = false;
        el.classList.add("cb-scene--peek");
        el.style.transform =
          dir === 1
            ? `translateY(calc(100% - ${p}px))`
            : `translateY(calc(-100% + ${p}px))`;
        peekRef.current = { dir, px: p };
      }
      (stage.children[i] as HTMLElement | undefined)?.style.setProperty(
        "--cb-pull",
        (1 - r * 0.035).toFixed(4),
      );
      // лента-заряд: scaleX вместо width — композитная операция, без layout
      if (tapeRef.current) {
        tapeRef.current.style.transition = "transform 0.18s linear";
        tapeRef.current.style.transform = `scaleX(${r.toFixed(3)})`;
      }
    },
    [resetPeek],
  );

  // жест затих — край кадра уезжает обратно в ступенчатом темпе
  const idleReset = useCallback(() => {
    if (idleRef.current) window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => {
      idleRef.current = null;
      resetPeek();
    }, 260);
  }, [resetPeek]);

  const cooldown = useCallback(() => {
    coolRef.current = Date.now() + COOLDOWN_MS;
  }, []);
  const inCooldown = useCallback(() => Date.now() < coolRef.current, []);

  // ── смена кадра (вертикаль) ───────────────────────────────────────────────
  const go = useCallback(
    (next: number, opts?: { force?: boolean }) => {
      const total = scenesRef.current.length;
      const cur = idxRef.current;
      const target = Math.max(0, Math.min(total - 1, next));
      if (target === cur) {
        accRef.current = 0;
        return;
      }
      if (!opts?.force && (lockRef.current || inCooldown())) return; // анти-проскас: без очереди
      if (lockRef.current && !opts?.force) return;
      lockRef.current = true;
      cooldown();
      const dir: 1 | -1 = target > cur ? 1 : -1;
      const stage = stageRef.current;
      const from = stage?.children[cur] as HTMLElement | undefined;
      const to = stage?.children[target] as HTMLElement | undefined;
      idxRef.current = target;
      pidxRef.current = 0;
      setIdx(target);
      setPidx(0);
      setMoved(true);
      if (from && to) {
        const ps = peekRef.current;
        const fromPeek = ps && ps.dir === dir && target === cur + dir ? ps.px : null;
        peekRef.current = null;
        to.style.setProperty(
          "--peek-start",
          fromPeek != null
            ? dir === 1
              ? `calc(100% - ${fromPeek}px)`
              : `calc(-100% + ${fromPeek}px)`
            : dir === 1
              ? "102%"
              : "-102%",
        );
        to.style.transform = "";
        to.classList.remove("cb-scene--peek");
        from.classList.remove("cb-scene--cur", "cb-scene--under");
        to.classList.remove("cb-scene--in", "cb-scene--from-b", "cb-scene--from-t");
        void to.offsetWidth; // перезапуск анимации, если кадр уже играл
        to.classList.add("cb-scene--in", dir === 1 ? "cb-scene--from-b" : "cb-scene--from-t");
        from.classList.add("cb-scene--under");
        to.classList.add("cb-scene--cur");
        to.hidden = false;
        const text = to.querySelector<HTMLElement>(".cb-scene__text");
        if (text) text.scrollTop = 0;
      }
      shownRef.current?.(target);
      try {
        window.history.replaceState(null, "", `#${scenesRef.current[target].id}`);
      } catch {
        /* приватный режим — hash не критичен */
      }
      window.setTimeout(
        () => {
          lockRef.current = false;
          prune(idxRef.current);
        },
        rmRef.current ? RM_MS + 40 : TRANS_MS + 40,
      );
    },
    [cooldown, inCooldown, prune],
  );

  // ── v8: вертикальный жест на развороте со скрытыми панелями ───────────────
  // Пока в направлении жеста есть скрытые панели — вертикаль листает ПАНЕЛИ
  // (rowStep=true), у края разворота перетекает в соседний кадр (как раньше).
  const rowStep = useCallback(
    (dir: 1 | -1): boolean => {
      const s = scenesRef.current[idxRef.current];
      if (!s || s.kind !== "row") return false;
      const total = s.panels?.length ?? 0;
      const vis = visiblePanels(s);
      if (total <= vis) return false;
      return dir === 1 ? pidxRef.current + vis < total : pidxRef.current > 0;
    },
    [visiblePanels],
  );

  const chipRef = useRef<HTMLButtonElement | null>(null);
  // вместо peek-выезда соседнего кадра — пульс чипа «ещё N» (жест «что-то делает»)
  const nudgeChip = useCallback(() => {
    chipRef.current?.animate(
      [
        { transform: "translateY(-50%) scale(1)" },
        { transform: "translateY(-50%) scale(1.22)" },
        { transform: "translateY(-50%) scale(1)" },
      ],
      { duration: 380, easing: "ease-out" },
    );
  }, []);

  // ── смена панели внутри разворота (горизонталь, мобайл/планшет) ───────────
  const goPanel = useCallback(
    (delta: 1 | -1, opts?: { force?: boolean }) => {
      const s = scenesRef.current[idxRef.current];
      const total = s?.panels?.length ?? 0;
      if (!s || s.kind !== "row" || total <= 1) {
        // панелей нет — горизонталь у края перетекает в соседний кадр
        go(idxRef.current + delta, opts);
        return;
      }
      const vis = visiblePanels(s);
      const next = pidxRef.current + delta;
      if (next >= 0 && next + vis <= total && next !== pidxRef.current) {
        if (!opts?.force && (lockRef.current || inCooldown())) return;
        lockRef.current = true;
        cooldown();
        pidxRef.current = next;
        setPidx(next);
        // сброс инлайн-офсета пальца — дальше ведёт CSS (--pidx + steps)
        const track = stageRef.current
          ?.children[idxRef.current]
          ?.querySelector<HTMLElement>(".cb-spread__track");
        if (track) track.style.transform = "";
        window.setTimeout(
          () => {
            lockRef.current = false;
          },
          rmRef.current ? RM_MS + 40 : 460,
        );
        return;
      }
      // у края панели — перетекаем на соседний разворот (кинокадр)
      if (next < 0 || next + vis > total) go(idxRef.current + delta, opts);
    },
    [go, inCooldown, cooldown, visiblePanels],
  );

  // v6.1: кнопка «перечитать с обложки» в последнем кадре → go(0)
  useEffect(() => {
    if (!restartRef) return;
    restartRef.current = () => {
      pidxRef.current = 0;
      setPidx(0);
      go(0, { force: true });
    };
    return () => {
      restartRef.current = null;
    };
  }, [restartRef, go]);

  // внутренний вертикальный скролл (счёт, Ведомость, UNIVERSE) живёт своей
  // жизнью: сцена не переключается, пока он не упёрся в край
  const canScrollY = (el: HTMLElement | null, dy: number) => {
    if (!el || el.scrollHeight <= el.clientHeight + 1) return false;
    return dy > 0
      ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
      : el.scrollTop > 0;
  };

  // ── колесо / тачпад: вертикаль = кадры, горизонталь = панели ─────────────
  useEffect(() => {
    if (!active) return;
    const stage = stageRef.current;
    if (!stage) return;

    const manual = () => {
      if (autoRef.current) onAutoInterrupt?.();
    };

    const onWheel = (e: WheelEvent) => {
      const t = e.target as Element | null;
      const sc = t?.closest?.("[data-cb-scroll], .cb-scene__text") as HTMLElement | null;
      const dx = e.deltaMode === 1 ? e.deltaX * 24 : e.deltaX;
      const dyRaw = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      // горизонталь (тачпад dx / shift+wheel): доминирует над вертикалью
      if (Math.abs(dx) > Math.abs(dyRaw) * 1.2 && Math.abs(dx) > 12) {
        if (canScrollY(sc, dyRaw)) return;
        e.preventDefault();
        manual();
        hAccRef.current += dx;
        const th = 140;
        const ratio = Math.min(1, Math.abs(hAccRef.current) / th);
        if (ratio > 0.05) idleReset();
        if (Math.abs(hAccRef.current) >= th || Math.abs(dx) >= 60) {
          goPanel(hAccRef.current > 0 ? 1 : -1);
          hAccRef.current = 0;
        }
        return;
      }
      hAccRef.current = 0;
      if (canScrollY(sc, dyRaw)) return; // внутри скроллимого блока — native
      e.preventDefault();
      manual();
      const dy = dyRaw;
      accRef.current += dy;
      const th = Math.min(480, Math.max(240, window.innerHeight * 0.5));
      const ratio = Math.min(1, Math.abs(accRef.current) / th);
      if (ratio > 0.04) {
        // v8: на развороте со скрытыми панелями peek не показывает соседний
        // кадр (вертикаль поедет по панелям) — пульсирует чип «ещё N»
        const dir: 1 | -1 = accRef.current >= 0 ? 1 : -1;
        if (rowStep(dir)) nudgeChip();
        else showPeek(dir, ratio);
        idleReset();
      }
      if (Math.abs(e.deltaY) >= 150 || Math.abs(accRef.current) >= th) {
        const dir: 1 | -1 = (Math.abs(e.deltaY) >= 150 ? e.deltaY : accRef.current) > 0 ? 1 : -1;
        if (rowStep(dir)) {
          goPanel(dir); // v8: вертикаль листает панели разворота
        } else {
          go(idxRef.current + dir);
        }
        accRef.current = 0;
        resetPeek();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.target as Element | null;
      const sc = t?.closest?.("[data-cb-scroll], .cb-scene__text") as HTMLElement | null;
      touchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        axis: null,
        scrollEl: sc,
        used: false,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const st = touchRef.current;
      if (!st || st.used) return;
      const dx = e.touches[0].clientX - st.x;
      const dy = st.y - e.touches[0].clientY;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (!st.axis) st.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      if (st.axis === "y") {
        if (canScrollY(st.scrollEl, dy)) return;
        e.preventDefault();
        manual();
        const dir: 1 | -1 = dy > 0 ? 1 : -1;
        if (Math.abs(dy) < 64) {
          if (rowStep(dir)) nudgeChip(); // v8: на развороте — пульс чипа вместо peek
          else showPeek(dir, Math.abs(dy) / 64, Math.round(Math.abs(dy) * 1.6));
          idleReset();
          return;
        }
        if (rowStep(dir)) {
          goPanel(dir); // v8: свайп вниз листает панели разворота
        } else {
          go(idxRef.current + dir);
        }
        st.used = true; // один свайп — один шаг (анти-проскас)
        resetPeek();
        return;
      }
      // горизонталь: панели разворота
      const s = scenesRef.current[idxRef.current];
      const total = s?.panels?.length ?? 0;
      const vis = visiblePanels(s);
      if (s?.kind !== "row" || total <= vis) return; // листать нечего
      e.preventDefault();
      manual();
      const step = (stage.clientWidth || window.innerWidth) / vis;
      const track = stage
        .children[idxRef.current]
        ?.querySelector<HTMLElement>(".cb-spread__track");
      if (!track) return;
      const base = -(pidxRef.current * step);
      // палец тянет контент за собой: свайп влево (dx<0) уводит трек влево
      const off = Math.max(-step * (total - vis), Math.min(0, base + dx));
      track.style.transform = `translate3d(${off}px,0,0)`;
      st.axisData = off;
      st.lastX = e.touches[0].clientX;
      idleReset();
    };

    const onTouchEnd = () => {
      const st = touchRef.current;
      touchRef.current = null;
      if (st?.axis === "x" && st.lastX !== undefined) {
        const s = scenesRef.current[idxRef.current];
        const total = s?.panels?.length ?? 0;
        const vis = visiblePanels(s);
        const step = (stage.clientWidth || window.innerWidth) / vis;
        // решение по сырому свайпу пальца — у края панели трек зажат,
        // но жест всё равно должен перекатывать на соседний разворот
        const dxTotal = st.lastX - st.x;
        const delta = dxTotal < -step * 0.22 ? 1 : dxTotal > step * 0.22 ? -1 : 0;
        if (delta !== 0) {
          const next = pidxRef.current + delta;
          if (next >= 0 && next + vis <= total) {
            manual();
            goPanel(delta);
          } else {
            manual();
            go(idxRef.current + delta);
          }
        } else {
          // возврат панели на место
          const track = stage
            .children[idxRef.current]
            ?.querySelector<HTMLElement>(".cb-spread__track");
          if (track) track.style.transform = "";
        }
      }
      idleReset();
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      if (idleRef.current) window.clearTimeout(idleRef.current);
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
    };
  }, [active, go, goPanel, showPeek, resetPeek, idleReset, visiblePanels, rowStep, nudgeChip]);

  // ── клавиатура: ↑↓ развороты, ←→ панели ───────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName)) return;
      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
        case " ":
          e.preventDefault();
          if (autoRef.current) onAutoInterrupt?.();
          if (rowStep(1)) goPanel(1); // v8: ↓ едет по панелям разворота
          else go(idxRef.current + 1);
          break;
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          if (autoRef.current) onAutoInterrupt?.();
          if (rowStep(-1)) goPanel(-1);
          else go(idxRef.current - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (autoRef.current) onAutoInterrupt?.();
          goPanel(1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (autoRef.current) onAutoInterrupt?.();
          goPanel(-1);
          break;
        case "Home":
          e.preventDefault();
          go(0, { force: true });
          break;
        case "End":
          e.preventDefault();
          go(scenesRef.current.length - 1, { force: true });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go, goPanel, onAutoInterrupt, rowStep]);

  // ── активация: прыжок по #hash, prune окна, лок скролла body ────────────
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const hash = window.location.hash.replace("#", "");
    const h = scenesRef.current.findIndex((s) => s.id === hash);
    if (h > 0) {
      idxRef.current = h;
      setIdx(h);
      setMoved(true);
      start = h;
    }
    prune(start);
    document.body.classList.add("cb-cine-lock");
    return () => document.body.classList.remove("cb-cine-lock");
  }, [active, prune]);

  // предзагрузка пары следующих кадров — склейка без белых вспышек
  useEffect(() => {
    if (!active) return;
    const collect = (s?: CineSceneDef) => [s?.img, ...(s?.panels ?? []).map((p) => p.img)];
    for (const s of [scenesRef.current[idx + 1], scenesRef.current[idx + 2]]) {
      for (const src of collect(s)) {
        if (src) {
          const im = new window.Image();
          im.src = src;
        }
      }
    }
  }, [active, idx]);

  // ── АВТОПЛЕЙ: таймер ведёт комикс; лента-заряд = прогресс тика ───────────
  useEffect(() => {
    if (!active || !auto) {
      if (tapeRef.current) tapeRef.current.style.transform = "scaleX(0)";
      return;
    }
    let timer = 0;
    let alive = true;
    // v9: лента через CSS-transition transform'а — одна запись стиля на тик
    // вместо rAF 60fps (transform = только композит, без layout/paint)
    const tapeTo = (r: number, dur?: number) => {
      const el = tapeRef.current;
      if (!el) return;
      el.style.transition = dur ? `transform ${dur}ms linear` : "none";
      el.style.transform = `scaleX(${r})`;
    };
    const tickDur = () => {
      const s = scenesRef.current[idxRef.current];
      if (s?.scrollable) return AUTO_MS.scroll;
      if (s?.kind === "row") {
        // v8: на любой раскладке тик короче, пока в развороте есть скрытые панели
        const vis = visiblePanels(s);
        const total = s.panels?.length ?? 1;
        if (total > vis && pidxRef.current + vis < total) return AUTO_MS.panel;
      }
      return AUTO_MS.base;
    };
    const advance = () => {
      const s = scenesRef.current[idxRef.current];
      const last = idxRef.current >= scenesRef.current.length - 1;
      if (last) {
        onAutoEnd?.();
        return;
      }
      if (s?.kind === "row") {
        // v8: автоплей едет панель за панелью на всех раскладках
        const vis = visiblePanels(s);
        const total = s.panels?.length ?? 1;
        if (total > vis && pidxRef.current + vis < total) {
          goPanel(1, { force: true });
          return;
        }
      }
      go(idxRef.current + 1, { force: true });
    };
    const loop = () => {
      if (!alive) return;
      const dur = tickDur();
      tapeTo(0);
      void tapeRef.current?.offsetWidth; // рефлоу: сброс до старта transition
      tapeTo(1, dur);
      timer = window.setTimeout(() => {
        if (!alive) return;
        advance();
        if (alive && idxRef.current < scenesRef.current.length - 1) loop();
      }, dur);
    };
    loop();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      tapeTo(0);
    };
  }, [active, auto, idx, pidx, go, goPanel, onAutoEnd, visiblePanels]);

  // scroll-кадры при автоплее плавно едут до низа
  useEffect(() => {
    if (!active || !auto) return;
    const s = scenesRef.current[idx];
    if (!s?.scrollable) return;
    const stage = stageRef.current;
    const el = stage?.children[idx]?.querySelector<HTMLElement>(".cb-scene__text");
    if (!el) return;
    el.scrollTop = 0;
    const dur = AUTO_MS.scrollRide;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const r = Math.min(1, (t - t0) / dur);
      el.scrollTop = (el.scrollHeight - el.clientHeight) * r;
      if (r < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, auto, idx]);

  const cur = scenes[idx] ?? scenes[0];
  // v8: сколько панелей текущего разворота ещё скрыто (для чипа и счётчика)
  const visNow = narrow ? 1 : mid ? 2 : 3;
  const curPanels = cur?.kind === "row" ? cur.panels?.length ?? 0 : 0;
  const morePanels = Math.max(0, curPanels - pidx - visNow);

  return (
    <div
      className={`cb-cine${active ? " cb-cine--on" : ""}${reduceMotion ? " cb-cine--rm" : ""}`}
    >
      <div className="cb-cine__stage" ref={stageRef}>
        {scenes.map((s, i) => (
          <SceneView
            key={s.id}
            s={s}
            i={i}
            pidxFor={i === idx ? pidx : 0}
            eager={i < 2}
          />
        ))}
      </div>

      {active && (
        <div className="cb-hud">
          <div className="cb-hud__rail" aria-label="Рейка кадров">
            {scenes.map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <button
                key={s.id}
                type="button"
                className={`cb-hud__dot${i === idx ? " is-here" : ""}${s.panels ? " cb-hud__dot--row" : ""}`}
                title={`Кадр ${i + 1} · ${s.title}`}
                aria-label={`Кадр ${i + 1}: ${s.title}`}
                aria-current={i === idx ? "true" : undefined}
                onClick={() => {
                  if (autoRef.current) onAutoInterrupt?.();
                  go(i, { force: true });
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className={`cb-hud__auto${auto ? " is-on" : ""}`}
            onClick={() => onAutoToggle?.()}
            aria-pressed={auto}
            title={auto ? "Пауза автоплея" : "Автоплей"}
          >
            {auto ? "⏸" : "▶"}
            <span>авто</span>
          </button>
          <div className="cb-hud__count" role="status">
            <b>{String(idx + 1).padStart(2, "0")}</b>
            <span>/ {String(scenes.length).padStart(2, "0")}</span>
            <i>
              {cur?.num ? `${cur.num} · ` : ""}
              {cur?.title}
              {cur?.kind === "row" && curPanels > visNow
                ? ` · панель ${pidx + 1}/${curPanels}`
                : ""}
            </i>
          </div>
          {/* v8: чип «ещё N» — в развороте есть скрытые части; вертикаль их едет */}
          {morePanels > 0 && (
            <button
              type="button"
              className="cb-hud__more"
              ref={chipRef}
              onClick={() => {
                if (autoRef.current) onAutoInterrupt?.();
                goPanel(1);
              }}
              title="В развороте ещё есть части — вертикальный скролл листает их"
            >
              <i>→</i>
              <span>ещё {morePanels}</span>
            </button>
          )}
          {!moved && (
            <div className="cb-hud__hint" aria-hidden="true">
              <span>СКРОЛЛ = КАМЕРА</span>
              <i>
                {narrow
                  ? "свайп вбок — панели · скролл — следующий кадр"
                  : "крути до упора — следующий кадр уже выезжает"}
              </i>
            </div>
          )}
          {/* лента-заряд: жест до порога / прогресс автоплея */}
          <div className="cb-hud__tape" ref={tapeRef} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
