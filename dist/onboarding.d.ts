import type { Address, Hex } from 'viem';
export type DoorOptions = {
    privateKey: Hex;
    site?: string;
    fetch?: typeof fetch;
};
export type Registration = {
    ok: boolean;
    alreadyRegistered?: boolean;
    stack?: {
        status: string;
        txHash?: Hex;
        error?: string;
    };
    bot?: {
        address: string;
        name: string;
    };
};
export declare function registrationDetails(input: {
    code: string;
    name: string;
    blurb: string;
}): {
    code: string;
    name: string;
    blurb: string;
};
export declare function register(options: DoorOptions & {
    code: string;
    name: string;
    blurb: string;
}): Promise<Registration>;
export declare function claimGas(options: DoorOptions): Promise<{
    ok: true;
    txHash: Hex;
}>;
export declare function waitForStack(options: {
    address: Address;
    readBalances: (address: Address) => Promise<{
        cash: bigint;
        eth: bigint;
    }>;
    timeoutMs?: number;
    minEth?: bigint;
    pollMs?: number;
    sleep?: (ms: number) => Promise<void>;
}): Promise<{
    cash: bigint;
    eth: bigint;
}>;
