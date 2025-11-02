"use client";

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { updateUserSettings } from '@/app/actions';
import '../styles.css';

const PartnerForm: React.FC = () => {
  const { dbUser, refreshDbUser } = useAppContext();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    if (!dbUser?.user_id) return;

    try {
      const result = await updateUserSettings(dbUser.user_id, { is_referral_partner: true, partner_email: email });
      if (result.success) {
        await refreshDbUser();
        // Show success message or redirect
      } else {
        // Handle error
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