import type { Hex } from 'viem';
export declare const packageUrl: string;
export declare const starterStrategy = "// Put your trading model here. payoutShare describes current yield allocation,\n// not a fair token price. Return one action per cycle, or null to wait.\n// Open long: { buy: club.id, usd: '8' }; close long: { sell: club.id, tokens: '10' }.\n// Open fade: { fade: club.id, usd: '8' }; close fade: { cover: club.id, tokens: '10' }.\n// Opposite sides merge automatically. The runner handles quotes, signing and receipts.\nexport function decide({ clubs, book }) {\n  return null;\n}\n";
export declare function wallet(directory: string): Promise<Hex>;
export declare function scaffold(directory: string): Promise<void>;
export declare function runnerLock(directory: string): Promise<() => Promise<void>>;
export declare function withInitLock<T>(directory: string, task: (checkInterrupted: () => void) => Promise<T>): Promise<T>;
