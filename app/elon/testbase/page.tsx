'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabaseAdmin } from '@/hooks/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';

// This interface matches the columns in your arbitrage_opportunities VIEW
interface ArbitrageOpportunityViewData {
  symbol: string;
  exchange_a: string;
  exchange_b: string;
  bid_price_a: number;
  ask_price_a: number;
  bid_price_b: number;
  ask_price_b: number;
  potential_profit_pct_a_to_b: number;
  potential_profit_pct_b_to_a: number;
  timestamp_a: string;
  timestamp_b: string;
}

const neonBoxShadow = "shadow-lg shadow-cyan-500/50";

const ArbitrageTerminalPage = () => {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunityViewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseAdmin
        .from('arbitrage_opportunities')
        .select('*')
        .order('potential_profit_pct_a_to_b', { ascending: false }) // Show most profitable first
        .limit(10);

      if (error) {
        console.error('Error fetching arbitrage opportunities:', error);
      } else {
        setOpportunities(data as ArbitrageOpportunityViewData[]);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('An unexpected error occurred:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);
  
  const formatPercent = (num: number | null) => {
    if (num === null || isNaN(num)) return 'N/A';
    return `${num.toFixed(3)}%`;
  }

  const getProfitColor = (profit: number) => {
    if (profit > 1) return 'text-lime-400';
    if (profit > 0.5) return 'text-green-400';
    if (profit > 0.1) return 'text-yellow-400';
    return 'text-orange-400';
  }

  return (
    <div className="bg-gradient-to-br from-black via-blue-900 to-black min-h-screen py-24 text-white font-mono">
      <div className="container mx-auto px-4">
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          className={`text-4xl md:text-5xl font-orbitron text-white text-shadow-md mb-4 text-center ${neonBoxShadow} tracking-tight glitch`}
          data-text="Arbitrage Opportunity Terminal"
        >
          Arbitrage Opportunity Terminal
        </motion.h1>
        <div className="text-center mb-8">
            <Button onClick={fetchOpportunities} disabled={loading} variant="outline" className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 hover:text-white">
                <VibeContentRenderer content={loading ? "::FaSpinner className='animate-spin mr-2'::" : "::FaSync className='mr-2'::"} />
                {loading ? 'Scanning...' : 'Refresh Scan'}
            </Button>
            {lastUpdated && <p className="text-xs text-gray-500 mt-2">Last Updated: {lastUpdated.toLocaleTimeString()}</p>}
        </div>

        <div className="space-y-4">
          <AnimatePresence>
            {loading && opportunities.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center text-lg text-cyan-300 py-16"
              >
                <VibeContentRenderer content="::FaSpinner className='animate-spin text-4xl'::" />
              </motion.div>
            ) : !loading && opportunities.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16 text-gray-500"
                >
                    <VibeContentRenderer content="::FaCoffee className='text-5xl mx-auto mb-4'::" />
                    <h3 className="text-xl">Markets are stable.</h3>
                    <p>No significant arbitrage opportunities detected.</p>
                </motion.div>
            ) : (
              opportunities.map((op, index) => {
                const profit = op.potential_profit_pct_a_to_b > op.potential_profit_pct_b_to_a ? op.potential_profit_pct_a_to_b : op.potential_profit_pct_b_to_a;
                const isAtoB = op.potential_profit_pct_a_to_b > op.potential_profit_pct_b_to_a;
                
                return (
                  <motion.div
                    key={`${op.symbol}-${op.exchange_a}-${op.exchange_b}`}
                    layout
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.5, delay: index * 0.1, type: "spring" }}
                    className="bg-gray-900/70 border-2 border-purple-600/50 rounded-lg p-4 backdrop-blur-sm shadow-lg hover:shadow-purple-500/30 transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                      <div className="mb-2 md:mb-0">
                        <h2 className="text-2xl font-orbitron text-cyan-300">{op.symbol}</h2>
                        <div className="flex items-center text-lg space-x-2">
                           <span className="font-bold">{isAtoB ? op.exchange_a : op.exchange_b}</span>
                           <VibeContentRenderer content="::FaArrowRightLong className='text-purple-400'::" />
                           <span className="font-bold">{isAtoB ? op.exchange_b : op.exchange_a}</span>
                        </div>
                      </div>
                      <div className={`text-4xl font-bold text-right ${getProfitColor(profit)}`} style={{textShadow: `0 0 10px ${getProfitColor(profit)}`}}>
                        {formatPercent(profit)}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-purple-800/60 text-xs grid grid-cols-2 gap-2 text-gray-400">
                        <p>Buy Price: <span className="text-white font-semibold">${(isAtoB ? op.ask_price_a : op.ask_price_b).toLocaleString()}</span></p>
                        <p>Sell Price: <span className="text-white font-semibold">${(isAtoB ? op.bid_price_b : op.bid_price_a).toLocaleString()}</span></p>
                        <p>Timestamp A: <span className="text-gray-500">{new Date(op.timestamp_a).toLocaleTimeString()}</span></p>
                        <p>Timestamp B: <span className="text-gray-500">{new Date(op.timestamp_b).toLocaleTimeString()}</span></p>
                    </div>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ArbitrageTerminalPage;