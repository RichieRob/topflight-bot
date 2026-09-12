import { mkdir, readFile, writeFile, chmod, open, unlink, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';
export const packageUrl = process.env.TOPFLIGHT_PACKAGE_URL ?? 'https://raw.githubusercontent.com/RichieRob/topflight-bot/main/topflight-bot-0.3.1.tgz';
export const starterStrategy = `// Put your trading model here. payoutShare describes current yield allocation,
// not a fair token price. Return one action per cycle, or null to wait.
// Open long: { buy: club.id, usd: '8' }; close long: { sell: club.id, tokens: '10' }.
// Open fade: { fade: club.id, usd: '8' }; close fade: { cover: club.id, tokens: '10' }.
// Opposite sides merge automatically. The runner handles quotes, signing and receipts.
export function decide({ clubs, book }) {
  return null;
}
`;
async function createOnly(path: string, contents: string, mode = 0o644) {
    try {
        await writeFile(path, contents, { flag: 'wx', mode });
    }
    catch (error: any) {
        if (error.code !== 'EEXIST')
            throw error;
    }
}
export async function wallet(directory: string): Promise<Hex> {
    await mkdir(directory, { recursive: true });
    const path = join(directory, '.botkey');
    await createOnly(path, generatePrivateKey() + '\n', 0o600);
    await chmod(path, 0o600);
    const key = (await readFile(path, 'utf8')).trim() as Hex;
    privateKeyToAccount(key);
    return key;
}
export async function scaffold(directory: string, bundledCli?: string) {
    await mkdir(directory, { recursive: true });
    await createOnly(join(directory, 'strategy.mjs'), starterStrategy);
    await createOnly(join(directory, 'package.json'), JSON.stringify({
        name: 'my-topflight-bot', private: true, type: 'module',
        scripts: { start: 'node .topflight-cli.mjs run --strategy ./strategy.mjs', snapshot: 'node .topflight-cli.mjs snapshot' },
    }, null, 2) + '\n');
    if (bundledCli) {
        try {
            await copyFile(bundledCli, join(directory, '.topflight-cli.mjs'));
        }
        catch (error: any) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    }
    const ignorePath = join(directory, '.gitignore');
    const previous = await readFile(ignorePath, 'utf8').catch((error: any) => { if (error.code !== 'ENOENT')
        throw error; return ''; });
    const entries = ['.botkey', '.topflight-cli.mjs', '.topflight-run.lock', '.topflight-pending.json', 'node_modules/'];
    await writeFile(ignorePath, previous + '\n' + entries.filter(entry => !previous.split('\n').includes(entry)).join('\n') + '\n');
}
export async function runnerLock(directory: string) {
    const path = join(directory, '.topflight-run.lock');
    let handle;
    try {
        handle = await open(path, 'wx', 0o600);
    }
    catch (error: any) {
        if (error.code === 'EEXIST')
            throw new Error('A runner lock already exists. Stop the other runner first. If it crashed, verify its PID in .topflight-run.lock is no longer running before removing that file.');
        throw error;
    }
    await handle.writeFile(String(process.pid));
    await handle.close();
    return async () => { await unlink(path); };
}
export async function withInitLock<T>(directory: string, task: (checkInterrupted: () => void) => Promise<T>): Promise<T> {
    const release = await runnerLock(directory);
    let interrupted = false;
    const stop = () => {
        interrupted = true;
        console.error('Stopping after the current setup operation. Your saved wallet will be preserved.');
    };
    const checkInterrupted = () => {
        if (interrupted)
            throw new Error('Setup interrupted. Repeat init with the same --dir and --code to resume.');
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    try {
        const result = await task(checkInterrupted);
        checkInterrupted();
        return result;
    }
    finally {
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        await release();
    }
}
