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
    <form onSubmit={handleSubmit} action="/referal/send" method="POST" className="col gp gp--lg">
      <input type="text" placeholder="Введите ваше имя и фамилию" className="input" />
      <small className="subtitle fs__sm fw__md opc opc--50">Укажите своё настоящее имя и фамилию — для правильного оформления документов.</small>
      <input type="tel" placeholder="Введите ваш номер телефона" className="input" />
      <small className="subtitle fs__sm fw__md opc opc--50">Укажите номер, привязанный к Telegram или WhatsApp — для быстрой связи.</small>
      <input type="email" placeholder="Ваша электронная почта" className="input" name="email" required />
      <small className="subtitle fs__sm fw__md opc opc--50">Укажите актуальный email — он будет использоваться для подтверждения и документооборота.</small>
      <select className="input">
        <option>Российская Федерация</option>
      </select>
      <button type="submit" className="btn btn--wht btn__secondary fill ctr">
        Отправить заявку
      </button>
      <small className="subtitle fs__sm fw__md opc opc--50">Продолжая, вы соглашаетесь с политикой компании в отношении обработки персональных данных и даете согласие на их обработку в соответствии с установленными правилами.</small>
    </form>
  );
};

export default PartnerForm;