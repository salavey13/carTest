"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PartnerForm from '../components/PartnerForm';
import { useAppContext } from '@/contexts/AppContext';
import '../styles.css';

const ReferalPage: React.FC = () => {
  const { dbUser } = useAppContext();
  const isPartner = dbUser?.metadata?.is_referral_partner || false;

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
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Реферальная программа - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Участвуйте в реферальной программе BIO 3.0! Приглашайте друзей и получайте бонусы и скидки на продукцию. Узнайте условия и начните зарабатывать.</span>
      </div>
      <div className="grid grid--referral_01" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__center" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Как это работает</div>
          <span className="description">Пригласите друга по реферальной ссылке, он получит скидку, вы - бонус.</span>
        </div>
        <div className="benefit benefit__horizontal" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Ваша реферальная ссылка</div>
          <span className="description">https://bio30.ru/referal/yourcode</span>
        </div>
        <div className="benefit benefit__horizontal" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Статистика</div>
          <span className="description">Количество приглашенных: 5, Заработано: 500 руб.</span>
        </div>
      </div>
      <div className="grid grid--referral_02" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Шаг 1: Регистрация</div>
          <span className="description">Зарегистрируйтесь на сайте.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Шаг 2: Получите ссылку</div>
          <span className="description">Получите уникальную реферальную ссылку.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Шаг 3: Пригласите друзей</div>
          <span className="description">Поделитесь ссылкой с друзьями.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Шаг 4: Получите бонусы</div>
          <span className="description">Получите бонусы за покупки друзей.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.5">
          <div className="title fs__lg fw__bd">FAQ</div>
          <span className="description">Часто задаваемые вопросы о программе.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.6">
          <div className="title fs__lg fw__bd">Контакты поддержки</div>
          <span className="description">support@bio30.ru</span>
        </div>
      </div>
      {isPartner ? (
        <div className="dashboard">
          <span className="title fs__lg fw__bd">Партнерский дашборд</span>
          <span className="description">Ваша статистика, рефералы и т.д.</span>
          {/* Add dashboard content */}
        </div>
      ) : (
        <PartnerForm />
      )}
      <Footer />
    </div>
  );
};

export default ReferalPage;