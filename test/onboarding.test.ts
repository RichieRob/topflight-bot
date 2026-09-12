import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoverMessageAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { register, claimGas, waitForStack } from '../src/onboarding.js';

const privateKey = ('0x' + '11'.repeat(32)) as `0x${string}`;
const account = privateKeyToAccount(privateKey);
const details = { privateKey, code: ' abcd1234 ', name: ' Swing One ', blurb: 'I trade small positions using my own entry and exit levels, limit the number of holdings, and wait when no opportunity fits my rules.' };

test('registration signs normalized fields and returns a failed stack without claiming readiness', async () => {
  const response = await register({ ...details, fetch: (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.code, 'ABCD1234'); assert.equal(body.name, 'Swing One');
    assert.equal(body.address, account.address.toLowerCase());
    assert.equal(await recoverMessageAddress({ message: 'topflight bot registration ABCD1234 Swing One', signature: body.signature }), account.address);
    assert.equal(body.privateKey, undefined);
    return Response.json({ ok: true, stack: { status: 'failed' } });
  }) as typeof fetch });
  assert.equal(response.stack?.status, 'failed');
});

test('gas signs lowercase address with a fresh nonce and surfaces refusals', async () => {
  await assert.rejects(claimGas({ privateKey, fetch: (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(await recoverMessageAddress({ message: `topflight bot gas ${account.address.toLowerCase()} ${body.nonce}`, signature: body.signature }), account.address);
    return Response.json({ error: 'faucet reserve is low' }, { status: 503 });
  }) as typeof fetch }), /HTTP 503: faucet reserve is low/);
});

test('wait requires both stack and gas, including delayed mining', async () => {
  let calls = 0;
  const result = await waitForStack({ address: account.address, sleep: async () => {}, readBalances: async () => {
    calls++; return { cash: calls >= 2 ? 10_000n : 0n, eth: calls >= 3 ? 1n : 0n };
  } });
  assert.equal(calls, 3); assert.equal(result.eth, 1n);
});

test('funding timeout explains safe resume', async () => {
  await assert.rejects(waitForStack({ address: account.address, timeoutMs: 0, readBalances: async () => ({ cash: 1n, eth: 0n }) }), /repeat init with the same code and name/);
});
