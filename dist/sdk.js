import { createPublicClient, createWalletClient, encodeFunctionData, fallback, http, isAddress, keccak256, parseUnits, } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { world, defaults } from './config.js';
import { booksAbi, ledgerAbi, makerAbi } from './ledger.js';
export function amountUnits(value) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER / 1e6)
            throw Error('Amount must be positive, finite and safely representable; use a decimal string for large amounts');
        value = (Math.floor(value * 1e6) / 1e6).toFixed(6);
    }
    if (!/^\d+(?:\.\d{1,6})?$/.test(value))
        throw Error('Amount must be a positive decimal with at most six decimal places');
    const units = parseUnits(value, 6);
    if (units <= 0n || units >= 2n ** 256n)
        throw Error('Amount is outside the positive uint256 range');
    return units;
}
export function quoteBound(quoted, slippageBps, maximum) {
    if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 1000)
        throw Error('slippageBps must be an integer between 0 and 1000');
    if (quoted <= 0n)
        throw Error('Maker returned an empty quote');
    const scaled = quoted * BigInt(10000 + (maximum ? slippageBps : -slippageBps));
    const bound = maximum ? (scaled + 9999n) / 10000n : scaled / 10000n;
    if (bound === 0n)
        throw Error('Quote is too small for a nonzero slippage bound');
    return bound;
}
function transport(urls) {
    if (!urls.length)
        throw Error('At least one RPC URL is required');
    for (const url of urls) {
        if (!['http:', 'https:'].includes(new URL(url).protocol))
            throw Error('RPC must use HTTP(S)');
    }
    return fallback(urls.map(url => http(url, { timeout: 12_000, retryCount: 0 })), {
        rank: false, retryCount: 1, retryDelay: 1000,
    });
}
const zero = '0x0000000000000000000000000000000000000000';
const normalized = (value) => Number(value) / 1e6;
export async function readSnapshot(chain, account = zero) {
    if (!isAddress(account))
        throw Error('Invalid account address');
    const blockNumber = await chain.getBlockNumber({ cacheTime: 0 });
    const [ids, prices, reserve] = await chain.readContract({
        address: world.maker, abi: makerAbi, functionName: 'getAllLongPricesWad',
        args: [world.marketId], blockNumber,
    });
    const details = await chain.multicall({
        blockNumber, allowFailure: false,
        contracts: ids.map(id => ({ address: world.ledger, abi: ledgerAbi,
            functionName: 'getPositionDetails', args: [world.marketId, id] })),
    });
    const shares = await chain.multicall({
        blockNumber, allowFailure: false,
        contracts: ids.map(id => ({ address: world.ledger, abi: ledgerAbi,
            functionName: 'ladderPpmOf', args: [id] })),
    });
    const [ladderSynced, ladderIndex] = await chain.readContract({
        address: world.ledger, abi: ledgerAbi, functionName: 'ladderSyncedIndex', blockNumber,
    });
    const rawBook = await chain.readContract({
        address: world.books, abi: booksAbi, functionName: 'bookOf',
        args: [account, world.marketId], blockNumber,
    });
    const clubs = ids.map((id, i) => {
        if (id > BigInt(Number.MAX_SAFE_INTEGER))
            throw Error('Position id exceeds safe integer range');
        const native = rawBook.native.find(row => row.positionId === id);
        const wrapped = rawBook.wrapped.find(row => row.positionId === id);
        const held = native?.longBalance ?? (rawBook.marketExposure > 0n ? rawBook.marketExposure : 0n);
        const fadeHeld = native?.shortBalance ?? 0n;
        return {
            id: Number(id), name: details[i][0], ticker: details[i][1],
            price: Number(prices[i]) / 1e18, payoutShare: Number(shares[i]) / 1e6,
            held: normalized(held), fadeHeld: normalized(fadeHeld),
            wrappedHeld: normalized(wrapped?.longBalance ?? 0n),
            wrappedFadeHeld: normalized(wrapped?.shortBalance ?? 0n),
            raw: { held, fadeHeld, priceWad: prices[i], payoutPpm: shares[i] },
        };
    });
    return { account, blockNumber, clubs, ladderSynced, ladderIndex,
        reservePrice: Number(reserve) / 1e18,
        book: { cash: normalized(rawBook.freeCollateral), pendingYield: normalized(rawBook.pendingYield) },
        rawBook };
}
export function createBot(options = {}) {
    const slippage = options.slippageBps ?? 200;
    quoteBound(10000n, slippage, false);
    const interval = options.minWriteIntervalMs ?? 3000;
    if (!Number.isFinite(interval) || interval < 0)
        throw Error('Invalid minimum write interval');
    const urls = options.rpcUrls ?? [
        ...(process.env.RPC_URL ? [process.env.RPC_URL] : []),
        'https://ethereum-sepolia-rpc.publicnode.com', 'https://0xrpc.io/sep',
        'https://sepolia.gateway.tenderly.co',
    ];
    const publicClient = createPublicClient({ chain: sepolia, transport: transport(urls) });
    const account = options.privateKey ? privateKeyToAccount(options.privateKey) : undefined;
    const writeClient = createPublicClient({ chain: sepolia, transport: transport(options.writeRpcUrls ?? urls) });
    const wallet = account ? createWalletClient({ account, chain: sepolia,
        transport: transport(options.writeRpcUrls ?? urls) }) : undefined;
    let queue = Promise.resolve();
    let stopped;
    let lastWrite = 0;
    function trade(id, value, isLong, closing) {
        const task = queue.then(async () => {
            if (stopped)
                throw stopped;
            if (!wallet || !account)
                throw Error('A private key is required to trade');
            if (!Number.isSafeInteger(id) || id < 0)
                throw Error('Invalid club id');
            const amount = amountUnits(value);
            const delay = interval - (Date.now() - lastWrite);
            if (delay > 0)
                await new Promise(resolve => setTimeout(resolve, delay));
            if (await publicClient.getChainId() !== sepolia.id || await writeClient.getChainId() !== sepolia.id)
                throw Error('RPC is not on Sepolia');
            const [listed] = await publicClient.readContract({ address: world.maker, abi: makerAbi,
                functionName: 'getAllLongPricesWad', args: [world.marketId] });
            if (!listed.includes(BigInt(id)))
                throw Error(`Club ${id} is not listed by the maker`);
            if (closing) {
                const [long, fade] = await publicClient.readContract({ address: world.ledger, abi: ledgerAbi,
                    functionName: 'getLongAndShortBalances', args: [account.address, world.marketId, BigInt(id)] });
                if (amount > (isLong ? fade : long))
                    throw Error('Sale exceeds native holding; wrapped holdings must be unwrapped first');
            }
            const quote = await publicClient.readContract({ address: world.maker, abi: makerAbi,
                functionName: closing ? 'previewBuyExactTokensFull' : 'previewBuyForUSDCFull',
                args: [world.marketId, BigInt(id), isLong, amount] });
            const data = encodeFunctionData({ abi: ledgerAbi,
                functionName: closing ? 'buyExactTokensForMarket' : 'buyForMarket',
                args: [world.marketId, BigInt(id), isLong, amount, quoteBound(quote.amount, slippage, closing)] });
            await publicClient.call({ account: account.address, to: world.ledger, data, gas: defaults.gasLimit });
            const request = await wallet.prepareTransactionRequest({ account, to: world.ledger, data, gas: defaults.gasLimit });
            const serializedTransaction = await wallet.signTransaction(request);
            const hash = keccak256(serializedTransaction);
            await options.onTransactionSigned?.({ hash, nonce: request.nonce });
            lastWrite = Date.now();
            try {
                await writeClient.sendRawTransaction({ serializedTransaction });
            }
            catch (cause) {
                stopped = new Error(`Submission outcome unknown for ${hash}. Writes stopped; inspect this hash and nonce before restarting.`, { cause });
                throw stopped;
            }
            let receipt;
            try {
                receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
            }
            catch (cause) {
                stopped = new Error(`Receipt unknown for ${hash}. Writes stopped; inspect this hash before restarting.`, { cause });
                throw stopped;
            }
            await options.onTransactionSettled?.({ hash, receipt });
            if (receipt.status !== 'success')
                throw Error(`Trade reverted: ${hash}`);
            return { hash, receipt };
        });
        queue = task.catch(() => undefined);
        return task;
    }
    return { address: account?.address, publicClient,
        snapshot: (address) => readSnapshot(publicClient, address ?? account?.address ?? zero),
        buy: (id, usd) => trade(id, usd, true, false),
        sell: (id, tokens) => trade(id, tokens, false, true),
        fade: (id, usd) => trade(id, usd, false, false),
        cover: (id, tokens) => trade(id, tokens, true, true),
    };
}
