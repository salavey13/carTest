import { useState } from 'react';
import { useAppToast } from '@/hooks/useAppToast';
import { updateUserCyberFitnessProfile } from '@/hooks/cyberFitnessSupabase';
import type { ProcessedSandboxOpportunity } from '@/app/elon/testbase/arbitrage-viz-sandbox/page';
import { logger } from '@/lib/logger';

// Configuration for the trade simulation
const TRADE_CONFIG = {
  // The risk score is Effort/Ezness. A higher score is riskier.
  // We'll normalize it. A risk score of 5.0 is considered very high risk.
  MAX_NORMALIZED_RISK: 5.0,
  // Base KiloVibes reward/penalty is tied to the opportunity's potential profit.
  PROFIT_TO_KV_FACTOR: 0.5,
  // Add a small flat amount to make even small wins feel rewarding.
  FLAT_KV_BONUS: 5,
  // Define a cap to prevent insane KV swings from one trade.
  MAX_KV_SWING: 100,
};

export const useTradeSimulator = ({ onTradeComplete }: { onTradeComplete?: () => void }) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const { addToast } = useAppToast();

  const simulateTrade = async (userId: string, opportunity: ProcessedSandboxOpportunity) => {
    if (!userId || !opportunity) {
      addToast("System Error: User or Opportunity data missing for trade simulation.", 'error');
      return;
    }

    setIsSimulating(true);
    logger.info(`[useTradeSimulator] Initiating trade for user ${userId} on opportunity ${opportunity.id} with risk score: ${opportunity.riskScore}`);

    // 1. Calculate Win/Loss Probability
    // A lower risk score should result in a higher chance of winning.
    const riskFactor = Math.min(opportunity.riskScore, TRADE_CONFIG.MAX_NORMALIZED_RISK) / TRADE_CONFIG.MAX_NORMALIZED_RISK;
    const winProbability = 1 - riskFactor;
    const isWin = Math.random() < winProbability;

    // 2. Calculate KiloVibe Swing
    let kvChange = Math.round(
      (opportunity.potentialProfitUSD * TRADE_CONFIG.PROFIT_TO_KV_FACTOR) + TRADE_CONFIG.FLAT_KV_BONUS
    );
    // Cap the change to prevent wild swings
    kvChange = Math.min(kvChange, TRADE_CONFIG.MAX_KV_SWING);
    // Ensure at least 1 KV is at stake
    kvChange = Math.max(kvChange, 1); 

    const finalKvChange = isWin ? kvChange : -kvChange;

    logger.log(`[useTradeSimulator] Trade Result: ${isWin ? 'WIN' : 'FAIL'}. KV Change: ${finalKvChange}. (Win Prob: ${winProbability.toFixed(2)})`);

    try {
      // 3. Update User Profile on the Backend
      const updateResult = await updateUserCyberFitnessProfile(userId, {
        kiloVibes: finalKvChange,
      });

      if (updateResult.success) {
        // 4. Show Feedback Toast
        if (isWin) {
          addToast(
            `SUCCESS! +${finalKvChange} KiloVibes!`,
            'success',
            { description: `Your insight into the VIBE market paid off. Good call, Agent.` }
          );
        } else {
          addToast(
            `FAIL! -${kvChange} KiloVibes!`,
            'error',
            { description: `The market was volatile. A costly but valuable lesson.` }
          );
        }
        // Refresh user data in the app context if a callback is provided
        onTradeComplete?.();
      } else {
        throw new Error(updateResult.error || 'Failed to update user profile.');
      }
    } catch (error) {
      logger.error('[useTradeSimulator] Error during trade simulation backend update:', error);
      addToast('Trade Simulation Error', 'error', { description: 'Could not connect to the VIBE Market. Please try again.' });
    } finally {
      setIsSimulating(false);
    }
  };

  return { isSimulating, simulateTrade };
};