"use client";

// /app/comic-book/CineEngine.tsx
// ─────────────────────────────────────────────────────────────────────────────
// CB CINE v6 (task186) — движок «кинематографического комикса».
//
// Босс: «we are kinda creating new media type, between comics and video —
// scrolling should feel like "moving pictures that look like 8fps anime";
// each next section on top of previous; sections adaptive and fullscreen
// (PC landscape / mobile fullscreen portrait); while scrolling not actually
// scroll, but after threshold roughly equal to screen height switch section».
//
// Как это работает:
//  • сцены (кадры) — fullscreen-секции; в режиме cine СТРАНИЦА НЕ СКРОЛЛИТСЯ:
//    колесо/тач копятся в виртуальную позицию, и когда набегает порог
//    (~пол-экрана, «roughly screen height» по жесту) — следующий кадр
//    НАКРЫВАЕТ предыдущий (translateY 100%→0);
//  • переход — CSS steps(8, end): 8 дискретных кадров ≈ 8fps аниме;
//    предыдущий кадр под ним отъезжает камерой (scale 1→0.92, затемнение);
//  • каждый кадр «живой»: фон медленно зумится/панорамирует с steps(8)
//    (moving pictures); reduce-motion → резкая склейка без зума;
//  • сцены с контентом выше экрана (Ведомость, UNIVERSE, счёт) помечены
//    scrollable — внутри кадра скроллится контент, сцена не переключается,
//    пока внутренний скролл не упрётся в край;
//  • HUD: рейка кадров справа (кликабельна), счётчик «КАДР 03/26» с титром,
//    подсказка «СКРОЛЛ = КАМЕРА» до первого жеста;
//  • deep-link: каждый кадр пишет свой #hash (history.replaceState), на входе
//    прыжок в кадр из hash; no-JS / боты / скриншотеры: движок спит, сцены
//    лежат обычной стопкой (статичный вебтун) — весь контент виден.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type CineSceneDef = {
  id: string;
  title: string;
  num?: string;
  img?: string;
  alt?: string;
  accent?: "cyan" | "magenta" | "gold";
  contain?: boolean; // картинка ~1:1 (обложка) — вписать, а не обрезать
  scrollable?: boolean; // внутри кадра скроллится контент
  shake?: boolean; // тряска кадра (II·05)
  glitch?: boolean; // скан-линии поверх кадра
  sound?: string; // SFX при показе кадра
  chrome?: boolean; // титры кадра (номер + заголовок); false — узел рисует своё
  node: ReactNode; // текстовый слой (титры, пузыри, кастомные блоки)
};

// синхронно с CSS-переменными анимации (steps(8), 700ms)
const TRANS_MS = 700;
const RM_MS = 220;

