import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile, rm, symlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wallet, scaffold, runnerLock, withInitLock } from '../src/workspace.js';
import { runCycle, main } from '../src/cli.js';
import { privateKeyToAccount } from 'viem/accounts';

test('workspace retries preserve private key and user strategy; key is private and ignored', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topflight-test-'));
  try {
    await scaffold(directory);
    const key = await wallet(directory);
    await writeFile(join(directory, 'strategy.mjs'), 'export const decide = () => null;');
    await scaffold(directory);
    assert.equal(await wallet(directory), key);
    assert.equal((await stat(join(directory, '.botkey'))).mode & 0o777, 0o600);
    assert.match(await readFile(join(directory, '.gitignore'), 'utf8'), /\.botkey/);
    assert.equal(await readFile(join(directory, 'strategy.mjs'), 'utf8'), 'export const decide = () => null;');
    await writeFile(join(directory, '.botkey'), 'invalid');
    await assert.rejects(wallet(directory));
    assert.equal(await readFile(join(directory, '.botkey'), 'utf8'), 'invalid');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('single runner lock excludes overlap and releases cleanly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topflight-lock-test-'));
  try {
    const release = await runnerLock(directory);
    await assert.rejects(runnerLock(directory), /runner lock already exists/);
    await release(); await (await runnerLock(directory))();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('dry run uses the same strategy and snapshot without dispatching buys or sells', async () => {
  const snapshot = { clubs: [{ id: 21, held: 10 }], book: { cash: 30 } };
  let decisions = 0; const writes: unknown[] = []; const logged: unknown[] = [];
  const bot = { snapshot: async () => snapshot, buy: async (...args: unknown[]) => writes.push(args), sell: async (...args: unknown[]) => writes.push(args), fade: async (...args: unknown[]) => writes.push(args), cover: async (...args: unknown[]) => writes.push(args) };
  const decide = (state: any) => { decisions++; assert.equal(state, snapshot); return { sell: 21, tokens: '3.5' }; };
  await runCycle(bot, decide, true, value => logged.push(value));
  assert.equal(decisions, 1); assert.deepEqual(writes, []);
  assert.deepEqual(logged, [{ dryRun: true, action: { sell: 21, tokens: '3.5' } }]);
  await runCycle(bot, decide, false, () => {});
  assert.equal(decisions, 2); assert.deepEqual(writes, [[21, '3.5']]);
});

test('invalid strategy actions fail before dispatch', async () => {
  const unexpected = async () => { throw new Error('unexpected write'); };
  const bot = { snapshot: async () => ({}), buy: unexpected, sell: unexpected, fade: unexpected, cover: unexpected };
  await assert.rejects(runCycle(bot, () => ({ buy: 1, usd: -8 }), false), /positive decimal/);
  await assert.rejects(runCycle(bot, () => ({ fade: 21, usd: 0 }), true), /positive decimal/);
  await assert.rejects(runCycle(bot, () => ({ cover: 21, tokens: 'bad' }), false), /positive decimal/);
  await assert.rejects(runCycle(bot, () => ({ buy: 21, fade: 21, usd: '8' }), false), /exactly one action/);
});

test('all four actions use their SDK method and preserve units; dry-run dispatches none', async () => {
  const writes: unknown[] = [];
  const bot = {
    snapshot: async () => ({ clubs: [{ id: 21 }], book: {} }),
    buy: async (...args: unknown[]) => writes.push(['buy', ...args]),
    sell: async (...args: unknown[]) => writes.push(['sell', ...args]),
    fade: async (...args: unknown[]) => writes.push(['fade', ...args]),
    cover: async (...args: unknown[]) => writes.push(['cover', ...args]),
  };
  const actions = [{ buy: 21, usd: '8.25' }, { sell: 21, tokens: '3.5' }, { fade: 21, usd: '7.75' }, { cover: 21, tokens: '2.25' }];
  for (const action of actions) await runCycle(bot, () => action, true, () => {});
  assert.deepEqual(writes, []);
  for (const action of actions) await runCycle(bot, () => action, false, () => {});
  assert.deepEqual(writes, [['buy', 21, '8.25'], ['sell', 21, '3.5'], ['fade', 21, '7.75'], ['cover', 21, '2.25']]);
});

test('npm-style symlink entry actually runs the CLI', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topflight-bin-test-'));
  try {
    const entry = join(directory, 'topflight-bot');
    await symlink(fileURLToPath(new URL('../src/cli.ts', import.meta.url)), entry);
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', entry, '--help']);
    assert.match(stdout, /topflight-bot init --code CODE/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('dry-run is refused on commands that would ignore it, before any setup or faucet request', async () => {
  await assert.rejects(main(['init', '--dry-run']), /--dry-run is not supported by init/);
  await assert.rejects(main(['gas', '--dry-run']), /--dry-run is not supported by gas/);
});

test('interrupted init holds lock through its current operation, then releases for resume', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topflight-interrupt-test-'));
  try {
    await assert.rejects(withInitLock(directory, async checkInterrupted => {
      process.emit('SIGINT');
      await assert.rejects(runnerLock(directory), /runner lock already exists/);
      checkInterrupted();
    }), /Setup interrupted/);
    await (await runnerLock(directory))();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('init resume reuses saved name and blurb with the original wallet', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topflight-resume-test-'));
  const originalFetch = globalThis.fetch;
  try {
    const privateKey = await wallet(directory);
    const address = privateKeyToAccount(privateKey).address;
    const saved = { name: 'Resume Bot', address, blurb: 'This bot uses author-defined entry and exit levels, holds a small number of positions, and sells part of a holding when its exit level is reached.' };
    await writeFile(join(directory, 'topflight.json'), JSON.stringify(saved));
    let request: any;
    globalThis.fetch = (async (_url, init) => {
      request = JSON.parse(String(init?.body));
      return Response.json({ error: 'test refusal; no registration performed' }, { status: 400 });
    }) as typeof fetch;
    await assert.rejects(main(['init', '--dir', directory, '--code', 'TEST1234', '--no-install']), /test refusal/);
    assert.equal(request.name, saved.name);
    assert.equal(request.blurb, saved.blurb);
    assert.equal(request.address, address.toLowerCase());
    assert.equal(await wallet(directory), privateKey);
    await (await runnerLock(directory))();
  } finally {
    globalThis.fetch = originalFetch;
    await rm(directory, { recursive: true, force: true });
  }
});
