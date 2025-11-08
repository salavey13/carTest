// /app/bio30/components/PartnerForm.tsx
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
      // Send to /api/send-contact
      const response = await fetch('/api/send-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fromTelegram: true, telegramUser: dbUser.user_id }),
      });

      if (response.ok) {
        const partnerResult = await becomeReferralPartner(dbUser.user_id, email);
        if (partnerResult.success) {
          await refreshDbUser();
          // Success
        } else {
          // Error
        }
      } else {
        // Error
      }
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div className="container container--welcome pd pd__hg gp gp--hg ctr">
      <div className="aside" data-anim="fade" data-delay="0.1">
        <div className="col gp gp--xs">
          <h2 className="title fs__xxl fw__bd bw0" data-anim="lux-up" data-delay="0.1">
            Станьте частью большой и крепкой семьи
          </h2>
          <h3 className="subtitle fs__lg fw__rg opc opc--50 bw0" data-anim="lux-up" data-delay="0.1">
            Приглашайте партнёров и получайте бонусы с их каждой сделки.
          </h3>
        </div>
      </div>
      <div className="bside bside--welcome" data-anim="fade" data-delay="0.2">
        <form onSubmit={handleSubmit} className="col gp gp--lg" data-anim="fade" data-delay="0.1">
          <div className="form-group">
            <input type="text" id="name" name="name" className="input" placeholder="Введите ваше имя и фамилию" required />
            <div className="row pd pd__sm--lft pd__sm--rgt mg mg__xs--top">
              <small className="subtitle fs__sm fw__md bw0 opc opc--50" data-anim="fade" data-delay="0.2">
                Пожалуйста, укажите ваше настоящее имя и фамилию. Это позволит избежать ошибок при доставке и обеспечит корректное оформление документов.
              </small>
            </div>
          </div>
          <div className="form-group">
            <input type="tel" id="phone" name="phone" className="input" placeholder="Введите ваш номер телефона" pattern="\+?[0-9]{10,15}" required />
            <div className="row pd pd__sm--lft pd__sm--rgt mg mg__xs--top">
              <small className="subtitle fs__sm fw__md bw0 opc opc--50" data-anim="fade" data-delay="0.3">
                Рекомендуется использовать номер телефона, на который зарегистрированы Telegram и/или WhatsApp. Это упростит процесс коммуникации и позволит вам быстро получать важные уведомления.
              </small>
            </div>
          </div>
          <div className="form-group">
            <input type="email" id="email" name="email" className="input" placeholder="Ваша электронная почта" required />
            <div className="row pd pd__sm--lft pd__sm--rgt mg mg__xs--top">
              <small className="subtitle fs__sm fw__md bw0 opc opc--50" data-anim="fade" data-delay="0.4">
                На указанную почту будет отправлена ссылка для подтверждения аккаунта и юридические документы. Это необходимо для завершения регистрации и обеспечения безопасности ваших данных.
              </small>
            </div>
          </div>
          <div className="select-container">
            <select id="location" name="location" className="input select-input" required>
              <option value="russia" selected>Российская Федерация</option>
              <option value="armenia">Республика Армения</option>
              <option value="belarus">Республика Беларусь</option>
              <option value="indonesia">Республика Индонезия</option>
              <option value="kazakhstan">Республика Казахстан</option>
              <option value="kyrgyzstan">Кыргызская Республика</option>
              <option value="thailand">Королевство Таиланд</option>
              <option value="sri_lanka">Шри-Ланка</option>
            </select>
            <svg className="select-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" fill="white"/>
              <path d="M12 7C12.5523 7 13 6.55228 13 6C13 5.44772 12.5523 5 12 5C11.4477 5 11 5.44772 11 6C11 6.55228 11.4477 7 12 7Z" fill="white"/>
              <path d="M12 19C12.5523 19 13 18.5523 13 18C13 17.4477 12.5523 17 12 17C11.4477 17 11 17.4477 11 18C11 18.5523 11.4477 19 12 19Z" fill="white"/>
            </svg>
          </div>
          <div>
            <button type="submit" className="btn btn--wht btn__secondary fill ctr" data-anim="fade" data-delay="0.5">
              Отправить
            </button>
            <div className="row pd pd__sm--lft pd__sm--rgt mg mg__xs--top">
              <a href="/docs/data" className="subtitle fs__sm fw__md bw0 opc opc--50 anmt" data-anim="fade" data-delay="0.6">
                Продолжая, вы соглашаетесь с политикой компании в отношении персональных данных и даете согласие на их обработку.
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartnerForm;