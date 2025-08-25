/**
 * Простая логика: Swap TON -> ETH (MVP).
 *
 * Предположения:
 * - TON в этом MVP представлен как ERC20 токен (адрес задаём в UI/настройке).
 * - Цены получаем из /api/fetch-dex-prices (или stub), и формируем "логик" для Router.
 *
 * Методы:
 * - getTokenList(): возвращает список токенов (stub)
 * - quote(params): возвращает input/output TokenAmounts (упрощённо)
 * - build(fields, options): возвращает core.newLogic() с to,data и inputs
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
  static supportedChainIds = [11155111, 1]; // example: Sepolia and mainnet

  constructor(chainId: number, provider?: any) {
    super(chainId, provider);
  }

  async getTokenList() {
    // Для MVP — возвращаем пару TON + ETH (WETH) на текущей сети.
    return [
      { address: '0xTON000000000000000000000000000000000000', symbol: 'TON', decimals: 9, isNative: false },
      { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18, isNative: false },
    ];
  }

  async quote(fields: SwapTonFields) {
    // Запросим наш API (app/api/fetch-dex-prices) для получения простой цены
    try {
      const resp = await axios.get('/api/fetch-dex-prices');
      const data = resp.data?.prices ?? {};
      // Попробуем найти пару TON/ETH
      const pairKey = `${fields.input.token.symbol}/ETH`;
      const p = data[pairKey];
      if (!p) {
        throw new Error('no price');
      }
      // Возвращаем упрощённый input/output
      const inputAmount = ethers.utils.parseUnits(fields.input.amount, fields.input.token.decimals);
      const price = p.midPrice; // ожидание: number
      const outputAmountFloat = parseFloat(fields.input.amount) * price;
      const outputAmount = ethers.utils.parseUnits(String(outputAmountFloat), fields.output.token.decimals);
      return {
        input: { token: fields.input.token, amountWei: inputAmount },
        output: { token: fields.output.token, amountWei: outputAmount },
      };
    } catch (e) {
      // fallback: 1 TON = 0.02 ETH (stub)
      const inputAmount = ethers.utils.parseUnits(fields.input.amount, fields.input.token.decimals);
      const outputAmount = ethers.utils.parseUnits(String(parseFloat(fields.input.amount) * 0.02), fields.output.token.decimals);
      return {
        input: { token: fields.input.token, amountWei: inputAmount },
        output: { token: fields.output.token, amountWei: outputAmount },
      };
    }
  }

  async build(fields: SwapTonFields, options: { account?: string }) {
    // Формируем простую "транзакцию": to = DEX_ROUTER, data = encode transfer/swap
    // Для MVP — собираем звонок на UniswapV2-like router: swapExactTokensForTokens
    const DEX_ROUTER = '0x1111111111111111111111111111111111111111'; // placeholder
    const iface = new ethers.utils.Interface([
      'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
      'function swapExactETHForTokens(uint256,address[],address,uint256) payable',
    ]);
    const path = [fields.input.token.address, fields.output.token.address];
    const amountIn = (fields.input as any).amountWei;
    const amountOutMin = (fields.output as any).amountWei; // naive, no slippage adjust
    const data = iface.encodeFunctionData('swapExactTokensForTokens', [
      amountIn,
      amountOutMin,
      path,
      options.account ?? ethers.constants.AddressZero,
      Math.floor(Date.now() / 1000) + 60 * 10,
    ]);
    const inputs = [
      core.newLogicInput({ input: { token: fields.input.token, amountWei: amountIn }, balanceBps: core.BPS_NOT_USED }),
    ];
    return core.newLogic({ to: DEX_ROUTER, data, inputs, approveTo: fields.input.token.address });
  }
}