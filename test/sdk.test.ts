import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { decodeFunctionData, encodeFunctionResult, keccak256, parseTransaction, type Hex } from 'viem';
import { amountUnits, quoteBound, readSnapshot, createBot } from '../src/sdk.js';
import { ledgerAbi, makerAbi } from '../src/ledger.js';

const key = `0x${'01'.repeat(32)}` as Hex;
const hash = `0x${'11'.repeat(32)}`;
const address = `0x${'22'.repeat(20)}`;

test('amounts preserve fractional tokens and never round a numeric sale upwards', () => {
  assert.equal(amountUnits('12.345678'), 12_345_678n);
  assert.equal(amountUnits(12.3456789), 12_345_678n);
  for (const value of [0, -1, Infinity, NaN, '0', '1e6', '0.0000001', '1.1234567', '']) assert.throws(() => amountUnits(value));
  assert.equal(quoteBound(101n, 200, true), 104n);
  assert.equal(quoteBound(101n, 200, false), 98n);
  assert.throws(() => quoteBound(1n, 200, false));
  assert.throws(() => quoteBound(10n, 10001, true));
});

test('snapshot joins actual ids, pins every read, and reconstructs sparse complete-set holdings', async () => {
  const seen: bigint[] = [];
  const chain: any = {
    getBlockNumber: async () => 77n,
    readContract: async (args: any) => {
      seen.push(args.blockNumber);
      if (args.functionName === 'getAllLongPricesWad') return [[1n, 21n], [200000000000000000n, 50000000000000000n], 750000000000000000n];
      if (args.functionName === 'ladderSyncedIndex') return [true, 3n];
      if (args.functionName === 'bookOf') return { freeCollateral: 10_000_000n, pendingYield: 123n, marketExposure: 5_000_000n,
        native: [{ positionId: 1n, longBalance: 0n, shortBalance: 2_000_000n }],
        wrapped: [{ positionId: 21n, longBalance: 7_000_000n, shortBalance: 0n }] };
      throw Error('Unexpected read');
    },
    multicall: async (args: any) => {
      seen.push(args.blockNumber);
      assert.deepEqual(args.contracts.map((x: any) => x.args.at(-1)), [1n, 21n]);
      return args.contracts[0].functionName === 'getPositionDetails' ? [['One', 'ONE'], ['Twenty-one', 'TWO']] : [37500, 37500];
    },
  };
  const snapshot = await readSnapshot(chain);
  assert.deepEqual(snapshot.clubs.map(c => c.id), [1, 21]);
  assert.equal(snapshot.clubs[1]!.held, 5);
  assert.equal(snapshot.clubs[1]!.wrappedHeld, 7);
  assert.equal(snapshot.clubs[0]!.fadeHeld, 2);
  assert.equal(snapshot.clubs[1]!.payoutShare, 0.0375);
  assert.equal(snapshot.book.cash, 10);
  assert.equal(seen.length, 5);
  assert(seen.every(block => block === 77n));
  assert.equal('fair' in snapshot.clubs[0]!, false);
});

async function rpcFixture(options: { rejectSend?: boolean; reverted?: boolean; delay?: number } = {}) {
  const submitted: Hex[] = [];
  let receiptHash: Hex | undefined;
  const block = { number: '0x10', hash, parentHash: hash, nonce: '0x0000000000000000', sha3Uncles: hash,
    logsBloom: `0x${'00'.repeat(256)}`, transactionsRoot: hash, stateRoot: hash, receiptsRoot: hash,
    miner: address, difficulty: '0x0', totalDifficulty: '0x0', extraData: '0x', size: '0x1',
    gasLimit: '0x1000000', gasUsed: '0x0', timestamp: '0x123', transactions: [], uncles: [], baseFeePerGas: '0x3b9aca00' };
  const server = createServer(async (req, res) => {
    let text = ''; for await (const part of req) text += part;
    const body = JSON.parse(text);
    try {
      let result: any;
      switch (body.method) {
        case 'eth_chainId': result = '0xaa36a7'; break;
        case 'eth_blockNumber': result = '0x10'; break;
        case 'eth_getBlockByNumber': result = block; break;
        case 'eth_getTransactionCount': result = '0x0'; break;
        case 'eth_maxPriorityFeePerGas': result = '0x3b9aca00'; break;
        case 'eth_gasPrice': result = '0x77359400'; break;
        case 'eth_call': {
          const data = body.params[0].data;
          let decoded: any;
          try { decoded = decodeFunctionData({ abi: makerAbi, data }); }
          catch { decoded = decodeFunctionData({ abi: ledgerAbi, data }); }
          if (decoded.functionName === 'getAllLongPricesWad') result = encodeFunctionResult({ abi: makerAbi, functionName: 'getAllLongPricesWad', result: [[1n, 21n], [1n, 1n], 0n] });
          else if (decoded.functionName === 'getLongAndShortBalances') result = encodeFunctionResult({ abi: ledgerAbi, functionName: 'getLongAndShortBalances', result: [12_345_678n, 3_000_000n] });
          else if (decoded.functionName.startsWith('preview')) result = encodeFunctionResult({ abi: makerAbi, functionName: decoded.functionName, result: { amount: 1_234_567n, positionIds: [], longBeforeWad: [], longAfterWad: [], reserveBeforeWad: 0n, reserveAfterWad: 0n } } as any);
          else if (decoded.functionName.startsWith('buy')) result = '0x';
          else throw Error('Unhandled contract call ' + decoded.functionName);
          break;
        }
        case 'eth_sendRawTransaction':
          submitted.push(body.params[0]);
          if (options.rejectSend) throw Error('connection outcome unknown');
          receiptHash = keccak256(body.params[0]); result = receiptHash;
          if (options.delay) await new Promise(resolve => setTimeout(resolve, options.delay));
          break;
        case 'eth_getTransactionReceipt': result = receiptHash ? { transactionHash: receiptHash, transactionIndex: '0x0', blockHash: hash, blockNumber: '0x10', from: address, to: address, cumulativeGasUsed: '0x123', gasUsed: '0x123', contractAddress: null, logs: [], logsBloom: block.logsBloom, status: options.reverted ? '0x0' : '0x1', effectiveGasPrice: '0x3b9aca00', type: '0x2' } : null; break;
        default: throw Error('Unhandled RPC: ' + body.method);
      }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
    } catch (error: any) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: error.message } })); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as any).port;
  return { url: `http://127.0.0.1:${port}`, submitted, close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}

