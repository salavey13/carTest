/**
 * HowItWorksSection.tsx
 * ======================
 * 4-step "How it works" section.
 */
"use client";

import Link from "next/link";
import { StepItem } from "./ServiceCardsSection";

const howItWorksSteps = [
  { num: "1", title: "Бронь", icon: "::FaCalendarCheck::", text: <>Выберите модель в нашем <Link href="/franchize/vip-bike" className="text-accent-text hover:underline">каталоге</Link> и оформите бронь онлайн.</> },
  { num: "2", title: "Подтверждение", icon: "::FaPaperPlane::", text: "Свяжитесь с нами для подтверждения. Возьмите с собой оригиналы документов и залог." },
  { num: "3", title: "Получение", icon: "::FaKey::", text: "Приезжайте на пл. Комсомольская 2: быстро сверяем документы, подписываем договор и выдаём подготовленный байк." },
  { num: "4", title: "Возврат и отдых", icon: "::FaFlagCheckered::", text: "Верните мотоцикл в срок. После поездки можно отдохнуть в нашей лаунж-зоне." },
];

export function HowItWorksSection() {
  return (
    <section>
      <h2 className="mb-10 text-center font-orbitron text-4xl">Как это работает</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {howItWorksSteps.map((step) => <StepItem key={step.num} num={step.num} title={step.title} icon={step.icon}>{step.text}</StepItem>)}
      </div>
    </section>
  );
}
