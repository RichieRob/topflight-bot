#!/usr/bin/env node
import { readFile, writeFile, realpath, unlink } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { privateKeyToAccount } from 'viem/accounts';
import { createBot } from './sdk.js';
import { world } from './config.js';
import { ledgerAbi } from './ledger.js';
import { register, claimGas, registrationDetails, waitForStack } from './onboarding.js';
import { wallet, scaffold, runnerLock, withInitLock } from './workspace.js';
const stringify = (value) => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
export async function runCycle(bot, decide, dryRun, log = console.log) {
    const action = await decide(await bot.snapshot());
    if (action === null || action === undefined) {
        log({ action: null });
        return;
    }
    const choices = ['buy', 'sell', 'fade', 'cover'];
    const selected = typeof action === 'object' ? choices.filter(name => name in action) : [];
    if (selected.length !== 1)
        throw new Error('Strategy must return null or exactly one action: { buy: id, usd }, { sell: id, tokens }, { fade: id, usd }, or { cover: id, tokens }.');
    const name = selected[0];
    const fields = action;
    const id = fields[name];
    const amount = fields[name === 'buy' || name === 'fade' ? 'usd' : 'tokens'];
    if (!Number.isSafeInteger(id) || id < 0 || !['string', 'number'].includes(typeof amount) || !/^(?:\d+)(?:\.\d+)?$/.test(String(amount)) || !(Number(amount) > 0))
        throw new Error('Strategy action requires a non-negative club id and a positive decimal amount.');
    log({ dryRun, action });
    if (!dryRun)
        log(await bot[name](id, amount));
}
function positive(raw, fallback, name) {
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0)
        throw new Error(`${name} must be a positive integer.`);
    return value;
}
export async function main(args = process.argv.slice(2)) {
    const { values: flags, positionals } = parseArgs({ args, allowPositionals: true, options: {
            dir: { type: 'string' }, code: { type: 'string' }, name: { type: 'string' }, blurb: { type: 'string' },
            strategy: { type: 'string' }, 'no-install': { type: 'boolean' }, 'dry-run': { type: 'boolean' }, once: { type: 'boolean' },
            cycles: { type: 'string' }, 'interval-ms': { type: 'string' }, 'timeout-ms': { type: 'string' }, help: { type: 'boolean' },
        } });
    const command = positionals[0];
    if (flags.help || !command) {
        console.log('topflight-bot init --code CODE --name NAME --blurb "100–600 characters" [--dir ./topflight-bot] [--no-install]\ntopflight-bot run --strategy ./strategy.mjs [--dry-run] [--once | --cycles N] [--interval-ms 180000]\ntopflight-bot snapshot | gas [--dir DIRECTORY]\ninit saves your key locally and resumes safely when repeated.');
        return;
    }
    if (!['init', 'run', 'snapshot', 'gas'].includes(command))
        throw new Error('Unknown command; use --help.');
    const allowed = new Set(command === 'init'
        ? ['dir', 'code', 'name', 'blurb', 'no-install', 'timeout-ms', 'help']
        : command === 'run'
            ? ['dir', 'strategy', 'dry-run', 'once', 'cycles', 'interval-ms', 'help']
            : ['dir', 'help']);
    for (const flag of Object.keys(flags)) {
        if (!allowed.has(flag))
            throw new Error(`--${flag} is not supported by ${command}. Use --help.`);
    }
    if (positionals.length !== 1)
        throw new Error('Unexpected positional argument; use --help.');
    const directory = resolve(flags.dir ?? (command === 'init' ? './topflight-bot' : '.'));
    if (command === 'init') {
        const configPath = join(directory, 'topflight.json');
        const saved = await readFile(configPath, 'utf8').then(text => JSON.parse(text)).catch((error) => { if (error.code !== 'ENOENT')
            throw error; return null; });
        const details = registrationDetails({ code: flags.code ?? '', name: flags.name ?? saved?.name ?? '', blurb: flags.blurb ?? saved?.blurb ?? '' });
        const bundledCli = resolve(dirname(fileURLToPath(import.meta.url)), 'cli.bundle.mjs');
        await scaffold(directory, bundledCli);
        await withInitLock(directory, async (checkInterrupted) => {
            const privateKey = await wallet(directory);
            const address = privateKeyToAccount(privateKey).address;
            const previous = await readFile(configPath, 'utf8').then(text => JSON.parse(text)).catch((error) => { if (error.code !== 'ENOENT')
                throw error; return null; });
            if (previous && (previous.name !== details.name || previous.address.toLowerCase() !== address.toLowerCase()))
                throw new Error('This workspace already belongs to a different name or address. Use its original name or choose another --dir.');
            await writeFile(configPath, stringify({ name: details.name, address, blurb: details.blurb }) + '\n');
            console.log(`Wallet saved for ${address}. Registering ${details.name}…`);
            const bot = createBot({ privateKey });
            checkInterrupted();
            let registration = await register({ privateKey, ...details });
            checkInterrupted();
            for (let attempt = 1; registration.stack && registration.stack.status !== 'granted' && attempt < 3; attempt++) {
                console.log('Opening stack grant is pending or failed; retrying the same registration…');
                await new Promise(resolve => setTimeout(resolve, 3000));
                checkInterrupted();
                registration = await register({ privateKey, ...details });
                checkInterrupted();
            }
            if (registration.stack && registration.stack.status !== 'granted')
                throw new Error('Opening stack grant failed. Wallet is saved; repeat init with the same code and name to retry.');
            const readBalances = async () => {
                checkInterrupted();
                return ({
                    cash: await bot.publicClient.readContract({ address: world.ledger, abi: ledgerAbi, functionName: 'eusdcBalance', args: [address] }),
                    eth: await bot.publicClient.getBalance({ address }),
                });
            };
            const balances = await readBalances();
            checkInterrupted();
            let gasError;
            if (balances.eth < 3000000000000000n) {
                try {
                    await claimGas({ privateKey });
                }
                catch (error) {
                    gasError = error;
                }
            }
            checkInterrupted();
            try {
                await waitForStack({ address, readBalances, minEth: 3000000000000000n, timeoutMs: positive(flags['timeout-ms'], 180_000, '--timeout-ms') });
            }
            catch (error) {
                if (gasError)
                    throw new Error(`${gasError.message}. Funding not ready; repeat init to resume.`);
                throw error;
            }
            checkInterrupted();
            checkInterrupted();
            const quotedDirectory = "'" + directory.replaceAll("'", "'\\''") + "'";
            console.log(`Ready: ${directory}\nEdit strategy.mjs, then run live on Sepolia:\ncd ${quotedDirectory}\nnpm start -- --cycles 50 --interval-ms 180000\nOptional debug: npm start -- --dry-run --once\nTrader: ${world.site}/trader/${address}`);
        });
        return;
    }
    const privateKey = (await readFile(join(directory, '.botkey'), 'utf8')).trim();
    if (command === 'gas') {
        const result = await claimGas({ privateKey });
        const receipt = await createBot({}).publicClient.waitForTransactionReceipt({ hash: result.txHash, timeout: 180_000 });
        if (receipt.status !== 'success')
            throw new Error('Gas transaction reverted.');
        console.log(`Gas confirmed: ${result.txHash}`);
        return;
    }
    const address = privateKeyToAccount(privateKey).address;
    const pendingPath = join(directory, '.topflight-pending.json');
    if (command === 'run' && !flags['dry-run']) {
        const pending = await readFile(pendingPath, 'utf8').catch((error) => { if (error.code !== 'ENOENT')
            throw error; return null; });
        if (pending !== null)
            throw new Error('An earlier transaction may still be pending. Inspect hash and nonce in .topflight-pending.json on Sepolia; remove that file only after confirming its final outcome. Dry-run and snapshot remain available.');
    }
    const bot = createBot(flags['dry-run'] || command === 'snapshot' ? {} : {
        privateKey,
        onTransactionSigned: async (transaction) => { await writeFile(pendingPath, stringify(transaction), { flag: 'wx', mode: 0o600 }); },
        onTransactionSettled: async () => { await unlink(pendingPath); },
    });
    if (command === 'snapshot') {
        console.log(stringify(await bot.snapshot(address)));
        return;
    }
    const strategyPath = resolve(directory, flags.strategy ?? './strategy.mjs');
    const strategy = await import(pathToFileURL(strategyPath).href);
    if (typeof strategy.decide !== 'function')
        throw new Error('Strategy must export function decide(snapshot).');
    const cycles = flags.once ? 1 : positive(flags.cycles, Number.MAX_SAFE_INTEGER, '--cycles');
    const interval = positive(flags['interval-ms'], 180_000, '--interval-ms');
    const release = await runnerLock(directory);
    let stopped = false;
    let wake;
    const stop = () => { stopped = true; wake?.(); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    try {
        if (!flags['dry-run']) {
            const pending = await readFile(pendingPath, 'utf8').catch((error) => { if (error.code !== 'ENOENT')
                throw error; return null; });
            if (pending !== null)
                throw new Error('Unresolved transaction in .topflight-pending.json. Confirm its final outcome before removing the journal and restarting.');
        }
        for (let cycle = 0; cycle < cycles && !stopped; cycle++) {
            await runCycle({ snapshot: () => bot.snapshot(address), buy: bot.buy, sell: bot.sell, fade: bot.fade, cover: bot.cover }, strategy.decide, Boolean(flags['dry-run']), value => console.log(stringify(value)));
            if (cycle + 1 < cycles && !stopped)
                await new Promise(resolve => {
                    const timer = setTimeout(resolve, interval);
                    wake = () => { clearTimeout(timer); resolve(); };
                });
        }
    }
    finally {
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        await release();
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(resolve(process.argv[1]))).href) {
    main().catch(error => { console.error(error instanceof Error ? error.message : 'Bot command failed.'); process.exitCode = 1; });
}
