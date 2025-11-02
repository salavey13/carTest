"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const DeliveryPage: React.FC = () => {
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



  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Доставка - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Узнайте об условиях доставки BIO 3.0. Стоимость, сроки и способы доставки ваших заказов. Быстрая и надежная доставка биопродуктов.</span>
      </div>
      <div className="grid grid--delivery" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Способы доставки</div>
          <span className="description">Мы предлагаем несколько способов доставки: курьерская доставка, почта, самовывоз. Сроки зависят от региона.</span>
        </div>
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Стоимость доставки</div>
          <span className="description">Стоимость рассчитывается индивидуально, от 300 руб. Бесплатно при заказе от 5000 руб.</span>
        </div>
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Сроки доставки</div>
          <span className="description">В Москве - 1-2 дня, в регионах - 3-7 дней.</span>
        </div>
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Оплата</div>
          <span className="description">Оплата при получении или онлайн через сайт.</span>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DeliveryPage;