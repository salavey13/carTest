import { Product } from '../types';

export const PRODUCTS: Product[] = [
  {
    title: "Cordyceps Sinensis",
    description: "Адаптоген, помогает справляться со стрессом. Содержит кордицепин и полисахариды для поддержки иммунитета, улучшения выносливости, общего укрепления. Идеален для спортсменов, активных людей и стремящихся к здоровью.",
    price: 2500,
    image: {
      web: "https://bio30.ru/static/uploads/products/deab27a3b7834149ad5187c430301f9c.webp",
      mobile: "https://bio30.ru/static/uploads/products/8ccf8585e93949cea7c79b9a9410489f.webp"
    },
    link: "/bio30/categories/cordyceps-sinensis",
    theme: { bg: "#ffe609", text: "#000000" },
    tags: ["for_men", "for_women", "bestseller"],
    layout: "default"
  },
  {
    title: "Spirulina Chlorella",
    description: "Spirulina Chlorella — это уникальное сочетание двух суперфудов: спирулины и хлореллы. Спирулина — это сине-зеленая водоросль, богатая белками, витаминами и минералами. Хлорелла — это одноклеточная зеленая водоросль, известная своими детоксикационными свойствами и высоким содержанием хлорофилла.",
    price: 2500,
    image: {
      web: "https://bio30.ru/static/uploads/products/44aa9efb6836449bb10a1f7ac9d42923.webp",
      mobile: "https://bio30.ru/static/uploads/products/f21a69b0e62f4dee8b9f231985024282.webp"
    },
    link: "/bio30/categories/spirulina-chlorella",
    theme: { bg: "#a3ea00", text: "#000000" },
    tags: ["for_men", "for_women", "bestseller"],
    layout: "horizontal"
  },
  {
    title: "Lion's Mane",
    description: "Lion's Mane, также известный как грива льва или гриб-геркулес, является популярной биологически активной добавкой, используемой в традиционной китайской медицине. Этот гриб известен своими нейропротекторными свойствами, которые помогают улучшить когнитивные функции, память и концентрацию.",
    price: 2500,
    image: {
      web: "https://bio30.ru/static/uploads/products/9aeea9dde8f048238a27f43c3997c9fd.webp",
      mobile: "https://bio30.ru/static/uploads/products/d99d3385cd3f42d6aa1389adb7a719ce.webp"
    },
    link: "/bio30/categories/lion-s-mane",
    theme: { bg: "#ffffff", text: "#000000" },
    tags: ["for_men", "for_women"],
    layout: "vertical"
  },
  {
    title: "MAGNESIUM PYRIDOXINE",
    description: "Синергетический комплекс магния и витамина B6 для здоровья нервной системы и полноценного восстановления. Высокобиодоступные формы магния цитрата и пиридоксина обеспечивают глубокое расслабление, качественный сон и защиту от стресса.",
    price: 1600,
    image: {
      web: "https://bio30.ru/static/uploads/products/1552689351894f229843f51efdb813fc.webp",
      mobile: "https://bio30.ru/static/uploads/products/74faf744a03e4f1c83e24ace9ac7582b.webp"
    },
    link: "/bio30/categories/magnesium-pyridoxine",
    theme: { bg: "#02044A", text: "#ffffff" },
    tags: [],
    layout: "horizontal"
  }
];

export const STORIES = [
  {
    quote: "Спасибо за качественные продукты и отличный сервис.",
    name: "Алина Чарова",
    platform: "youtube",
    link: "https://www.youtube.com/shorts/ap5CIoJpWFo?feature=share ",
    image: "https://bio30.ru/static/uploads/story/65446.webp",
    verified: true
  },
  {
    quote: "Великолепное действие!",
    name: "Елизавета Марковна",
    followers: "100000 m.",
    platform: "youtube",
    link: "https://www.youtube.com/shorts/ap5CIoJpWFo?feature=share ",
    image: "https://bio30.ru/static/uploads/story/pikaso-woman.webp",
    verified: true
  },
  {
    quote: "Помогает в спорте, помогает в жизни.",
    name: "Евгений Игоревич",
    platform: "instagram",
    link: "https://www.youtube.com/shorts/ap5CIoJpWFo?feature=share ",
    image: "https://bio30.ru/static/uploads/story/resource-tti-14.webp",
    verified: true
  }
];

export const BENEFITS = [
  {
    title: "Качество, подтвержденное стандартами",
    description: "Вы получаете продукт, соответствующий строгим стандартам качества.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/552036943c7f4338b3eed6a3f52cce86.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/mobile_93ffddcd82a8440eb272aa165c2a6f95.webp"
    },
    theme: { bg: "#FF0004", text: "#ffffff" },
    variant: "center"
  },
  {
    title: "Доверие в 7+ странах мира",
    description: "Наш продукт популярен и пользуется доверием во многих странах.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/fd241b092da14997a9cc7e418c084b60.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/mobile_f1b07f689fd04ff882e0f032599e2731.webp"
    },
    theme: { bg: "#000000", text: "#ffffff" },
    variant: "center"
  },
  {
    title: "Поддержка 24/7 для вас",
    description: "Наша команда всегда готова ответить на Ваши вопросы.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/873b037261134405857b6ca444c7553a.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/mobile_85476bc252d14b1eb3e79633b0a7ee56.webp"
    },
    theme: { bg: "#B2FF00", text: "#000000" },
    variant: "default"
  },
  {
    title: "Решение для всех и каждого",
    description: "Продукт подходит для натуральной поддержки Вашего здоровья.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/6a317041578644d1b283abeaf781bf36.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/mobile_ee67808825ec4740890288c6ebd4b6fb.webp"
    },
    theme: { bg: "#FFE609", text: "#000000" },
    variant: "default"
  },
  {
    title: "Щедрые выплаты партнерам",
    description: "Мы предлагаем Вам выгодные условия партнерской программы.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/4857f03567274775af998c74f7d7dd0b.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/mobile_194bc082ad764197a07368ab8db613ac.webp"
    },
    theme: { bg: "#000000", text: "#ffffff" },
    variant: "center"
  },
  {
    title: "Сила только натуральных компонентов",
    description: "Вы получаете продукты только из чистых натуральных ингредиентов.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/0fdfd54db54c48a48826920cad697f08.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/mobile_74ed8b708e0245aeb2a4211a6b1b104c.webp"
    },
    theme: { bg: "#ffffff", text: "#000000" },
    variant: "center"
  }
];

export const SOCIAL_LINKS = {
  telegram: "https://t.me/BIO30_chat ",
  vk: "https://vk.com/club231438011 ",
  dzen: "https://dzen.ru/id/6868db59568f80115b12a631 "
};