/**
 * Minimal Next.js client page — агент для симуляции:
 * - подтягивает цены через /api/fetch-dex-prices
 * - собирает простой pipeline: flashLoanMock -> swapTon -> repay (визуальная симуляция)
 *
 * Это UI для right-here-right-now: кнопка "Simulate" вызывает сборку и выводит JSON с логиками.
 */

'use client';

import React, { useState } from 'react';
import axios from 'axios';

export default function FlashloanAgentPage() {
  const [log, setLog] = useState<string>('');
  const [isSim, setIsSim] = useState(false);

  async function simulate() {
    setIsSim(true);
    setLog('Fetching prices...');
    try {
      const resp = await axios.get('/api/fetch-dex-prices');
      setLog((s) => s + '\nPrices fetched.');
      // build sample pipeline
      const pipeline = {
        steps: [
          { type: 'flashLoan', provider: 'mock', loans: [{ token: 'TON', amount: '10' }] },
          { type: 'swap', from: 'TON', to: 'WETH', amount: '10' },
          { type: 'repay', token: 'WETH' },
        ],
        prices: resp.data,
      };
      setLog(JSON.stringify(pipeline, null, 2));
    } catch (e: any) {
      setLog('Error fetching prices: ' + (e?.message ?? String(e)));
    } finally {
      setIsSim(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Flashloan Agent — MVP</h1>
      <p>Симуляция: TON → WETH (swap) внутри flash loan цепочки.</p>
      <button onClick={simulate} disabled={isSim}>
        {isSim ? 'Simulating...' : 'Simulate'}
      </button>
      <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{log}</pre>
    </div>
  );
}