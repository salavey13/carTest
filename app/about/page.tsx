"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SupportForm from "@/components/SupportForm";

export default function AboutPage() {
  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold text-center">Обо мне</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Личная информация */}
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="w-24 h-24 md:w-32 md:h-32">
              <AvatarImage src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix//135398606.png" alt="Павел Соловьёв" />
              <AvatarFallback>ПС</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h2 className="text-xl md:text-2xl font-bold">Павел Соловьёв</h2>
              <p className="text-sm md:text-base">Нижний Новгород, Россия</p>
              <div className="mt-4 space-y-2 text-sm md:text-base">
                <p><strong>Email:</strong> <a href="mailto:salavey13@gmail.com" className="text-blue-500 hover:underline">salavey13@gmail.com</a></p>
                <p><strong>Telegram:</strong> <a href="https://t.me/salavey13" target="_blank" className="text-blue-500 hover:underline">t.me/salavey13</a></p>
                <p><strong>GitHub:</strong> <a href="https://github.com/salavey13" target="_blank" className="text-blue-500 hover:underline">salavey13</a></p>
              </div>
            </div>
          </div>

          {/* Профессиональный обзор */}
          <Card className="bg-gray-100 dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-semibold">Профессиональный обзор</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 text-sm md:text-base">
                Павел Соловьёв — разработчик с более чем 13-летним опытом, перешедший от Java к низкокодовым платформам (Framer, Supabase). Его флагманский проект "carTest" — это полноценное веб-приложение, демонстрирующее базовые функции и уникальную подстраницу selfdev, где новички могут создавать страницы с помощью ИИ прямо через pull request. Основатель платформы <a href="https://onesitepls.framer.ai" target="_blank" className="text-blue-500 hover:underline">oneSitePls.framer.ai</a> и ментор для начинающих разработчиков.
              </p>
            </CardContent>
          </Card>

          {/* Методология VIBE */}
          <Card className="bg-gray-100 dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-semibold">Методология VIBE</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 text-sm md:text-base">
                Моя методология VIBE — это не ноукод и не лоукод, это фулкод, но его можно даже не читать. Это как тестить в продакшне на стероидах. Всё чисто боты, что позволяет быстро и эффективно разрабатывать приложения.
              </p>
            </CardContent>
          </Card>

          {/* Заявка на платную поддержку */}
          <Card className="bg-gray-100 dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-semibold">Заявка на платную поддержку</CardTitle>
            </CardHeader>
            <CardContent>
              <SupportForm />
            </CardContent>
          </Card>

          {/* Интересная информация о проекте */}
          <Card className="bg-gray-100 dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-semibold">О проекте</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 text-sm md:text-base">
                Этот проект — не просто страница, а настоящая кибер-экосистема для аренды китайских автомобилей! Здесь есть всё: от ИИ-ассистента, который помогает писать код, до кибер-гаража для управления автопарком. Мы прикрутили Telegram-ботов для оплаты и общения, а также подстраницу <a href="/repo-xml" className="text-blue-500 hover:underline">/repo-xml</a>, где ты можешь подключиться к разработке. Давай вместе добавим новые фичи — например, AR-туры по машинам или нейросеть для подбора тачек по вайбу! Присоединяйся, братан, и го развивать это дальше!
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}