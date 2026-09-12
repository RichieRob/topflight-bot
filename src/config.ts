import type { Address } from 'viem';
export const world = {
    chainId: 11155111,
    marketId: 0n,
    ledger: (process.env.LEDGER_ADDRESS ?? '0xff02A65A3732B0e349Bc08A05D657e6A247315d7') as Address,
    maker: (process.env.MAKER_ADDRESS ?? '0x07fa9b0d21909a54C2fec7E955a928c84C699eF3') as Address,
    eusdc: (process.env.EUSDC_ADDRESS ?? '0x9E3D657d0Fc7A2cF977AD229954eBc6e14344e06') as Address,
    oracle: (process.env.ORACLE_ADDRESS ?? '0x42679a3D458DFb19b7A5005fEDdC77840755D4d5') as Address,
    books: (process.env.BOOKS_ADDRESS ?? '0x9E729FC77A1E65B59E5de7DE52ec004176645856') as Address,
    router: (process.env.ROUTER_ADDRESS ?? '0x681651932AdA67Af422b94b4b8ace4D02b214f9D') as Address,
    genesisBlock: BigInt(process.env.GENESIS_BLOCK ?? '11669989'),
    rpcUrl: process.env.RPC_URL ?? 'https://sepolia.gateway.tenderly.co',
    site: process.env.TOPFLIGHT_URL ?? 'https://football.topflight.fun',
    httpMirror: process.env.TOPFLIGHT_HTTP_MIRROR === '1',
};
export const blurb = process.env.BOT_BLURB ??
    'EXAMPLE BLURB, REPLACE THIS ONE: holds a target book weighted by each club\'s share of the daily ' +
        'payout table, rebalancing one club a cycle and reducing whatever has drifted furthest above its target.';
export const blurbLimits = { min: 100, max: 600 };
export const defaults = {
    intervalMs: 900000,
    jitterFrac: 0.25,
    minUSD: 120,
    maxUSD: 900,
    dustUSD: 40,
    reserveUSD: 400,
    lowCash: 0.08,
    highCash: 0.45,
    deployFrac: 0.8,
    maxClubFrac: 0.3,
    bandFrac: 0.18,
    maxImpact: 0.05,
    reduceImpact: 0.3,
    tieJitter: 0.08,
    slippageBps: 200,
    gasLimit: 1500000n,
    dryRunDepthB: 28953,
};
