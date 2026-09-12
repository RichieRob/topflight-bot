#!/usr/bin/env node
type Action = {
    buy: number;
    usd: number | string;
} | {
    sell: number;
    tokens: number | string;
} | null;
export declare function runCycle(bot: {
    snapshot(): Promise<any>;
    buy(id: number, usd: number | string): Promise<any>;
    sell(id: number, tokens: number | string): Promise<any>;
}, decide: (snapshot: any) => Action | Promise<Action>, dryRun: boolean, log?: (value: unknown) => void): Promise<void>;
export declare function main(args?: string[]): Promise<void>;
export {};
