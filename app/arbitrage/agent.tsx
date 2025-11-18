"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import { ethers } from "ethers";
// flashbots/providers may expect ethers v5 — here we try to initialize but fallback to stub
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import axios from 'axios';

interface ArbitrageOpportunity {
  pair: string;
  dex1: string;
  dex2: string;
  spread: number;
  route: string[];
  profitUSD: number;
}

const DEFAULT_DEXES = ['uniswap', 'sushiswap'];
const PROVIDER_URL = process.env.NEXT_PUBLIC_INFURA_URL || process.env.NEXT_PUBLIC_RPC_URL;

export default function ArbitrageAgent() {
  const { dbUser, arbitrageSettings } = useAppContext();
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [ethersProvider, setEthersProvider] = useState<ethers.JsonRpcProvider | null>(null);
  const [flashbotsProvider, setFlashbotsProvider] = useState<any | null>(null);
  const [wallet, setWallet] = useState<ethers.Wallet | null>(null);

  useEffect(() => {
    if (PROVIDER_URL) {
      const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
      setEthersProvider(provider);

      provider.getNetwork().then(network => {
        // example: require Sepolia (11155111) for testnet in this POC — adjust or remove as needed
        if (network.chainId !== 11155111) {
          toast.warning('Agent prefers testnet (Sepolia) in this POC — continue at your own risk.');
        }
      });

      const privateKey = process.env.TESTNET_PRIVATE_KEY;
      if (privateKey) {
        try {
          const w = new ethers.Wallet(privateKey, provider);
          setWallet(w);
        } catch (e) {
          console.warn('Invalid TESTNET_PRIVATE_KEY', e);
        }
      }

      // Flashbots provider: try init, but on failure keep null (we'll fallback to stub execution)
      (async () => {
        try {
          // Note: flashbots bundle provider historically was built for ethers v5;
          // this may work but if not — we swallow and keep stub behavior.
          const authSigner = wallet ?? new ethers.Wallet(ethers.randomBytes(32));
          const fb = await FlashbotsBundleProvider.create(provider as any, authSigner as any);
          setFlashbotsProvider(fb);
        } catch (e) {
          console.warn('Flashbots init failed (stub):', e);
          setFlashbotsProvider(null);
        }
      })();
    }
  }, []); // eslint-disable-line

  const fetchPrices = useCallback(async () => {
    try {
      const response = await axios.get('/api/fetch-dex-prices');
      // return markets array
      return response.data?.markets ?? [];
    } catch (e) {
      logger.error('Failed to fetch prices', e);
      return [];
    }
  }, []);

  const findOpportunities = useCallback(async () => {
    const markets = await fetchPrices();
    const newOpps: ArbitrageOpportunity[] = [];
    const trackedPairs = arbitrageSettings?.trackedPairs || ['TON/WETH', 'ETH/USDC'];

    for (const pair of trackedPairs) {
      const data1 = markets.find((p: any) => p.symbol === pair && p.exchange === DEFAULT_DEXES[0]);
      const data2 = markets.find((p: any) => p.symbol === pair && p.exchange === DEFAULT_DEXES[1]);
      if (data1 && data2) {
        const spread = Math.abs(data1.midPriceFloat - data2.midPriceFloat) / Math.min(data1.midPriceFloat, data2.midPriceFloat) * 100;
        if (spread > (arbitrageSettings?.minSpreadPercent || 0.5)) {
          newOpps.push({
            pair,
            dex1: DEFAULT_DEXES[0],
            dex2: DEFAULT_DEXES[1],
            spread,
            route: ['Flash Loan Aave', `Swap ${DEFAULT_DEXES[0]}`, `Swap ${DEFAULT_DEXES[1]}`, 'Repay'],
            profitUSD: (spread / 100) * (arbitrageSettings?.defaultTradeVolumeUSD || 1000) - 10,
          });
        }
      }
    }

    setOpportunities(newOpps);
  }, [fetchPrices, arbitrageSettings]);

  const buildCubes = (opp: ArbitrageOpportunity) => {
    // stub: return an array of encoded-like items (we simulate)
    return [
      { to: 'POOL', data: '0xflashloan' },
      { to: 'DEX1', data: '0xswap1' },
      { to: 'DEX2', data: '0xswap2' },
      { to: 'POOL', data: '0xrepay' },
    ];
  };

  const simulateAndExecute = async (opp: ArbitrageOpportunity) => {
    if (!ethersProvider) {
      toast.error('No RPC provider available');
      return;
    }
    const calldata = buildCubes(opp);
    try {
      // light-weight simulation (stub)
      // Real: construct multicall or actual tx and use provider.call(...) to simulate.
      const estimateProfitUSD = (opp.profitUSD ?? 0);
      if (estimateProfitUSD <= 0) {
        toast.warning("No profit in simulation.");
        return;
      }

      // Execution:
      if (!wallet || !flashbotsProvider) {
        // fallback: show stub message — we've simulated profit; real send requires flashbots or signed tx
        toast.success(`Simulated OK. Est profit: $${estimateProfitUSD.toFixed(2)} — Execution is stubbed (no tx sent).`);
        return;
      }

      // If we have flashbotsProvider, build signed tx bundle — THIS IS A POC STUB:
      // In practice we'd assemble raw txs, sign them with wallet, and submit bundle targeting next block.
      toast.success(`Flashbots available — but sending bundle is disabled in POC. Sim profit: $${estimateProfitUSD.toFixed(2)}`);
    } catch (error) {
      toast.error("Error in execution.");
      logger.error(error);
    }
  };

  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(findOpportunities, 10_000);
      return () => clearInterval(interval);
    }
  }, [isScanning, findOpportunities]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arbitrage Agent</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setIsScanning(!isScanning)}>
          <VibeContentRenderer content="::FaSearchDollar::" /> {isScanning ? 'Stop' : 'Start Agent'}
        </Button>
        <ScrollArea className="h-64 mt-4">
          {opportunities.map((opp, i) => (
            <div key={i} className="mb-2">
              <p>{opp.pair} - Spread: {opp.spread.toFixed(3)}% - Est. Profit: ${opp.profitUSD.toFixed(2)}</p>
              <Button onClick={() => simulateAndExecute(opp)}>Execute (POC)</Button>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}