import VipBikeElectroPage from "./page";

export const metadata = {
  title: "VIP BIKE ELECTRO — Аренда байков в Нижнем Новгороде",
  description:
    "Премиальный прокат электробайков и мотоциклов. От 6 000 ₽/сутки. Электро по правам B, шлем в комплекте, забронируй в боте.",
  keywords:
    "аренда электробайка, аренда мотоцикла Нижний Новгород, аренда эндуро, VIP Bike, прокат байков",
  openGraph: {
    title: "VIP BIKE ELECTRO — Аренда байков в Нижнем Новгороде",
    description:
      "Премиальный прокат электробайков и мотоциклов. От 6 000 ₽/сутки. Электро по правам B, шлем в комплекте.",
    type: "website",
    locale: "ru_RU",
  },
};

export default function VipBikeElectroLayout() {
  return <VipBikeElectroPage />;
}
