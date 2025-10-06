/**
 * Простая логика: Swap TON -> ETH (MVP).
 *
 * Переведено на ethers@6 — использует ethers.parseUnits / ethers.formatUnits / ethers.Interface
 */
import * as core from '../../core';
import axios from 'axios';
import { ethers } from 'ethers';

export type SwapTonFields = {
  input: { token: { address: string; symbol: string; decimals: number; isNative?: boolean }; amount: string };
  output: { token: { address: string; symbol: string; decimals: number; isNative?: boolean }; amount?: string };
  slippage?: number; // bps
};

export class SwapTonLogic extends core.Logic {
  static id = 'swap-ton';
  static protocolId = 'ton-swap';
  static supportedChainIds = [11155111, 1];

  constructor(chainId: number, provider?: any) {
    super(chainId, provider);
  }

  async getTokenList() {
    return [
      { address: '0xTON000000000000000000000000000000000000', symbol: 'TON', decimals: 9, isNative: false },
      { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18, isNative: false },
    ];
  }

  async quote(fields: SwapTonFields) {
    try {
      const resp = await axios.get('/api/fetch-dex-prices');
      const markets = resp.data?.markets ?? [];
      const pairKey = `${fields.input.token.symbol}/ETH`;
      const p = markets.find((m: any) => m.symbol === pairKey);
      if (!p) throw new Error('no price');

      const inputAmount = ethers.parseUnits(fields.input.amount, fields.input.token.decimals); // bigint
      const price = p.midPriceFloat; // approximate number: 1 inputToken == price ETH
      const outputAmountFloat = Number(fields.input.amount) * price;
      const outputAmount = ethers.parseUnits(String(outputAmountFloat), fields.output.token.decimals);

      return {
        input: { token: fields.input.token, amountWei: inputAmount.toString() },
        output: { token: fields.output.token, amountWei: outputAmount.toString() },
      };
    } catch (e) {
      // fallback stub: 1 TON = 0.02 ETH
      const inputAmount = ethers.parseUnits(fields.input.amount, fields.input.token.decimals);
      const outputAmount = ethers.parseUnits(String(Number(fields.input.amount) * 0.02), fields.output.token.decimals);
      return {
        input: { token: fields.input.token, amountWei: inputAmount.toString() },
        output: { token: fields.output.token, amountWei: outputAmount.toString() },
      };
    }
  }

  async build(fields: SwapTonFields, options: { account?: string }) {
    const DEX_ROUTER = '0x1111111111111111111111111111111111111111'; // placeholder
    const iface = new ethers.Interface([
      'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
      'function swapExactETHForTokens(uint256,address[],address,uint256) payable',
    ]);
    const path = [fields.input.token.address, fields.output.token.address];
    const amountIn = (fields.input as any).amountWei;
    const amountOutMin = (fields.output as any).amountWei;
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
    const data = iface.encodeFunctionData('swapExactTokensForTokens', [
      amountIn,
      amountOutMin,
      path,
      options.account ?? '0x0000000000000000000000000000000000000000',
      deadline,
    ]);
    const inputs = [
      core.newLogicInput({ input: { token: fields.input.token, amountWei: amountIn }, balanceBps: core.BPS_NOT_USED }),
    ];
    return core.newLogic({ to: DEX_ROUTER, data, inputs, approveTo: fields.input.token.address });
  }
}