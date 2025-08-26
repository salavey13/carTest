"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { debugLogger as logger } from "@/lib/debugLogger";
import { ethers } from "ethers"; // Обновлено для ethers@6
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { Pool } from '@uniswap/v3-sdk';
import { TradeType, CurrencyAmount } from '@uniswap/sdk-core';
import axios from 'axios';

interface ArbitrageOpportunity {
  pair: string;
  dex1: string;
  dex2: string;
  spread: number;
  route: string[];
  profitUSD: number;
}

interface Cube {
  type: 'flash_loan' | 'swap' | 'repay';
  params: any;
}

const DEFAULT_DEXES = ['uniswap', 'sushiswap'];
const PROVIDER_URL = process.env.NEXT_PUBLIC_INFURA_URL;

export default function ArbitrageAgent() {
  const { dbUser, arbitrageSettings } = useAppContext();
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [ethersProvider, setEthersProvider] = useState<ethers.JsonRpcProvider | null>(null); // Обновлено
  const [flashbotsProvider, setFlashbotsProvider] = useState<FlashbotsBundleProvider | null>(null);
  const [wallet, setWallet] = useState<ethers.Wallet | null>(null);

  useEffect(() => {
    if (PROVIDER_URL) {
      const provider = new ethers.JsonRpcProvider(PROVIDER_URL); // Обновлено
      setEthersProvider(provider);

      provider.getNetwork().then(network => {
        if (network.chainId !== 11155111) { // Sepolia testnet
          toast.error('Agent only on testnet!');
          return;
        }
      });

      const privateKey = process.env.TESTNET_PRIVATE_KEY;
      if (privateKey) {
        setWallet(new ethers.Wallet(privateKey, provider));
      }

      FlashbotsBundleProvider.create(provider, new ethers.Wallet(privateKey || ethers.randomBytes(32), provider)).then(setFlashbotsProvider); // Обновлено
    }
  }, []);

  const fetchPrices = useCallback(async () => {
    try {
      const response = await axios.get('/api/fetch-dex-prices');
      return response.data;
    } catch (e) {
      logger.error('Failed to fetch prices', e);
      return [];
    }
  }, []);

  const findOpportunities = useCallback(async () => {
    const prices = await fetchPrices();
    const newOpps: ArbitrageOpportunity[] = [];
    const trackedPairs = arbitrageSettings?.trackedPairs || [];

    for (const pair of trackedPairs) {
      const data1 = prices.find((p: any) => p.symbol === pair && p.exchange === DEFAULT_DEXES[0]);
      const data2 = prices.find((p: any) => p.symbol === pair && p.exchange === DEFAULT_DEXES[1]);

      if (data1 && data2) {
        const spread = Math.abs(data1.last_price - data2.last_price) / Math.min(data1.last_price, data2.last_price) * 100;
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

  const buildCubes = (opp: ArbitrageOpportunity): any[] => {
    return [];
  };

  const simulateAndExecute = async (opp: ArbitrageOpportunity) => {
    if (!ethersProvider || !wallet || !flashbotsProvider) return;
    const calldata = buildCubes(opp);

    try {
      const simTx = { from: wallet.address, data: calldata[0] };
      const simResult = await ethersProvider.call(simTx);
      const profit = parseFloat(ethers.formatEther(simResult)); // Обновлено
      if (profit <= 0) {
        toast.warning("No profit in simulation.");
        return;
      }

      const signedTx = await wallet.signTransaction({ ...simTx, gasPrice: await ethersProvider.getGasPrice() });
      const bundle = [{ signedTransaction: signedTx }];
      const bundleResponse = await flashbotsProvider.sendBundle(bundle, await ethersProvider.getBlockNumber() + 1);
      if ('error' in bundleResponse) throw bundleResponse.error;

      toast.success(`Executed! Profit: $${profit}`);
    } catch (error) {
      toast.error("Error in execution.");
      logger.error(error);
    }
  };

  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(findOpportunities, 10000);
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
              <p>{opp.pair} - Spread: {opp.spread}% - Est. Profit: ${opp.profitUSD}</p>
              <Button onClick={() => simulateAndExecute(opp)}>Execute (Testnet)</Button>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}