export default function CineEngine({
  scenes,
  active,
  reduceMotion,
  onSceneShown,
}: {
  scenes: CineSceneDef[];
  active: boolean;
  reduceMotion: boolean;
  onSceneShown?: (index: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [moved, setMoved] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);
  const lockRef = useRef(false);
  const accRef = useRef(0);
  const pendRef = useRef<0 | 1 | -1>(0);
  const touchRef = useRef<{ y: number; scrollEl: HTMLElement | null } | null>(null);
  const rmRef = useRef(reduceMotion);
  const shownRef = useRef(onSceneShown);
  const scenesRef = useRef(scenes);
  useEffect(() => {
    rmRef.current = reduceMotion;
    shownRef.current = onSceneShown;
    scenesRef.current = scenes;
  });

  // вне окна [i-1, i+1] кадры скрываются (DOM-атрибут hidden) — экономим
  // память и не даём сотням оверлеев одновременно слушать IO
  const prune = useCallback((i: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    Array.from(stage.children).forEach((el, k) => {
      const node = el as HTMLElement;
      node.hidden = k < i - 1 || k > i + 1;
      node.classList.toggle("cb-scene--cur", k === i);
      node.classList.remove(
        "cb-scene--in",
        "cb-scene--from-b",
        "cb-scene--from-t",
        "cb-scene--under",
      );
    });
  }, []);

  const go = useCallback(
    (next: number) => {
      const total = scenesRef.current.length;
      const cur = idxRef.current;
      const target = Math.max(0, Math.min(total - 1, next));
      if (target === cur) {
        accRef.current = 0;
        return;
      }
      if (lockRef.current) {
        pendRef.current = target > cur ? 1 : -1;
        return;
      }
      lockRef.current = true;
      const dir: 1 | -1 = target > cur ? 1 : -1;
      const stage = stageRef.current;
      const from = stage?.children[cur] as HTMLElement | undefined;
      const to = stage?.children[target] as HTMLElement | undefined;
      idxRef.current = target;
      setIdx(target);
      setMoved(true);
      if (from && to) {
        from.classList.remove("cb-scene--cur", "cb-scene--under");
        to.classList.remove("cb-scene--in", "cb-scene--from-b", "cb-scene--from-t");
        void to.offsetWidth; // перезапуск анимации, если кадр уже играл
        to.classList.add("cb-scene--in", dir === 1 ? "cb-scene--from-b" : "cb-scene--from-t");
        from.classList.add("cb-scene--under");
        to.classList.add("cb-scene--cur");
        to.hidden = false;
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
          const p = pendRef.current;
          pendRef.current = 0;
          if (p !== 0) go(idxRef.current + p);
        },
        rmRef.current ? RM_MS + 40 : TRANS_MS + 40,
      );
    },
    [prune],
  );

  // внутренний вертикальный скролл (Ведомость, UNIVERSE, счёт) живёт своей
  // жизнью: сцена не переключается, пока он не упёрся в край
  const canScrollY = (el: HTMLElement | null, dy: number) => {
    if (!el || el.scrollHeight <= el.clientHeight + 1) return false;
    return dy > 0
      ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
      : el.scrollTop > 0;
  };

  // ── колесо / тачпад: виртуальная лента кадра ─────────────────────────────
  useEffect(() => {
    if (!active) return;
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      const t = e.target as Element | null;
      const sc = t?.closest?.("[data-cb-scroll], .cb-scene__text") as HTMLElement | null;
      if (canScrollY(sc, e.deltaY)) return; // внутри скроллимого блока — native
      e.preventDefault();
      const dy =
        e.deltaMode === 1
          ? e.deltaY * 24
          : e.deltaMode === 2
            ? e.deltaY * window.innerHeight
            : e.deltaY;
      accRef.current += dy;
      // порог ≈ пол-экрана жеста (босс: «threshold roughly equal to screen
      // height»); одиночный круткий flick (≥150) переключает сразу
      const th = Math.min(480, Math.max(240, window.innerHeight * 0.5));
      if (Math.abs(e.deltaY) >= 150 || Math.abs(accRef.current) >= th) {
        const dir: 1 | -1 = (Math.abs(e.deltaY) >= 150 ? e.deltaY : accRef.current) > 0 ? 1 : -1;
        go(idxRef.current + dir);
        accRef.current = 0;
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.target as Element | null;
      const sc = t?.closest?.("[data-cb-scroll], .cb-scene__text") as HTMLElement | null;
      touchRef.current = { y: e.touches[0].clientY, scrollEl: sc };
    };

    const onTouchMove = (e: TouchEvent) => {
      const st = touchRef.current;
      if (!st) return;
      const dy = st.y - e.touches[0].clientY;
      if (canScrollY(st.scrollEl, dy)) return; // внутри скроллимого блока
      if (Math.abs(dy) < 10) return;
      e.preventDefault();
      if (Math.abs(dy) >= 64 && !lockRef.current) {
        go(idxRef.current + (dy > 0 ? 1 : -1));
        touchRef.current = { y: e.touches[0].clientY, scrollEl: st.scrollEl };
      }
    };

    const onTouchEnd = () => {
      touchRef.current = null;
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("touchstart", onTouchStart, { passive: true });
    stage.addEventListener("touchmove", onTouchMove, { passive: false });
    stage.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("touchstart", onTouchStart);
      stage.removeEventListener("touchmove", onTouchMove);
      stage.removeEventListener("touchend", onTouchEnd);
    };
  }, [active, go]);

  // ── клавиатура: стрелки / PgUp / PgDn / Space / Home / End ───────────────
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName)) return;
      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "ArrowRight":
          e.preventDefault();
          go(idxRef.current + 1);
          break;
        case "ArrowUp":
        case "PageUp":
        case "ArrowLeft":
          e.preventDefault();
          go(idxRef.current - 1);
          break;
        case "Home":
          e.preventDefault();
          go(0);
          break;
        case "End":
          e.preventDefault();
          go(scenesRef.current.length - 1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go]);

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
    for (const s of [scenesRef.current[idx + 1], scenesRef.current[idx + 2]]) {
      if (s?.img) {
        const im = new window.Image();
        im.src = s.img;
      }
    }
  }, [active, idx]);

  const cur = scenes[idx] ?? scenes[0];

  return (
    <div
      className={`cb-cine${active ? " cb-cine--on" : ""}${reduceMotion ? " cb-cine--rm" : ""}`}
    >
      <div className="cb-cine__stage" ref={stageRef}>
        {scenes.map((s, i) => (
          <section
            key={s.id}
            data-scene={s.id}
            data-title={s.title}
            className={[
              "cb-scene",
              `cb-scene--${s.accent ?? "cyan"}`,
              s.img ? "" : "cb-scene--nopic",
              s.contain ? "cb-scene--contain" : "",
              s.scrollable ? "cb-scene--scroll" : "",
              s.shake ? "cb-scene--shake" : "",
              s.glitch ? "cb-scene--glitch" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={s.title}
            {...(s.scrollable ? { "data-cb-scroll": "" } : {})}
          >
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
                  {...(i < 2 ? {} : { loading: "lazy" as const })}
                  draggable={false}
                />
              </>
            )}
            <div className="cb-scene__scrim" aria-hidden="true" />
            {s.chrome !== false && (
              <>
                <span className="cb-scene__num" aria-hidden="true">
                  {s.num ?? String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="cb-scene__title">{s.title}</h2>
              </>
            )}
            <div className="cb-scene__text">{s.node}</div>
          </section>
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
                className={`cb-hud__dot${i === idx ? " is-here" : ""}${s.img ? "" : " cb-hud__dot--card"}`}
                title={`Кадр ${i + 1} · ${s.title}`}
                aria-label={`Кадр ${i + 1}: ${s.title}`}
                aria-current={i === idx ? "true" : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <div className="cb-hud__count" role="status">
            <b>{String(idx + 1).padStart(2, "0")}</b>
            <span>/ {String(scenes.length).padStart(2, "0")}</span>
            <i>{cur?.num ? `${cur.num} · ` : ""}{cur?.title}</i>
          </div>
          {!moved && (
            <div className="cb-hud__hint" aria-hidden="true">
              <span>СКРОЛЛ = КАМЕРА</span>
              <i>один экран — один кадр · 8 fps</i>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
