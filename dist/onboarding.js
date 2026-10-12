import { randomUUID } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { world } from './config.js';
export function registrationDetails(input) {
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const blurb = input.blurb.trim();
    if (!/^[A-Z0-9]{4,16}$/.test(code))
        throw new Error('Invite code must contain 4–16 letters or digits.');
    if (name.length < 3 || name.length > 24 || !/^[A-Za-z0-9 _]+$/.test(name) || / {2,}/.test(name))
        throw new Error('Name must be 3–24 letters, digits, spaces or underscores, without repeated spaces.');
    if (blurb.length < 100 || blurb.length > 600)
        throw new Error('Supply --blurb with 100–600 characters describing your strategy.');
    return { code, name, blurb };
}
async function post(options, path, body) {
    const response = await (options.fetch ?? fetch)(`${options.site ?? world.site}${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
        let reason = typeof data?.error === 'string' ? data.error : 'request failed';
        for (const secret of [options.privateKey, body.code, body.signature]) {
            if (typeof secret === 'string' && secret)
                reason = reason.split(secret).join('[redacted]');
        }
        throw new Error(`TopFlight HTTP ${response.status}: ${reason}`);
    }
    return data;
}
export async function register(options) {
    const details = registrationDetails(options);
    const account = privateKeyToAccount(options.privateKey);
    const signature = await account.signMessage({ message: `topflight bot registration ${details.code} ${details.name}` });
    return post(options, '/api/bot/register', { ...details, address: account.address.toLowerCase(), signature });
}
export async function claimGas(options) {
    const account = privateKeyToAccount(options.privateKey);
    const address = account.address.toLowerCase();
    const nonce = randomUUID();
    const signature = await account.signMessage({ message: `topflight bot gas ${address} ${nonce}` });
    return post(options, '/api/bot/gas', { address, nonce, signature });
}
export const CLAIM_NONCE = /^[0-9a-f]{24}$/;
export const CLAIM_HANDLE = /^@?[A-Za-z0-9_]{1,15}$/;
export function botClaimMessage(address, handle, nonce) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address))
        throw new Error('Bot address must be a 0x-prefixed 40-character hex address.');
    if (!CLAIM_HANDLE.test(handle))
        throw new Error('X handle must be 1 to 15 letters, digits or underscores, with or without a leading @.');
    if (!CLAIM_NONCE.test(nonce))
        throw new Error('Claim nonce must be the 24 lowercase hex characters the claim page shows.');
    return `topflight bot claim ${address.toLowerCase()} ${handle.replace(/^@/, '').toLowerCase()} ${nonce}`;
}
export async function claimSignature(options) {
    const account = privateKeyToAccount(options.privateKey);
    const address = account.address.toLowerCase();
    const message = botClaimMessage(address, options.handle, options.nonce);
    const signature = await account.signMessage({ message });
    return { address, handle: options.handle.replace(/^@/, '').toLowerCase(), message, signature };
}
export async function waitForStack(options) {
    const deadline = Date.now() + (options.timeoutMs ?? 180_000);
    do {
        const balances = await options.readBalances(options.address);
        if (balances.cash > 0n && balances.eth >= (options.minEth ?? 1n))
            return balances;
        if (Date.now() >= deadline)
            break;
        await (options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(options.pollMs ?? 3000);
    } while (Date.now() <= deadline);
    throw new Error('Funding has not landed yet. Your wallet is saved; repeat init with the same code and name to resume.');
}
