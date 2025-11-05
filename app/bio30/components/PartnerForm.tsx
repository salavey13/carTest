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
    <form onSubmit={handleSubmit} action="/referal/send" method="POST">
      <div className="row ctr gp gp--xs">
        <input type="text" name="email" placeholder="Email" className="input" required />
        <button type="submit" className="btn btn--primary">Отправить</button>
      </div>
    </form>
  );
};

export default PartnerForm;