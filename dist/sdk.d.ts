import { type Address, type Hex, type PublicClient, type TransactionReceipt } from 'viem';
export type BotOptions = {
    privateKey?: Hex;
    rpcUrls?: string[];
    writeRpcUrls?: string[];
    slippageBps?: number;
    minWriteIntervalMs?: number;
    onTransactionSigned?: (transaction: {
        hash: Hex;
        nonce: number;
    }) => Promise<void>;
    onTransactionSettled?: (transaction: TradeResult) => Promise<void>;
};
export declare function amountUnits(value: string | number): bigint;
export declare function quoteBound(quoted: bigint, slippageBps: number, maximum: boolean): bigint;
export declare function readSnapshot(chain: PublicClient, account?: Address): Promise<{
    account: `0x${string}`;
    blockNumber: bigint;
    clubs: {
        id: number;
        name: string;
        ticker: string;
        price: number;
        payoutShare: number;
        held: number;
        fadeHeld: number;
        wrappedHeld: number;
        wrappedFadeHeld: number;
        raw: {
            held: bigint;
            fadeHeld: bigint;
            priceWad: bigint;
            payoutPpm: number;
        };
    }[];
    ladderSynced: boolean;
    ladderIndex: bigint;
    reservePrice: number;
    book: {
        cash: number;
        pendingYield: number;
    };
    rawBook: {
        freeCollateral: bigint;
        marketExposure: bigint;
        minTilt: bigint;
        minTiltPositionId: bigint;
        minTiltShort: bigint;
        pendingYield: bigint;
        positionsScanned: bigint;
        native: readonly {
            positionId: bigint;
            tilt: bigint;
            longBalance: bigint;
            shortBalance: bigint;
        }[];
        wrapped: readonly {
            positionId: bigint;
            longBalance: bigint;
            shortBalance: bigint;
            longToken: `0x${string}`;
            shortToken: `0x${string}`;
        }[];
    };
}>;
export type Snapshot = Awaited<ReturnType<typeof readSnapshot>>;
export type TradeResult = {
    hash: Hex;
    receipt: TransactionReceipt;
};
export type Bot = {
    address: Address | undefined;
    publicClient: PublicClient;
    snapshot(address?: Address): Promise<Snapshot>;
    buy(id: number, usd: string | number): Promise<TradeResult>;
    sell(id: number, tokens: string | number): Promise<TradeResult>;
    fade(id: number, usd: string | number): Promise<TradeResult>;
    cover(id: number, tokens: string | number): Promise<TradeResult>;
};
export declare function createBot(options?: BotOptions): Bot;
