"use client";

import React, { useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import './styles.css';

const HomePage: React.FC = () => {
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
        <div className="row ctr gp gp--xl" data-anim="fade" data-delay="0.1">
          <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">BIO 3.0 - Биопродукты будущего</span>
          <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Передовые биопродукты и технологии для здоровья и будущего. Откройте новые возможности с нами.</span>
        </div>
      </div>
      <div className="stories">
        <div className="story" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Story 1</div>
          <span className="description">Описание истории 1</span>
        </div>
        <div className="story" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Story 2</div>
          <span className="description">Описание истории 2</span>
        </div>
        <div className="story" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Story 3</div>
          <span className="description">Описание истории 3</span>
        </div>
        <div className="story" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Story 4</div>
          <span className="description">Описание истории 4</span>
        </div>
      </div>
      <div className="grid grid--benefit" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.1">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_74ed8b708e0245aeb2a4211a6b1b104c.webp" alt="Benefit 1" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/6a317041578644d1b283abeaf781bf36.webp" alt="Benefit 1" className="image__web" />
          <div className="title fs__lg fw__bd">Натуральные ингредиенты</div>
          <span className="description">Наши продукты сделаны из натуральных ингредиентов.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_image2.webp" alt="Benefit 2" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/image2.webp" alt="Benefit 2" className="image__web" />
          <div className="title fs__lg fw__bd">Инновационные технологии</div>
          <span className="description">Используем передовые технологии для производства.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_image3.webp" alt="Benefit 3" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/image3.webp" alt="Benefit 3" className="image__web" />
          <div className="title fs__lg fw__bd">Здоровье и благополучие</div>
          <span className="description">Продукты для вашего здоровья и благополучия.</span>
        </div>
      </div>
      <div className="categories">
        <span className="title fs__xl fw__bd" data-anim="lux-up" data-delay="0.1">Категории</span>
        <div className="grid grid--categories" data-stagger="up" data-stagger-delay="0.15">
          <div className="card card__horizontal" data-anim="fade" data-delay="0.1">
            <div className="aside">
              <span className="title fs__lg fw__bd">Категория 1</span>
              <span className="description">Описание категории 1</span>
            </div>
            <div className="bside">
              <img src="/front/static/uploads/categories/cat1.webp" alt="Категория 1" className="image__web" />
            </div>
          </div>
          <div className="card card__horizontal" data-anim="fade" data-delay="0.2">
            <div className="aside">
              <span className="title fs__lg fw__bd">Категория 2</span>
              <span className="description">Описание категории 2</span>
            </div>
            <div className="bside">
              <img src="/front/static/uploads/categories/cat2.webp" alt="Категория 2" className="image__web" />
            </div>
          </div>
          <div className="card card__horizontal" data-anim="fade" data-delay="0.3">
            <div className="aside">
              <span className="title fs__lg fw__bd">Категория 3</span>
              <span className="description">Описание категории 3</span>
            </div>
            <div className="bside">
              <img src="/front/static/uploads/categories/cat3.webp" alt="Категория 3" className="image__web" />
            </div>
          </div>
          <div className="card card__horizontal" data-anim="fade" data-delay="0.4">
            <div className="aside">
              <span className="title fs__lg fw__bd">Категория 4</span>
              <span className="description">Описание категории 4</span>
            </div>
            <div className="bside">
              <img src="/front/static/uploads/categories/cat4.webp" alt="Категория 4" className="image__web" />
            </div>
          </div>
        </div>
      </div>
      {/* Add FAQ section if present in main.txt */}
      <div className="faq">
        <span className="title fs__xl fw__bd" data-anim="lux-up" data-delay="0.1">Часто задаваемые вопросы</span>
        <div className="faq-item" data-anim="fade" data-delay="0.1">
          <div className="question fs__md fw__bd">Вопрос 1?</div>
          <span className="answer">Ответ 1.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.2">
          <div className="question fs__md fw__bd">Вопрос 2?</div>
          <span className="answer">Ответ 2.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.3">
          <div className="question fs__md fw__bd">Вопрос 3?</div>
          <span className="answer">Ответ 3.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.4">
          <div className="question fs__md fw__bd">Вопрос 4?</div>
          <span className="answer">Ответ 4.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.5">
          <div className="question fs__md fw__bd">Вопрос 5?</div>
          <span className="answer">Ответ 5.</span>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;