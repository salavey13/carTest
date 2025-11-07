"use client";

import { useEffect } from "react";

export const useBioAnimations = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    (async () => {
      try {
        // --- Load jQuery and Slick safely ---
        let jq: any = null;
        try {
          const $mod = await import("jquery");
          jq = $mod.default;
          await import("slick-carousel");
          if (jq && jq(".stories").length) {
            jq(".stories, .description").slick({
              dots: false,
              arrows: false,
              infinite: false,
              speed: 800,
              slidesToShow: 1,
              slidesToScroll: 1,
              responsive: [
                { breakpoint: 1024, settings: { dots: true } },
                { breakpoint: 600, settings: { slidesToShow: 2, slidesToScroll: 2 } },
                { breakpoint: 480, settings: { slidesToShow: 1, slidesToScroll: 1 } }
              ]
            });
          }
        } catch (err) {
          console.warn("[bio30] Slick/jQuery failed to load:", err);
        }

        // --- Load GSAP safely ---
        let gsap: any = null;
        try {
          const gsapMod = await import("gsap");
          const ScrollTriggerMod = await import("gsap/ScrollTrigger");
          const TextPluginMod = await import("gsap/TextPlugin");
          gsap = gsapMod.default;
          gsap.registerPlugin(ScrollTriggerMod.default, TextPluginMod.default);
        } catch (err) {
          console.warn("[bio30] GSAP or plugins missing:", err);
        }

        if (!gsap) return;

        // --- Optional Lenis smooth scroll ---
        try {
          const Lenis = (window as any).Lenis;
          if (Lenis) {
            const lenis = new Lenis({
              duration: 1.4,
              easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
              smooth: true,
              mouseMultiplier: 1,
              touchMultiplier: 2,
            });
            const raf = (time: number) => {
              lenis.raf(time);
              requestAnimationFrame(raf);
            };
            requestAnimationFrame(raf);
            lenis.on("scroll", (window as any).ScrollTrigger.update);
          }
        } catch (err) {
          console.warn("[bio30] Lenis not available:", err);
        }

        // --- Animation definitions ---
        const EPIC_ANIMS: Record<string, any> = {
          "lux-up": {
            custom: (el: Element) => {
              const tl = gsap.timeline();
              tl.fromTo(el, { opacity: 0, y: 80, scale: 0.94, filter: "blur(10px)" },
                             { opacity: 1, y: -4, scale: 1, duration: 1.8, ease: "power3.out" })
                .to(el, { filter: "blur(0px)", duration: 0.9, ease: "power3.out" }, 0)
                .to(el, { y: 0, duration: 0.5, ease: "power2.out" });
              return tl;
            }
          },
          fade: { from: { opacity: 0, scale: 0.96, filter: "blur(6px)" },
                  to: { opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.4, ease: "power2.out" } },
          up: { from: { opacity: 0, y: 80 },
                to: { opacity: 1, y: 0, duration: 1.2, ease: "power3.out" } },
          down: { from: { opacity: 0, y: -80 },
                  to: { opacity: 1, y: 0, duration: 1.2, ease: "power3.out" } },
          left: { from: { opacity: 0, x: -120 },
                  to: { opacity: 1, x: 0, duration: 1.4, ease: "power4.out" } },
          right: { from: { opacity: 0, x: 120 },
                   to: { opacity: 1, x: 0, duration: 1.4, ease: "power4.out" } },
        };

        const applyEpicStagger = (container: HTMLElement) => {
          const type = container.dataset.stagger || "up";
          const delay = parseFloat(container.dataset.staggerDelay || "0.15");
          const cfg = EPIC_ANIMS[type];
          if (!cfg || cfg.custom) return;
          gsap.fromTo(container.children, cfg.from, {
            ...cfg.to,
            stagger: delay,
            scrollTrigger: { trigger: container, start: "top 80%", once: true }
          });
        };

        // --- Core animation setup ---
        document.querySelectorAll("[data-parallax]").forEach(el => {
          const speed = parseFloat((el as HTMLElement).dataset.parallax || "0.5");
          gsap.to(el, {
            y: () => -window.innerHeight * speed,
            ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 1 }
          });
        });

        document.querySelectorAll("[data-anim][data-instant='true']").forEach(el => {
          const type = (el as HTMLElement).dataset.anim || "fade";
          const delay = parseFloat((el as HTMLElement).dataset.delay || "0");
          const cfg = EPIC_ANIMS[type];
          gsap.delayedCall(delay, () => {
            cfg?.custom ? cfg.custom(el) : gsap.fromTo(el, cfg.from, cfg.to);
          });
        });

        (window as any).ScrollTrigger.batch("[data-anim]:not([data-instant='true'])", {
          start: "top 80%",
          once: true,
          onEnter: (batch: HTMLElement[]) => {
            batch.forEach(el => {
              const type = el.dataset.anim || "fade";
              const delay = parseFloat(el.dataset.delay || "0");
              const cfg = EPIC_ANIMS[type];
              gsap.delayedCall(delay, () => {
                cfg?.custom ? cfg.custom(el) : gsap.fromTo(el, cfg.from, cfg.to);
              });
            });
          },
        });

        document.querySelectorAll("[data-stagger]").forEach(container =>
          applyEpicStagger(container as HTMLElement)
        );

        // --- Messages auto-hide ---
        const msgs = document.querySelector(".messages");
        if (msgs && msgs.querySelectorAll(".alert").length > 0) {
          msgs.classList.add("has-messages");
          setTimeout(() => msgs.classList.remove("has-messages"), 5000);
        }

        console.info("[bio30] Animations initialized successfully");
      } catch (err) {
        console.error("[bio30] Animation init error:", err);
      }
    })();
  }, []);
};