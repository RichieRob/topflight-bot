#!/usr/bin/env node
type Action = {
    buy: number;
    usd: number | string;
} | {
    sell: number;
    tokens: number | string;
} | {
    fade: number;
    usd: number | string;
} | {
    cover: number;
    tokens: number | string;
} | null;
type ActionName = 'buy' | 'sell' | 'fade' | 'cover';
type CycleBot = {
    snapshot(): Promise<any>;
} & Record<ActionName, (id: number, amount: number | string) => Promise<any>>;
export declare function runCycle(bot: CycleBot, decide: (snapshot: any) => Action | Promise<Action>, dryRun: boolean, log?: (value: unknown) => void): Promise<void>;
export declare function main(args?: string[]): Promise<void>;
export {};
