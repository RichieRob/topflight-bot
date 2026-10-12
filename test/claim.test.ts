// CLAIMING A BOT: the exact signed bytes the claim page verifies, the shapes
// the kit refuses before signing, and the CLI printing a signature that
// recovers to the workspace's own key. Claiming is optional; the hint after
// init says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recoverMessageAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { botClaimMessage, claimSignature } from '../src/onboarding.js';
import { main, CLAIM_HINT } from '../src/cli.js';
import { scaffold, wallet } from '../src/workspace.js';

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ADDRESS = privateKeyToAccount(KEY).address;
const NONCE = '0123456789abcdef01234567';

test('the claim message is exactly the published bytes: lowercase address and handle, no @, single spaces', () => {
  assert.equal(
    botClaimMessage(ADDRESS, '@Some_Handle', NONCE),
    `topflight bot claim ${ADDRESS.toLowerCase()} some_handle ${NONCE}`,
  );
  assert.equal(botClaimMessage(ADDRESS, 'abc', NONCE).split(' ').length, 6);
  assert.ok(!botClaimMessage(ADDRESS, 'abc', NONCE).endsWith('\n'));
});

test('wrong nonce and handle shapes are refused before anything is signed', () => {
  for (const nonce of ['0123456789ABCDEF01234567', '0123456789abcdef0123456', '0123456789abcdef012345678', 'zz23456789abcdef01234567', '']) {
    assert.throws(() => botClaimMessage(ADDRESS, 'abc', nonce), /nonce/, `nonce ${nonce} accepted`);
  }
  for (const handle of ['', '@', 'has space', 'a'.repeat(16), 'dash-ed', '@@two']) {
    assert.throws(() => botClaimMessage(ADDRESS, handle, NONCE), /handle/, `handle ${handle} accepted`);
  }
  assert.throws(() => botClaimMessage('0x1234', 'abc', NONCE), /address/);
});

test('the claim signature recovers to the bot address over the exact message', async () => {
  const claim = await claimSignature({ privateKey: KEY, handle: '@Rich', nonce: NONCE });
  assert.equal(claim.message, `topflight bot claim ${ADDRESS.toLowerCase()} rich ${NONCE}`);
  assert.match(claim.signature, /^0x[0-9a-f]{130}$/);
  const signer = await recoverMessageAddress({ message: claim.message, signature: claim.signature });
  assert.equal(signer.toLowerCase(), ADDRESS.toLowerCase());
  const other = await recoverMessageAddress({ message: claim.message.replace(NONCE, NONCE.replace('0', '1')), signature: claim.signature });
  assert.notEqual(other.toLowerCase(), ADDRESS.toLowerCase(), 'a different nonce recovered the same signer');
});

test('topflight-bot claim prints a signature that recovers to the workspace key', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'topflight-claim-test-'));
  const printed: string[] = [];
  const log = console.log;
  try {
    await scaffold(directory);
    const key = await wallet(directory);
    const address = privateKeyToAccount(key).address.toLowerCase();
    console.log = (...args: unknown[]) => { printed.push(args.join(' ')); };
    await main(['claim', NONCE, '@Rich', '--dir', directory]);
    console.log = log;
    const signature = printed.find(line => /^0x[0-9a-f]{130}$/.test(line));
    assert.ok(signature, `no signature printed: ${printed.join(' | ')}`);
    assert.ok(printed.some(line => line.includes(address) && line.includes('@rich')), 'the bot and handle are not named');
    const signer = await recoverMessageAddress({ message: `topflight bot claim ${address} rich ${NONCE}`, signature: signature as `0x${string}` });
    assert.equal(signer.toLowerCase(), address);
    await assert.rejects(main(['claim', 'NOTANONCE', 'rich', '--dir', directory]), /nonce/);
    await assert.rejects(main(['claim', NONCE, '--dir', directory]), /Usage: topflight-bot claim/);
  } finally {
    console.log = log;
    await rm(directory, { recursive: true, force: true });
  }
});

test('the hint after init says claiming is optional and points at the claim page', () => {
  assert.match(CLAIM_HINT, /^Optional: /);
  assert.match(CLAIM_HINT, /\/bots\/claim/);
  assert.doesNotMatch(CLAIM_HINT, /draw|lottery|prize|—/i);
});

test('init prints the optional claim hint once, after the Ready line', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = (await readFile(new URL('../src/cli.ts', import.meta.url), 'utf8')).replace(/\/\/.*$/gm, '');
  const ready = source.indexOf('Ready: ${directory}');
  const hint = source.indexOf('console.log(CLAIM_HINT)');
  assert.ok(ready > 0, 'the Ready line is gone');
  assert.ok(hint > ready, 'init does not print the claim hint after the Ready line');
  assert.equal(source.split('console.log(CLAIM_HINT)').length, 2, 'the claim hint is printed more than once');
});
