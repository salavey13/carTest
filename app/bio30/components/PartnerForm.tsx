"use client";

import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { becomeReferralPartner } from '../actions';
import { motion } from 'framer-motion';

export const PartnerForm: React.FC = () => {
  const { dbUser, refreshDbUser } = useAppContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!dbUser?.user_id) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    try {
      const response = await fetch('/api/send-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          fromTelegram: true, 
          telegramUser: dbUser.user_id 
        }),
      });

      if (response.ok) {
        const partnerResult = await becomeReferralPartner(dbUser.user_id, email);
        if (partnerResult.success) {
          await refreshDbUser();
          // Показать успех
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container container--welcome pd pd__hg gp gp--hg ctr">
      <motion.div 
        className="aside" 
        data-anim="fade" 
        data-delay="0.1"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="col gp gp--xs">
          {/* ЗАГОЛОВОК ТОЛЬКО ЗДЕСЬ, без дублирования на странице */}
          <h2 className="title fs__xxl fw__bd bw0" data-anim="lux-up" data-delay="0.1">
            Станьте частью большой и крепкой семьи
          </h2>
          <h3 className="subtitle fs__lg fw__rg opc opc--50 bw0" data-anim="lux-up" data-delay="0.1">
            Приглашайте партнёров и получайте бонусы с их каждой сделки.
          </h3>
        </div>
      </motion.div>
      
      <motion.div 
        className="bside bside--welcome" 
        data-anim="fade" 
        data-delay="0.2"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <form onSubmit={handleSubmit} className="col gp gp--lg">
          <div className="form-group">
            <input 
              type="email" 
              id="email" 
              name="email" 
              className="input w-full" 
              placeholder="Ваша электронная почта" 
              required 
            />
          </div>
          <button 
            type="submit" 
            className="btn btn--wht btn__secondary fill ctr" 
            disabled={isSubmitting}
            data-anim="fade" 
            data-delay="0.5"
          >
            {isSubmitting ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default PartnerForm;