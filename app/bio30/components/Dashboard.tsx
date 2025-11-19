"use client";

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getReferralStats } from '../actions'; // Now correctly imported
import { motion } from 'framer-motion';

const Dashboard: React.FC = () => {
  const { dbUser } = useAppContext();
  const [stats, setStats] = useState({ referralsCount: 0, totalEarned: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      if (dbUser?.user_id) {
        const result = await getReferralStats(dbUser.user_id);
        if (result.success && result.data) {
          setStats(result.data);
        }
      }
    };
    fetchStats();
  }, [dbUser]);

  const referralLink = `https://bio30.ru/?ref=${dbUser?.user_id || ''}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <motion.div 
      className="dashboard-container col gp gp--lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h3 className="title fs__xl fw__bd bw0">Партнерский кабинет</h3>
      
      <div className="stats-grid grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--md)' }}>
        <motion.div 
          className="stat-card card card__default"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="col gp gp--sm">
            <span className="stat-value fs__xxl fw__bd">{stats.referralsCount}</span>
            <span className="stat-label fs__md fw__md opc opc--75">Привлечено партнеров</span>
          </div>
        </motion.div>
        
        <motion.div 
          className="stat-card card card__default"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="col gp gp--sm">
            <span className="stat-value fs__xxl fw__bd">{stats.totalEarned} ₽</span>
            <span className="stat-label fs__md fw__md opc opc--75">Заработано</span>
          </div>
        </motion.div>
      </div>

      <div className="referral-link-section col gp gp--md">
        <p className="subtitle fs__md fw__md opc opc--75">Ваша реферальная ссылка:</p>
        <div className="input-group row gp gp--xs">
          <input 
            type="text" 
            value={referralLink}
            readOnly
            className="input"
          />
          <motion.button 
            type="button" 
            className={`btn btn--blk btn__primary ${copied ? 'btn--green' : ''}`}
            onClick={handleCopy}
            whileTap={{ scale: 0.95 }}
          >
            {copied ? 'Скопировано!' : 'Копировать'}
          </motion.button>
        </div>
      </div>

      <div className="commissions-info col gp gp--sm">
        <p className="text fs__sm fw__rg opc opc--50">
          * Вы получаете 30% с прямых продаж, 10% со 2-го и 10% с 3-го уровня
        </p>
      </div>
    </motion.div>
  );
};

export default Dashboard;