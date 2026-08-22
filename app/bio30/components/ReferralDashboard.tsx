"use client";

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { 
  getReferralStats, 
  getReferralNetwork, 
  generateReferralCode,
  logReferralActivity,
  getReferralLeaderboard
} from '../ref_actions';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Users, DollarSign, TrendingUp, Gift, Share2, Trophy } from 'lucide-react';

interface ReferralStats {
  level1Count: number;
  level2Count: number;
  level3Count: number;
  totalReferrals: number;
  level1Earnings: number;
  level2Earnings: number;
  level3Earnings: number;
  totalEarnings: number;
  paidEarnings: number;
  pendingEarnings: number;
  currentBalance: number;
  lifetimeEarnings: number;
  recentActivities: Array<{
    id: string;
    activity_type: string;
    points_earned: number;
    created_at: string;
    activity_data: any;
  }>;
  referralCode: string | null;
}

interface ReferralNetwork {
  level1: Array<{ userId: string; username?: string; avatar?: string; joinedAt: string }>;
  level2: Array<{ userId: string; username?: string; avatar?: string; joinedAt: string }>;
  level3: Array<{ userId: string; username?: string; avatar?: string; joinedAt: string }>;
}

const ReferralDashboard: React.FC = () => {
  const { dbUser } = useAppContext();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [network, setNetwork] = useState<ReferralNetwork | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'leaderboard'>('overview');

  useEffect(() => {
    if (dbUser?.user_id) {
      loadData();
    }
  }, [dbUser]);

  const loadData = async () => {
    if (!dbUser?.user_id) return;
    
    setLoading(true);
    try {
      // Load referral stats
      const statsResult = await getReferralStats(dbUser.user_id);
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }

      // Load referral network
      const networkResult = await getReferralNetwork(dbUser.user_id);
      if (networkResult.success && networkResult.data) {
        setNetwork(networkResult.data);
      }

      // Load leaderboard
      const leaderboardResult = await getReferralLeaderboard(10);
      if (leaderboardResult.success && leaderboardResult.data) {
        setLeaderboard(leaderboardResult.data);
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReferralLink = async () => {
    if (!stats?.referralCode) return;
    
    const referralLink = `https://bio30.ru/?ref=${stats.referralCode}`;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      
      // Log social share activity
      await logReferralActivity(dbUser!.user_id, 'social_share', {
        platform: 'clipboard',
        link: referralLink
      });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSocialShare = async (platform: string) => {
    if (!stats?.referralCode) return;
    
    const referralLink = `https://bio30.ru/?ref=${stats.referralCode}`;
    const message = `Присоединяйся к BIO30 и получи скидку! Мой реферальный код: ${stats.referralCode}`;
    
    // Log social share activity
    await logReferralActivity(dbUser!.user_id, 'social_share', {
      platform,
      link: referralLink
    });

    // Open share dialog based on platform
    let shareUrl = '';
    switch (platform) {
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(message)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(message + ' ' + referralLink)}`;
        break;
      case 'vk':
        shareUrl = `https://vk.com/share.php?url=${encodeURIComponent(referralLink)}&title=${encodeURIComponent(message)}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Не удалось загрузить данные реферальной программы</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="referral-dashboard space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Партнерский кабинет</h1>
          <p className="text-muted-foreground">
            Приглашай друзей и зарабатывай до 30% с каждой покупки
          </p>
        </div>
        
        {/* Referral Link */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-card rounded-lg p-3 border">
            <span className="text-sm font-mono text-muted-foreground">
              {stats.referralCode || 'Загрузка...'}
            </span>
            <button
              onClick={handleCopyReferralLink}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              title="Скопировать реферальную ссылку"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          className="stat-card bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-blue-500" />
            <span className="text-sm text-muted-foreground">Уровень 1</span>
          </div>
          <div className="text-2xl font-bold mb-1">{stats.level1Count}</div>
          <div className="text-sm text-muted-foreground">Прямых партнеров</div>
          <div className="text-xs text-blue-400 mt-2">
            +{stats.level1Count * 30}% к заработку
          </div>
        </motion.div>

        <motion.div 
          className="stat-card bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-green-500" />
            <span className="text-sm text-muted-foreground">Уровень 2-3</span>
          </div>
          <div className="text-2xl font-bold mb-1">
            {stats.level2Count + stats.level3Count}
          </div>
          <div className="text-sm text-muted-foreground">Косвенных партнеров</div>
          <div className="text-xs text-green-400 mt-2">
            +{(stats.level2Count + stats.level3Count) * 10}% к заработку
          </div>
        </motion.div>

        <motion.div 
          className="stat-card bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-yellow-500/20"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-8 h-8 text-yellow-500" />
            <span className="text-sm text-muted-foreground">Баланс</span>
          </div>
          <div className="text-2xl font-bold mb-1">
            {formatCurrency(stats.currentBalance)}
          </div>
          <div className="text-sm text-muted-foreground">Доступно для вывода</div>
          <div className="text-xs text-yellow-400 mt-2">
            Всего: {formatCurrency(stats.lifetimeEarnings)}
          </div>
        </motion.div>

        <motion.div 
          className="stat-card bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-purple-500" />
            <span className="text-sm text-muted-foreground">Заработок</span>
          </div>
          <div className="text-2xl font-bold mb-1">
            {formatCurrency(stats.totalEarnings)}
          </div>
          <div className="text-sm text-muted-foreground">Всего заработано</div>
          <div className="text-xs text-purple-400 mt-2">
            Ожидает: {formatCurrency(stats.pendingEarnings)}
          </div>
        </motion.div>
      </div>

      {/* Social Share */}
      <motion.div 
        className="bg-card rounded-xl p-6 border"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Share2 className="w-5 h-5" />
          Поделись с друзьями
        </h3>
        <p className="text-muted-foreground mb-4">
          Расскажи о BIO30 друзьям и получай бонусы за каждого приглашенного
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleSocialShare('telegram')}
            className="flex items-center gap-2 px-4 py-2 bg-[#0088cc] text-white rounded-lg hover:bg-[#0066aa] transition-colors"
          >
            Telegram
          </button>
          <button
            onClick={() => handleSocialShare('whatsapp')}
            className="flex items-center gap-2 px-4 py-2 bg-[#25d366] text-white rounded-lg hover:bg-[#1da955] transition-colors"
          >
            WhatsApp
          </button>
          <button
            onClick={() => handleSocialShare('vk')}
            className="flex items-center gap-2 px-4 py-2 bg-[#45668e] text-white rounded-lg hover:bg-[#344d6b] transition-colors"
          >
            ВКонтакте
          </button>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'overview'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Обзор
        </button>
        <button
          onClick={() => setActiveTab('network')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'network'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Моя сеть
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'leaderboard'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Лидеры
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Recent Activity */}
            <div className="bg-card rounded-xl p-6 border">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Недавняя активность
              </h3>
              <div className="space-y-3">
                {stats.recentActivities.length > 0 ? (
                  stats.recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm">
                          {activity.activity_type === 'referral_signup' && 'Новый партнер присоединился'}
                          {activity.activity_type === 'social_share' && 'Поделился ссылкой'}
                          {activity.activity_type === 'purchase_made' && 'Партнер совершил покупку'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(activity.created_at)}
                        </p>
                      </div>
                      {activity.points_earned > 0 && (
                        <div className="text-sm font-medium text-green-600">
                          +{activity.points_earned} баллов
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Пока нет активности. Начни приглашать партнеров!
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && (
          <motion.div
            key="network"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Level 1 */}
            <div className="bg-card rounded-xl p-6 border">
              <h3 className="text-lg font-semibold mb-4 text-blue-500">
                Уровень 1 (Прямые партнеры) - {network?.level1.length || 0} человек
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {network?.level1.map((user) => (
                  <div key={user.userId} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {user.username?.[0] || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{user.username || 'Аноним'}</p>
                      <p className="text-xs text-muted-foreground">
                        Присоединился {formatDate(user.joinedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Level 2 */}
            <div className="bg-card rounded-xl p-6 border">
              <h3 className="text-lg font-semibold mb-4 text-green-500">
                Уровень 2 - {network?.level2.length || 0} человек
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {network?.level2.map((user) => (
                  <div key={user.userId} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {user.username?.[0] || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{user.username || 'Аноним'}</p>
                      <p className="text-xs text-muted-foreground">
                        Присоединился {formatDate(user.joinedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Level 3 */}
            <div className="bg-card rounded-xl p-6 border">
              <h3 className="text-lg font-semibold mb-4 text-purple-500">
                Уровень 3 - {network?.level3.length || 0} человек
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {network?.level3.map((user) => (
                  <div key={user.userId} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {user.username?.[0] || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{user.username || 'Аноним'}</p>
                      <p className="text-xs text-muted-foreground">
                        Присоединился {formatDate(user.joinedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="bg-card rounded-xl p-6 border">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Топ партнеров
              </h3>
              <div className="space-y-3">
                {leaderboard.map((user, index) => (
                  <div 
                    key={user.userId} 
                    className={`flex items-center gap-4 p-4 rounded-lg ${
                      user.userId === dbUser?.user_id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'bg-muted/30'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-600 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-white font-semibold">
                      {user.username?.[0] || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {user.username || 'Аноним'}
                        {user.userId === dbUser?.user_id && (
                          <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            Вы
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.totalReferrals} партнеров
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(user.totalEarnings)}</p>
                      <p className="text-xs text-muted-foreground">заработано</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ReferralDashboard;