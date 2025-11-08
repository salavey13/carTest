import { ReferralStep } from '../types';

export const REFERRAL_STEPS: ReferralStep[] = [
  {
    title: "Моментальный старт",
    description: "Введите пригласительный код или откройте ссылку — регистрация занимает меньше минуты.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/0b5d6ef89a1948ffbbcb5e5bfb1a3f86.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/2bdb6da6fb0742de89691e932433dc59.webp"
    }
  },
  {
    title: "Подтверждение одним кликом",
    description: "В личном кабинете нажмите «Стать партнёром» — и Вы официально в программе.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/9079c1aa4d714281a5bf4503bfd7e2a7.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/fa85e91f1ef047c392fd9e2dc9c41ab0.webp"
    }
  },
  {
    title: "Личный код + ссылка",
    description: "Сразу после активации Вы получаете уникальный код и короткую ссылку.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/d0b0ab2862c64eec86f949657c550d2e.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/d77704f9f8844ee092c9c1aa8eb58d57.webp"
    }
  },
  {
    title: "Приглашайте, где удобно",
    description: "Делитесь ссылкой в мессенджерах, соцсетях или e-mail — каждый новый клиент автоматически закрепляется за Вами.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/20fdf1a0d8924c1c81cc12e419e1bb3a.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/b6b3bdc09d504aa098936211fe2baa47.webp"
    }
  },
  {
    title: "Авто-бонусы с заказов",
    description: "Когда приглашённые оформляют покупку, процент от суммы мгновенно падает на Ваш баланс.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/f82299e623d742a1b499cfa778464d3b.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/238f245f33044593925eb239d0fe9be4.webp"
    }
  },
  {
    title: "До 30 % с трёх уровней",
    description: "Зарабатывайте 30 % с прямых продаж, 10 % со 2-го и 10 % с 3-го уровня; статистика и баланс обновляются онлайн.",
    image: {
      web: "https://bio30.ru/static/uploads/benefits/54c2b200ea6640f18a890cea20fda387.webp",
      mobile: "https://bio30.ru/static/uploads/benefits/f58334e5bdbe4f8a8d8ea75a3da7239a.webp"
    }
  }
];

export const REFERRAL_COMMISSIONS = {
  level1: 30,
  level2: 10,
  level3: 10
};