"use client";

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { becomeReferralPartner } from '../actions';

const PartnerForm: React.FC = () => {
  const { dbUser, refreshDbUser } = useAppContext();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    if (!dbUser?.user_id) return;

    try {
      const response = await fetch('/api/send-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fromTelegram: true, telegramUser: dbUser.user_id }),
      });

      if (response.ok) {
        const partnerResult = await becomeReferralPartner(dbUser.user_id, email);
        if (partnerResult.success) {
          await refreshDbUser();
        }
      }
    } catch (error) {
      console.error('Partner form submission error:', error);
    }
  };

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="w-full lg:w-1/2" data-anim="fade" data-delay="0.1">
            <div className="flex flex-col gap-2">
              <h2
                className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground"
                data-anim="lux-up"
                data-delay="0.1"
              >
                Станьте частью большой и крепкой семьи
              </h2>
              <h3
                className="text-lg font-normal text-muted-foreground opacity-50"
                data-anim="lux-up"
                data-delay="0.1"
              >
                Приглашайте партнёров и получайте бонусы с их каждой сделки.
              </h3>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="w-full lg:w-1/2" data-anim="fade" data-delay="0.2">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-6 bg-card p-6 md:p-8 rounded-lg border border-border"
              data-anim="fade"
              data-delay="0.1"
            >
              {/* Name Input */}
              <div className="space-y-2">
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
                  placeholder="Введите ваше имя и фамилию"
                  required
                />
                <div className="flex px-2">
                  <small
                    className="text-sm font-medium text-muted-foreground opacity-50"
                    data-anim="fade"
                    data-delay="0.2"
                  >
                    Пожалуйста, укажите ваше настоящее имя и фамилию. Это позволит избежать ошибок при доставке и обеспечит корректное оформление документов.
                  </small>
                </div>
              </div>

              {/* Phone Input */}
              <div className="space-y-2">
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
                  placeholder="Введите ваш номер телефона"
                  pattern="\+?[0-9]{10,15}"
                  required
                />
                <div className="flex px-2">
                  <small
                    className="text-sm font-medium text-muted-foreground opacity-50"
                    data-anim="fade"
                    data-delay="0.3"
                  >
                    Рекомендуется использовать номер телефона, на который зарегистрированы Telegram и/или WhatsApp. Это упростит процесс коммуникации и позволит вам быстро получать важные уведомления.
                  </small>
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-2">
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors"
                  placeholder="Ваша электронная почта"
                  required
                />
                <div className="flex px-2">
                  <small
                    className="text-sm font-medium text-muted-foreground opacity-50"
                    data-anim="fade"
                    data-delay="0.4"
                  >
                    На указанную почту будет отправлена ссылка для подтверждения аккаунта и юридические документы. Это необходимо для завершения регистрации и обеспечения безопасности ваших данных.
                  </small>
                </div>
              </div>

              {/* Location Select */}
              <div className="relative">
                <select
                  id="location"
                  name="location"
                  className="w-full px-3 py-2 pr-10 bg-background border border-input rounded-md text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-colors appearance-none"
                  required
                  defaultValue="russia"
                >
                  <option value="russia">Российская Федерация</option>
                  <option value="armenia">Республика Армения</option>
                  <option value="belarus">Республика Беларусь</option>
                  <option value="indonesia">Республика Индонезия</option>
                  <option value="kazakhstan">Республика Казахстан</option>
                  <option value="kyrgyzstan">Кыргызская Республика</option>
                  <option value="thailand">Королевство Таиланд</option>
                  <option value="sri_lanka">Шри-Ланка</option>
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-foreground"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 7C12.5523 7 13 6.55228 13 6C13 5.44772 12.5523 5 12 5C11.4477 5 11 5.44772 11 6C11 6.55228 11.4477 7 12 7Z"
                    fill="currentColor"
                  />
                  <path
                    d="M12 19C12.5523 19 13 18.5523 13 18C13 17.4477 12.5523 17 12 17C11.4477 17 11 17.4477 11 18C11 18.5523 11.4477 19 12 19Z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              {/* Submit Button */}
              <div className="space-y-2">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center rounded-md bg-foreground text-background hover:bg-opacity-90 px-4 py-2 text-sm font-medium transition-colors"
                  data-anim="fade"
                  data-delay="0.5"
                >
                  Отправить
                </button>
                <div className="flex px-2">
                  <a
                    href="/docs/data"
                    className="text-sm font-medium text-muted-foreground opacity-50 hover:text-primary transition-colors"
                    data-anim="fade"
                    data-delay="0.6"
                  >
                    Продолжая, вы соглашаетесь с политикой компании в отношении персональных данных и даете согласие на их обработку.
                  </a>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PartnerForm;