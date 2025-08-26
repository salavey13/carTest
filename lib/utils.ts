import { BigNumber, ethers } from 'ethers';

export function calcFee(amountWei: string, feeBps: number, round: 'floor' | 'round' = 'round') {
  const amt = BigNumber.from(amountWei);
  const numerator = amt.mul(feeBps);
  const denom = 10_000;
  const raw = numerator.div(denom);
  if (round === 'floor') return raw.toString();
  const rem = numerator.mod(denom);
  const add = rem.mul(2).gte(denom) ? BigNumber.from(1) : BigNumber.from(0);
  return raw.add(add).toString();
}

export function reverseAmountWithFee(repayWei: string, feeBps: number) {
  const r = BigNumber.from(repayWei);
  const loan = r.mul(10000).div(10000 + feeBps);
  return loan.toString();
}

export function decimalsToWei(amount: string, decimals: number) {
  return ethers.utils.parseUnits(amount, decimals).toString();
}