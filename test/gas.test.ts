import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { chooseGas, gasPolicy } from '../src/gas.js';

const policy = { headroomPct: 125n, cap: 6_000_000n, fallback: 3_000_000n };

test('PRECONDITION: the default policy is x1.25 headroom, a 6,000,000 cap and a 3,000,000 fallback, with no fixed limit', () => {
  delete process.env.TOPFLIGHT_GAS_LIMIT; delete process.env.TOPFLIGHT_GAS_CAP;
  assert.deepEqual(gasPolicy(), { ...policy, fixed: undefined });
});

test('the limit is the estimate plus 25%, clamped to the cap', async () => {
  assert.deepEqual(await chooseGas(async () => 2_060_000n, policy), { gas: 2_575_000n, source: 'estimate', estimate: 2_060_000n });
  assert.equal((await chooseGas(async () => 5_500_000n, policy)).gas, 6_000_000n);
});

test('an estimate above the cap refuses', async () => {
  await assert.rejects(chooseGas(async () => 6_000_001n, policy), /above the cap/);
});

test('a fixed limit skips the estimate', async () => {
  let asked = 0;
  const choice = await chooseGas(async () => { asked++; return 1n; }, { ...policy, fixed: 2_700_000n });
  assert.deepEqual(choice, { gas: 2_700_000n, source: 'fixed' });
  assert.equal(asked, 0);
});

test('a transport failure falls back; a revert is rethrown, never retried with a bigger limit', async () => {
  assert.deepEqual(await chooseGas(async () => { throw Error('fetch failed'); }, policy), { gas: 3_000_000n, source: 'fallback' });
  const revert = Object.assign(Error('Execution reverted for an unknown reason.'), { name: 'ExecutionRevertedError' });
  await assert.rejects(chooseGas(async () => { throw Object.assign(Error('estimate failed'), { cause: revert }); }, policy), /estimate failed/);
});

test('environment overrides are validated', () => {
  process.env.TOPFLIGHT_GAS_LIMIT = '1.5M';
  assert.throws(() => gasPolicy(), /TOPFLIGHT_GAS_LIMIT/);
  process.env.TOPFLIGHT_GAS_LIMIT = '2700000';
  assert.equal(gasPolicy().fixed, 2_700_000n);
  delete process.env.TOPFLIGHT_GAS_LIMIT;
});

// THE GUARD OVER THE SOURCE. Every transaction the kit sends takes its limit from
// `chooseGas`. A `gas:` or `gasLimit:` property whose value is a number literal
// (in any form: 1_500_000n, 1500000, 0x16e360) anywhere in src/ fails here.
// Comments are stripped first, so a comment can neither trip nor satisfy it, and
// the positive half asserts both senders still call `chooseGas`.
function code(path: string): string {
  return readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}
test('no fixed gas limit in the kit\'s source, and both senders size gas through chooseGas', () => {
  const files = readdirSync('src', { recursive: true }).map(String).filter(f => f.endsWith('.ts')).map(f => `src/${f}`);
  assert(files.length > 5, 'PRECONDITION: the guard reads the source tree');
  for (const f of files) {
    const found = code(f).match(/\bgas(?:Limit)?\s*:\s*(?:0x[0-9a-f_]+|\d[\d_]*)n?\b/gi);
    assert.equal(found, null, `${f} carries a fixed gas limit: ${found}`);
  }
  for (const f of ['src/ledger.ts', 'src/sdk.ts']) assert.match(code(f), /chooseGas\(/, `${f} must size gas through chooseGas`);
});
