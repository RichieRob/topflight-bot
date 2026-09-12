import type { Address } from 'viem';
export declare const world: {
    chainId: number;
    marketId: bigint;
    ledger: Address;
    maker: Address;
    eusdc: Address;
    oracle: Address;
    books: Address;
    router: Address;
    genesisBlock: bigint;
    rpcUrl: string;
    site: string;
    httpMirror: boolean;
};
export declare const blurb: string;
export declare const blurbLimits: {
    min: number;
    max: number;
};
export declare const defaults: {
    intervalMs: number;
    jitterFrac: number;
    minUSD: number;
    maxUSD: number;
    dustUSD: number;
    reserveUSD: number;
    lowCash: number;
    highCash: number;
    deployFrac: number;
    maxClubFrac: number;
    bandFrac: number;
    maxImpact: number;
    reduceImpact: number;
    tieJitter: number;
    slippageBps: number;
    gasLimit: bigint;
    dryRunDepthB: number;
};
