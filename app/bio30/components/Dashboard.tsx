"use client";

import React, { useEffect, useState } from 'react';
import { getReferralStats } from '../actions';
import { useAppContext } from '@/contexts/AppContext';
import '../styles.css';

const Dashboard: React.FC = () => {
  const { dbUser } = useAppContext();
  const [stats, setStats] = useState<{ referralsCount: number; totalEarned: number } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!dbUser?.user_id) return;
      const result = await getReferralStats(dbUser.user_id);
      if (result.success && result.data) {
        setStats(result.data);
      }
    };
    fetchStats();
  }, [dbUser]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <span className="title fs__lg fw__bd">Партнерский дашборд</span>
      <div className="stats row gp gp--md">
        <span>Количество приглашенных: {stats.referralsCount}</span>
        <span>Заработано: {stats.totalEarned} руб.</span>
      </div>
      <span className="referral-link">Ваша реферальная ссылка: https://bio30.ru/?ref={dbUser?.user_id}</span>
      {/* Add list of referrals if needed */}
    </div>
  );
};

export default Dashboard;