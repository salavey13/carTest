"use client";

import { useEffect } from 'react';

export const useBioAnimations = () => {
  useEffect(() => {
    // Initialize Slick slider for stories and description
    if (typeof window !== 'undefined') {
      const $ = require('jquery');
      require('slick-carousel');
      $('.stories, .description').slick({
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

    // Initialize animations
    const initAnimations = () => {
      if (typeof gsap === 'undefined') return;
      gsap.registerPlugin(window.ScrollTrigger, window.TextPlugin);

      let lenis = null;
      if (typeof window.Lenis !== 'undefined') {
        lenis = new window.Lenis({
          duration: 1.4,
          easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smooth: true,
          mouseMultiplier: 1,
          touchMultiplier: 2,
        });
        const raf = time => {
          lenis.raf(time);
          requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
        lenis.on('scroll', window.ScrollTrigger.update);
      }

      const EPIC_ANIMS = {
        'lux-up': {
          custom: el => {
            const tl = gsap.timeline();
            tl.fromTo(el, { opacity: 0, y: 80, scale: .94, filter: 'blur(10px)' }, { opacity: 1, y: -4, scale: 1, duration: 1.8, ease: 'power3.out' })
              .to(el, { filter: 'blur(0px)', duration: .9, ease: 'power3.out' }, 0)
              .to(el, { y: 0, duration: .5, ease: 'power2.out' });
            return tl;
          }
        },
        fade: {
          from: { opacity: 0, scale: .96, filter: 'blur(6px)' },
          to: { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.4, ease: 'power2.out' }
        },
        up: { from: { opacity: 0, y: 80 }, to: { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' } },
        down: { from: { opacity: 0, y: -80 }, to: { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' } },
        left: { from: { opacity: 0, x: -120 }, to: { opacity: 1, x: 0, duration: 1.4, ease: 'power4.out' } },
        right: { from: { opacity: 0, x: 120 }, to: { opacity: 1, x: 0, duration: 1.4, ease: 'power4.out' } },
      };

      const applyEpicStagger = container => {
        const type = container.dataset.stagger || 'up';
        const delay = parseFloat(container.dataset.staggerDelay) || .15;
        const cfg = EPIC_ANIMS[type];
        if (!cfg || cfg.custom) return;

        gsap.fromTo(container.children, cfg.from, {
          ...cfg.to,
          stagger: delay,
          scrollTrigger: {
            trigger: container,
            start: 'top 80%',
            once: true,
          }
        });
      };

      document.querySelectorAll('[data-parallax]').forEach(el => {
        const speed = parseFloat(el.dataset.parallax) || .5;
        gsap.to(el, {
          y: () => -window.innerHeight * speed,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 }
        });
      });

      document.querySelectorAll('[data-anim][data-instant="true"]').forEach(el => {
        const type = el.dataset.anim || 'fade';
        const delay = parseFloat(el.dataset.delay) || 0;
        const cfg = EPIC_ANIMS[type];
        gsap.delayedCall(delay, () => {
          cfg?.custom ? cfg.custom(el) : gsap.fromTo(el, cfg.from, cfg.to);
        });
      });

      window.ScrollTrigger.batch('[data-anim]:not([data-instant="true"])', {
        start: 'top 80%',
        once: true,
        onEnter: batch => {
          batch.forEach(el => {
            const type = el.dataset.anim || 'fade';
            const delay = parseFloat(el.dataset.delay) || 0;
            const cfg = EPIC_ANIMS[type];
            gsap.delayedCall(delay, () => {
              cfg?.custom ? cfg.custom(el) : gsap.fromTo(el, cfg.from, cfg.to);
            });
          });
        }
      });

      document.querySelectorAll('[data-stagger]').forEach(applyEpicStagger);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAnimations);
    } else {
      setTimeout(initAnimations, 100);
    }

    // Messages handling
    const msgs = document.querySelector('.messages');
    if (msgs && msgs.querySelectorAll('.alert').length > 0) {
      msgs.classList.add('has-messages');
      setTimeout(() => msgs.classList.remove('has-messages'), 5000);
    }
  }, []);
};