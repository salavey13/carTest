"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useScrollFadeIn } from "./hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "./hooks/useStaggerFadeIn";
import { useBio30ThemeFix } from "./hooks/useBio30ThemeFix";
import PartnerForm from "./components/PartnerForm";

const SlickSlider = dynamic(() => import("react-slick"), { ssr: false });

const HomePage: React.FC = () => {
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const advantages = useStaggerFadeIn(6, 0.1);
  const partner = useScrollFadeIn("up", 0.1);
  useBio30ThemeFix();

  const heroSettings = {
    infinite: true,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: false,
    autoplaySpeed: 1000,
    arrows: false,
    dots: false,
  };

  const storiesSettings = {
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
  };

  const products = [
    {
      title: "Cordyceps Sinensis",
      desc: "Адаптоген, помогает справляться со стрессом. Содержит кордицепин и полисахариды для поддержки иммунитета, улучшения выносливости, общего укрепления. Идеален для спортсменов, активных людей и стремящихся к здоровью.",
      price: 2500,
      img: "https://bio30.ru/static/uploads/products/deab27a3b7834149ad5187c430301f9c.webp",
      mobileImg: "https://bio30.ru/static/uploads/products/8ccf8585cd3f42d6aa1389adb7a719ce.webp",
      link: "/categories/cordyceps-sinensis",
      bg: "#ffe609",
      text: "#000000",
      class: "card panel-bg-#ffe609 panel-text-#000000 card__default card__default--product",
    },
    {
      title: "Spirulina Chlorella",
      desc: "Spirulina Chlorella — это уникальное сочетание двух суперфудов: спирулины и хлореллы. Спирулина — это сине-зеленая водоросль, богатая белками, витаминами и минералами. Хлорелла — это одноклеточная зеленая водоросль, известная своими детоксикационными свойствами и высоким содержанием хлорофилла. Этот продукт помогает укрепить иммунную систему, улучшить пищеварение и поддерживать общее здоровье организма. Рекомендуется для вегетарианцев, спортсменов и всех, кто стремится к здоровому образу жизни.",
      price: 2500,
      img: "https://bio30.ru/static/uploads/products/44aa9efb6836449bb10a1f7ac9d42923.webp",
      mobileImg: "https://bio30.ru/static/uploads/products/f21a69b0e62f4dee8b9f231985024282.webp",
      link: "/categories/spirulina-chlorella",
      bg: "#a3ea00",
      text: "#000000",
      class: "card panel-bg-#a3ea00 panel-text-#000000 card__horizontal card__horizontal--product",
    },
    {
      title: "Lion's Mane",
      desc: "Lion's Mane, также известный как грива льва или гриб-геркулес, является популярным биологически активным добавкой (БАД), используемой в традиционной китайской медицине. Этот гриб известен своими нейропротекторными свойствами, которые помогают улучшить когнитивные функции, память и концентрацию. Lion's Mane также поддерживает нервную систему и способствует общему укреплению организма. Рекомендуется для людей, стремящихся улучшить свою умственную активность и общее здоровье.",
      price: 100,
      img: "https://bio30.ru/static/uploads/products/9aeea9dde8f048238a27f43c3997c9fd.webp",
      mobileImg: "https://bio30.ru/static/uploads/products/d99d3385cd3f42d6aa1389adb7a719ce.webp",
      link: "/categories/lion-s-mane",
      bg: "#ffffff",
      text: "#000000",
      class: "card panel-bg-#ffffff panel-text-#000000 card__vertical card__vertical--product",
    },
    {
      title: "MAGNESIUM PYRIDOXINE",
      desc: "Синергетический комплекс магния и витамина B6 для здоровья нервной системы и полноценного восстановления. Высокобиодоступные формы магния цитрата и пиридоксина обеспечивают глубокое расслабление, качественный сон и защиту от стресса.",
      price: 1600,
      img: "https://bio30.ru/static/uploads/products/1552689351894f229843f51efdb813fc.webp",
      mobileImg: "https://bio30.ru/static/uploads/products/74faf744a03e4f1c83e24ace9ac7582b.webp",
      link: "/categories/magnesium-pyridoxine",
      bg: "#02044A",
      text: "#ffffff",
      class: "card panel-bg-#02044A panel-text-#ffffff card__horizontal card__horizontal--product",
    },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <section className="hero-section">
        <SlickSlider {...heroSettings}>
          <div className="container gp gp--hg container--hero" style={{ backgroundColor: '#FF0004', border: 'none' }}>
            <div className="aside pd__hg ctr ctr--content">
              <div className="col gp gp--lg">
                <div className="col gp gp--xs">
                  <h1 className="title fs__xxl fw__bd" style={{ color: '#ffffff' }}>
                    Новый уровень заботы о себе
                  </h1>
                  <h2 className="subtitle fs__lg fw__rg opc opc--75" style={{ color: '#ffffff' }}>
                    Откройте лучшие добавки для Вашего здоровья на нашем сайте.
                  </h2>
                </div>
                <Link href="/bio30/categories" className="btn btn--wht btn__secondary">
                  Узнать больше
                </Link>
              </div>
            </div>
            <div className="bside">
              <img src="https://bio30.ru/static/uploads/hero/d4e3bacf49534b708ce6d8271df758b1.webp" alt="Новый уровень заботы о себе" className="image__web img--hero" />
              <img src="https://bio30.ru/static/uploads/hero/mobile_a78fcf38f4504f929f3f37b069a6e306.webp" alt="Новый уровень заботы о себе" className="image__mobile img--hero" />
            </div>
          </div>
          <div className="container gp gp--hg container--hero" style={{ backgroundColor: '#0f0f0f', border: 'none' }}>
            <div className="aside pd__hg ctr ctr--content">
              <div className="col gp gp--lg">
                <div className="col gp gp--xs">
                  <h1 className="title fs__xxl fw__bd" style={{ color: '#ffffff' }}>
                    Ваши добавки – в любой точке мира
                  </h1>
                  <h2 className="subtitle fs__lg fw__rg opc opc--75" style={{ color: '#ffffff' }}>
                    Быстрая и надежная доставка СДЭК для Вашего удобства.
                  </h2>
                </div>
                <Link href="/bio30/delivery" className="btn btn--wht btn__secondary">
                  Узнать больше
                </Link>
              </div>
            </div>
            <div className="bside">
              <img src="https://bio30.ru/static/uploads/hero/5dc7b4c6fa21451ba01717448ce6588e.webp" alt="Ваши добавки – в любой точке мира" className="image__web img--hero" />
              <img src="https://bio30.ru/static/uploads/hero/mobile_bfd7ec9cc635468cb945c544c663095f.webp" alt="Ваши добавки – в любой точке мира" className="image__mobile img--hero" />
            </div>
          </div>
          <div className="container gp gp--hg container--hero" style={{ backgroundColor: '#B2FF00', border: 'none' }}>
            <div className="aside pd__hg ctr ctr--content">
              <div className="col gp gp--lg">
                <div className="col gp gp--xs">
                  <h1 className="title fs__xxl fw__bd" style={{ color: '#000000' }}>
                    Ваш доход растет вместе с нами
                  </h1>
                  <h2 className="subtitle fs__lg fw__rg opc opc--75" style={{ color: '#000000' }}>
                    Получайте до 30% с заказов приглашенных (3 уровня). Выгодно и просто!
                  </h2>
                </div>
                <Link href="/bio30/referal" className="btn btn--wht btn__secondary">
                  Узнать больше
                </Link>
              </div>
            </div>
            <div className="bside">
              <img src="https://bio30.ru/static/uploads/hero/b09c832bbec74900b8cafee174b422bd.webp" alt="Ваш доход растет вместе с нами" className="image__web img--hero" />
              <img src="https://bio30.ru/static/uploads/hero/mobile_f447552243cf479790ec8d057ea0425c.webp" alt="Ваш доход растет вместе с нами" className="image__mobile img--hero" />
            </div>
          </div>
        </SlickSlider>
      </section>

      <section className="py-16 px-6">
        <motion.div
          ref={advantages.ref}
          initial="hidden"
          animate={advantages.controls}
          variants={advantages.container}
          className="grid grid--benefit"
        >
          {[
            {
              title: "Качество, подтвержденное стандартами",
              desc: "Вы получаете продукт, соответствующий строгим стандартам качества.",
              img: "https://bio30.ru/static/uploads/benefits/552036943c7f4338b3eed6a3f52cce86.webp",
              mobileImg: "https://bio30.ru/static/uploads/benefits/mobile_93ffddcd82a8440eb272aa165c2a6f95.webp",
              bg: "#FF0004",
              text: "#ffffff",
              class: "benefit benefit__center",
            },
            {
              title: "Доверие в 7+ странах мира",
              desc: "Наш продукт популярен и пользуется доверием во многих странах.",
              img: "https://bio30.ru/static/uploads/benefits/fd241b092da14997a9cc7e418c084b60.webp",
              mobileImg: "https://bio30.ru/static/uploads/benefits/mobile_f1b07f689fd04ff882e0f032599e2731.webp",
              bg: "#000000",
              text: "#ffffff",
              class: "benefit benefit__center",
            },
            {
              title: "Поддержка 24/7 для вас",
              desc: "Наша команда всегда готова ответить на Ваши вопросы.",
              img: "https://bio30.ru/static/uploads/benefits/873b037261134405857b6ca444c7553a.webp",
              mobileImg: "https://bio30.ru/static/uploads/benefits/mobile_85476bc252d14b1eb3e79633b0a7ee56.webp",
              bg: "#B2FF00",
              text: "#000000",
              class: "benefit benefit__default",
            },
            {
              title: "Решение для всех и каждого",
              desc: "Продукт подходит для натуральной поддержки Вашего здоровья.",
              img: "https://bio30.ru/static/uploads/benefits/6a317041578644d1b283abeaf781bf36.webp",
              mobileImg: "https://bio30.ru/static/uploads/benefits/mobile_ee67808825ec4740890288c6ebd4b6fb.webp",
              bg: "#FFE609",
              text: "#000000",
              class: "benefit benefit__default",
            },
            {
              title: "Щедрые выплаты партнерам",
              desc: "Мы предлагаем Вам выгодные условия партнерской программы.",
              img: "https://bio30.ru/static/uploads/benefits/4857f03567274775af998c74f7d7dd0b.webp",
              mobileImg: "https://bio30.ru/static/uploads/benefits/mobile_194bc082ad764197a07368ab8db613ac.webp",
              bg: "#000000",
              text: "#ffffff",
              class: "benefit benefit__center",
            },
            {
              title: "Сила только натуральных компонентов",
              desc: "Вы получаете продукты только из чистых натуральных ингредиентов.",
              img: "https://bio30.ru/static/uploads/benefits/0fdfd54db54c48a48826920cad697f08.webp",
              mobileImg: "https://bio30.ru/static/uploads/benefits/mobile_74ed8b708e0245aeb2a4211a6b1b104c.webp",
              bg: "#ffffff",
              text: "#000000",
              class: "benefit benefit__center",
            },
          ].map((a, i) => (
            <motion.div
              key={i}
              variants={advantages.child}
              className={a.class}
              style={{ backgroundColor: a.bg, color: a.text }}
            >
              <div className="aside">
                <div className="col pd__xl gp gp--md">
                  <div className="col gp gp--sm">
                    <h2 className="title fs__md fw__bd">{a.title}</h2>
                    <h3 className="subtitle fs__md fw__md opc opc--50">{a.desc}</h3>
                  </div>
                </div>
              </div>
              <div className="bside">
                <img src={a.img} alt={a.title} className="image__web" />
                <img src={a.mobileImg} alt={a.title} className="image__mobile" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="py-16 px-6 bg-muted/30 text-center">
        <motion.h2
          ref={partner.ref}
          initial="hidden"
          animate={partner.controls}
          variants={partner.variants}
          className="text-2xl font-bold mb-4"
        >
          Станьте частью большой и дружной семьи
        </motion.h2>
        <p className="text-muted-foreground mb-6">Приглашайте партнёров и зарабатывайте процент с каждой их сделки — больше партнёров, выше доход.</p>
        <PartnerForm />
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;