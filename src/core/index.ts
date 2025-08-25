/**
 * Minimal "core" shim for protocolink-logics usage inside carTest MVP.
 * Не полная замена @protocolink/core — только то, что нужно для сборки логик и UI.
 */

import { BigNumber } from 'ethers';

export const ELASTIC_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const BPS_NOT_USED = 0;
export const OFFSET_NOT_USED = 'OFFSET_NOT_USED' as unknown as number;

export type LogicInput = {
  token: string; // token address or ELASTIC_ADDRESS for native
  amountWei: BigNumber | string;
  balanceBps?: number;
  amountOrOffset?: number | string;
};

export type RouterLogic = {
  to: string;
  data: string;
  inputs?: LogicInput[];
  approveTo?: string;
  callback?: string;
};

export class Logic {
  chainId: number;
  provider?: any;
  constructor(chainId: number, provider?: any) {
    this.chainId = chainId;
    this.provider = provider;
  }
}

export function newLogicInput({ input, balanceBps, amountOffset }: { input: any; balanceBps?: number; amountOffset?: any; }) {
  return {
    token: input.token?.address ?? ELASTIC_ADDRESS,
    amountWei: input.amountWei ?? input.amount,
    balanceBps: balanceBps ?? BPS_NOT_USED,
    amountOrOffset: amountOffset ?? input.amountWei,
  } as LogicInput;
}

export function newLogic({ to, data, inputs, approveTo, callback }: Partial<RouterLogic>): RouterLogic {
  return {
    to: to ?? '0x0',
    data: data ?? '0x',
    inputs: inputs ?? [],
    approveTo: approveTo ?? '0x0000000000000000000000000000000000000000',
    callback: callback ?? '0x0000000000000000000000000000000000000000',
  };
}