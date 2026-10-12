import { defaults } from './config.js';
function envGas(name) {
    const raw = process.env[name]?.trim();
    if (!raw)
        return undefined;
    if (!/^\d+$/.test(raw) || BigInt(raw) < 21000n)
        throw Error(`${name} must be a whole number of gas units, at least 21000`);
    return BigInt(raw);
}
export function gasPolicy() {
    return {
        headroomPct: BigInt(defaults.gasHeadroomPct),
        cap: envGas('TOPFLIGHT_GAS_CAP') ?? defaults.gasCap,
        fixed: envGas('TOPFLIGHT_GAS_LIMIT'),
        fallback: defaults.gasFallback,
    };
}
function isRevert(error) {
    for (let e = error; e; e = e.cause) {
        if (/revert/i.test(`${e.name ?? ''} ${e.shortMessage ?? ''} ${e.details ?? ''}`))
            return true;
        if (e === e.cause)
            break;
    }
    return false;
}
export async function chooseGas(estimate, policy = gasPolicy()) {
    if (policy.fixed != null)
        return { gas: policy.fixed, source: 'fixed' };
    let est;
    try {
        est = await estimate();
    }
    catch (error) {
        if (isRevert(error))
            throw error;
        return { gas: policy.fallback < policy.cap ? policy.fallback : policy.cap, source: 'fallback' };
    }
    if (est > policy.cap)
        throw Error(`REFUSING THE TRADE: the node estimates ${est} gas, above the cap of ${policy.cap}. ` +
            'Raise TOPFLIGHT_GAS_CAP, or set TOPFLIGHT_GAS_LIMIT to send a fixed limit.');
    const padded = (est * policy.headroomPct) / 100n;
    return { gas: padded > policy.cap ? policy.cap : padded, source: 'estimate', estimate: est };
}