test('buy and fractional sell encode quoted bounds and opposite sale leg', async () => {
  const rpc = await rpcFixture();
  try {
    const events: string[] = [];
    const bot = createBot({ privateKey: key, rpcUrls: [rpc.url], minWriteIntervalMs: 0,
      onTransactionSigned: async () => { events.push('signed'); }, onTransactionSettled: async () => { events.push('settled'); } });
    await bot.buy(21, '8');
    await bot.sell(21, '4.321001');
    assert.equal(rpc.submitted.length, 2);
    const bought = decodeFunctionData({ abi: ledgerAbi, data: parseTransaction(rpc.submitted[0]!).data! });
    const sold = decodeFunctionData({ abi: ledgerAbi, data: parseTransaction(rpc.submitted[1]!).data! });
    assert.equal(bought.functionName, 'buyForMarket');
    assert.deepEqual(bought.args, [0n, 21n, true, 8_000_000n, 1_209_875n]);
    assert.equal(sold.functionName, 'buyExactTokensForMarket');
    assert.deepEqual(sold.args, [0n, 21n, false, 4_321_001n, 1_259_259n]);
    assert.deepEqual(events, ['signed', 'settled', 'signed', 'settled']);
    await assert.rejects(bot.sell(21, '13'), /exceeds native/);
    await assert.rejects(bot.buy(20, '8'), /not listed/);
    assert.equal(rpc.submitted.length, 2);
  } finally { await rpc.close(); }
});

test('unknown broadcast halts queued writes and never signs a replacement', async () => {
  const rpc = await rpcFixture({ rejectSend: true });
  try {
    let signed = 0;
    const bot = createBot({ privateKey: key, rpcUrls: [rpc.url], minWriteIntervalMs: 0, onTransactionSigned: async () => { signed++; } });
    const results = await Promise.allSettled([bot.buy(21, 8), bot.buy(21, 8)]);
    assert(results.every(r => r.status === 'rejected'));
    assert.equal(signed, 1);
    assert(rpc.submitted.length > 0);
    assert.equal(new Set(rpc.submitted).size, 1);
    await assert.rejects(bot.buy(21, 8), /outcome unknown/);
  } finally { await rpc.close(); }
});

test('a reverted receipt is a failure, and a journal failure prevents broadcasting', async () => {
  const rpc = await rpcFixture({ reverted: true });
  try {
    let settled = false;
    const bot = createBot({ privateKey: key, rpcUrls: [rpc.url], minWriteIntervalMs: 0, onTransactionSettled: async () => { settled = true; } });
    await assert.rejects(bot.buy(21, 8), /Trade reverted/);
    assert(settled);
    const blocked = createBot({ privateKey: key, rpcUrls: [rpc.url], onTransactionSigned: async () => { throw Error('disk full'); } });
    await assert.rejects(blocked.buy(21, 8), /disk full/);
    assert.equal(rpc.submitted.length, 1);
  } finally { await rpc.close(); }
});

test('write failover sends the identical signed transaction to the next endpoint', async () => {
  const failing = await rpcFixture({ rejectSend: true });
  const working = await rpcFixture();
  try {
    const bot = createBot({ privateKey: key, rpcUrls: [working.url], writeRpcUrls: [failing.url, working.url], minWriteIntervalMs: 0 });
    const result = await bot.buy(21, '8');
    assert.equal(result.receipt.status, 'success');
    assert(failing.submitted.length >= 1);
    assert.equal(working.submitted.length, 1);
    assert.equal(failing.submitted[0], working.submitted[0]);
    assert.equal(result.hash, keccak256(working.submitted[0]!));
  } finally { await failing.close(); await working.close(); }
});
