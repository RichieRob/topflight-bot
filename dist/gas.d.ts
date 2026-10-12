export type GasPolicy = {
    headroomPct: bigint;
    cap: bigint;
    fixed?: bigint;
    fallback: bigint;
};
export type GasChoice = {
    gas: bigint;
    source: 'fixed' | 'estimate' | 'fallback';
    estimate?: bigint;
};
export declare function gasPolicy(): GasPolicy;
export declare function chooseGas(estimate: () => Promise<bigint>, policy?: GasPolicy): Promise<GasChoice>;
