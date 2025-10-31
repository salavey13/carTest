/**
 * Mock flash-loan builder (POC).
 * Переведён на ethers@6 — ethers.Interface, ethers.parseUnits
 */
import * as core from '../../core';
import { ethers } from 'ethers';

export type FlashLoanMockFields = {
  loans: { token: { address: string; decimals: number; symbol: string }; amount: string }[];
  params?: string;
};

export class FlashLoanMock extends core.Logic {
  static id = 'flash-loan-mock';
  static protocolId = 'flash-mock';
  static supportedChainIds = [11155111, 1];

  constructor(chainId: number, provider?: any) {
    super(chainId, provider);
  }

  async quote(fields: FlashLoanMockFields) {
    return { feeBps: 9, loans: fields.loans };
  }

  async build(fields: FlashLoanMockFields) {
    const pool = '0xPOOL000000000000000000000000000000000000';
    const iface = new ethers.Interface(['function flashLoan(address,address[],uint256[],bytes)']);
    const assets = fields.loans.map((l) => l.token.address);
    const amounts = fields.loans.map((l) => ethers.parseUnits(l.amount, l.token.decimals));
    const data = iface.encodeFunctionData('flashLoan', [this.getCallbackAddress(), assets, amounts, fields.params ?? '0x']);
    return core.newLogic({ to: pool, data, callback: this.getCallbackAddress() });
  }

  getCallbackAddress() {
    return '0xCALLBACK0000000000000000000000000000000000';
  }
}