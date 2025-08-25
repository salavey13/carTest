/**
 * Минимал mock flash-loan builder.
 * Он формирует calldata для вызова pool.flashLoan(...) подобно AaveV3,
 * но это лишь билд — для реального использования нужны контракты из protocolink-contract.
 *
 * Для MVP: build() возвращает core.newLogic с to=POOL_ADDRESS и data=encoded flashLoan call.
 */

import * as core from '../../core';
import { ethers } from 'ethers';

export type FlashLoanMockFields = {
  loans: { token: { address: string; decimals: number; symbol: string }; amount: string }[]; // human amount strings
  params?: string; // user callback params
};

export class FlashLoanMock extends core.Logic {
  static id = 'flash-loan-mock';
  static protocolId = 'flash-mock';
  static supportedChainIds = [11155111, 1];

  constructor(chainId: number, provider?: any) {
    super(chainId, provider);
  }

  async quote(fields: FlashLoanMockFields) {
    // Минимально — вернём feeBps = 9 (0.09%)
    return { feeBps: 9, loans: fields.loans };
  }

  async build(fields: FlashLoanMockFields) {
    const pool = '0xPOOL000000000000000000000000000000000000'; // placeholder
    const iface = new ethers.utils.Interface(['function flashLoan(address,address[],uint256[],bytes)']);
    const assets = fields.loans.map((l) => l.token.address);
    const amounts = fields.loans.map((l) => ethers.utils.parseUnits(l.amount, l.token.decimals));
    const data = iface.encodeFunctionData('flashLoan', [this.getCallbackAddress(), assets, amounts, fields.params ?? '0x']);
    return core.newLogic({ to: pool, data, callback: this.getCallbackAddress() });
  }

  getCallbackAddress() {
    // в реале callback — контракт AaveV3FlashLoanCallback; для MVP — placeholder
    return '0xCALLBACK0000000000000000000000000000000000';
  }
}