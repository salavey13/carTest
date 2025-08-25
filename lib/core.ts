export type Address = string;

export class Token {
  constructor(
    public chainId: number,
    public address: Address,
    public decimals: number,
    public symbol: string,
    public name?: string
  ) {}

  get isNative() {
    return this.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  }
}

export class TokenAmount {
  constructor(public token: Token, public amount: string) {}

  toString() {
    return `${this.amount} ${this.token.symbol}`;
  }
}

export type RouterLogic = {
  to: string;
  data: string;
  inputs?: any[];
  approveTo?: string;
  callback?: string;
};

export function newLogic(opts: Partial<RouterLogic>): RouterLogic {
  return {
    to: opts.to || '0x0000000000000000000000000000000000000000',
    data: opts.data || '0x',
    inputs: opts.inputs || [],
    approveTo: opts.approveTo || '0x0000000000000000000000000000000000000000',
    callback: opts.callback || '0x0000000000000000000000000000000000000000',
  };
}