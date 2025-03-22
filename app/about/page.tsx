"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SupportForm from "@/components/SupportForm";

export default function AboutPage() {
  return (
    <div className="relative min-h-screen pt-24">
      {/* Cyberpunk background layer */}
      <div className="absolute inset-0 z-0 bg-black">
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#39FF14_0%,transparent_70%)] opacity-20 animate-pulse"></div>
  <div className="absolute inset-0 bg-[linear-gradient(45deg,#39FF14_0%,#111_50%,#39FF14_100%)] opacity-10"></div>
</div>
      <div className="relative z-10 container mx-auto p-4">
        <Card className="max-w-3xl mx-auto bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold text-center text-[#39FF14]">Обо мне</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Личная информация */}
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-24 h-24 md:w-32 md:h-32 border-2 border-[#39FF14]">
                <AvatarImage src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//135398606.png" alt="Павел Соловьёв" />
                <AvatarFallback>ПС</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h2 className="text-xl md:text-2xl font-bold text-[#39FF14]">Павел Соловьёв</h2>
                <p className="text-sm md:text-base">Нижний Новгород, Россия</p>
                <div className="mt-4 space-y-2 text-sm md:text-base">
                  <p><strong>Email:</strong> <a href="mailto:salavey13@gmail.com" className="text-[#39FF14] hover:underline">salavey13@gmail.com</a></p>
                  <p><strong>Telegram:</strong> <a href="https://t.me/salavey13" target="_blank" className="text-[#39FF14] hover:underline">t.me/salavey13</a></p>
                  <p><strong>GitHub:</strong> <a href="https://github.com/salavey13" target="_blank" className="text-[#39FF14] hover:underline">salavey13</a></p>
                </div>
              </div>
            </div>

            {/* Профессиональный обзор */}
            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">Профессиональный обзор</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm md:text-base">
                  Павел Соловьёв — разработчик с более чем 13-летним опытом, перешедший от Java к низкокодовым платформам (Framer, Supabase). Его флагманский проект "carTest" — это полноценное веб-приложение, демонстрирующее базовые функции и уникальную подстраницу selfdev, где новички могут создавать страницы с помощью ИИ прямо через pull request. Основатель платформы <a href="https://onesitepls.framer.ai" target="_blank" className="text-[#39FF14] hover:underline">oneSitePls.framer.ai</a> и ментор для начинающих разработчиков.
                </p>
              </CardContent>
            </Card>

            {/* Методология VIBE */}
            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">Методология VIBE</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm md:text-base">
                  Моя методология VIBE — это не ноукод и не лоукод, это фулкод, но его можно даже не читать. Это как тестить в продакшне на стероидах. Всё чисто боты, что позволяет быстро и эффективно разрабатывать приложения.
                </p>
              </CardContent>
            </Card>

            {/* Заявка на платную поддержку */}
            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">Заявка на платную поддержку</CardTitle>
              </CardHeader>
              <CardContent>
                <SupportForm />
              </CardContent>
            </Card>

            {/* Интересная информация о проекте */}
            <Card className="bg-black text-white rounded-3xl shadow-[0_0_10px_#39FF14]">
              <CardHeader>
                <CardTitle className="text-lg md:text-xl font-semibold text-[#39FF14]">О проекте</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm md:text-base">
                  Этот проект — не просто страница, а настоящая кибер-экосистема для аренды китайских автомобилей! Здесь есть всё: от ИИ-ассистента, который помогает писать код, до кибер-гаража для управления автопарком. Мы прикрутили Telegram-ботов для оплаты и общения, а также подстраницу <a href="/repo-xml" className="text-[#39FF14] hover:underline">/repo-xml</a>, где ты можешь подключиться к разработке. Давай вместе добавим новые фичи — например, AR-туры по машинам или нейросеть для подбора тачек по вайбу! Присоединяйся, братан, и го развивать это дальше!
                </p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
