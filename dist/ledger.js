import { createPublicClient, createWalletClient, http, parseAbi, parseAbiItem, } from 'viem';
import { sepolia } from 'viem/chains';
import { world, defaults } from './config.js';
export const ledgerAbi = parseAbi([
    'function buyForMarket(uint256 marketId,uint256 positionId,bool isLong,uint256 usdcIn,uint256 minTokensOut)',
    'function buyExactTokensForMarket(uint256 marketId,uint256 positionId,bool isLong,uint256 t,uint256 maxUSDCIn)',
    'function getMarketPositions(uint256 marketId) view returns (uint256[])',
    'function getPricingMM(uint256 marketId) view returns (address)',
    'function realFreeCollateral(address account) view returns (uint256)',
    'function getLongAndShortBalances(address account,uint256 marketId,uint256 positionId) view returns (uint256 longBalance,uint256 shortBalance)',
    'function heldPositions(address account) view returns (uint256[])',
    'function getPositionLiquidity(address account,uint256 marketId,uint256 positionId) view returns (uint256 realFreeCollateral,int256 marketExposure,int256 tilt)',
    'function getMinTilt(address account,uint256 marketId) view returns (int256 minTilt,uint256 minPositionId)',
    'function pendingYield(address account) view returns (uint256)',
    'function eusdcBalance(address account) view returns (uint256 amount)',
    'function getPositionDetails(uint256 marketId,uint256 positionId) view returns (string name,string ticker)',
    'function ladderPpmOf(uint256 positionId) view returns (uint32)',
    'function ladderSyncedIndex() view returns (bool synced,uint256 index)',
    'function positionWrapper(uint256 marketId,uint256 positionId,bool isLong) view returns (address)',
    'function positionWrapperOf(address account) view returns (bool)',
]);
export const oracleAbi = parseAbi([
    'function latest() view returns (uint256 index,(uint64 timestamp,uint256 packedOrder) e)',
    'function orderAt(uint256 i) view returns (uint16[] order)',
    'function rowsAt(uint256 i) view returns (uint16[] order,uint16[] points,int16[] goalDifference,uint16[] goalsFor,uint16[] played)',
]);
export const booksAbi = parseAbi([
    'function bookOf(address account,uint256 marketId) view returns ((uint256 freeCollateral,int256 marketExposure,int256 minTilt,uint256 minTiltPositionId,uint256 minTiltShort,uint256 pendingYield,uint256 positionsScanned,(uint256 positionId,int256 tilt,uint256 longBalance,uint256 shortBalance)[] native,(uint256 positionId,address longToken,uint256 longBalance,address shortToken,uint256 shortBalance)[] wrapped) book)',
]);
export const erc20Abi = parseAbi([
    'function balanceOf(address account) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
]);
export const tradeEvent = parseAbiItem('event MMPricedTrade(uint8 kind,address indexed trader,address indexed mm,uint256 indexed marketId,uint256 positionId,bool isLong,uint256 baseAmount,uint256 quoteAmount,uint256 primaryAmount,uint256 bound)');
export const deltaEvent = parseAbiItem('event PositionDelta(address indexed account,uint256 indexed marketId,uint256 indexed positionId,int256 delta,int256 newTilt)');
export const transferEvent = parseAbiItem('event Transfer(address indexed from,address indexed to,uint256 value)');
export const makerAbi = parseAbi([
    'function getAllLongPricesWad(uint256 marketId) view returns (uint256[] positionIds,uint256[] priceWads,uint256 reservePriceWad)',
    'function previewBuyExactTokensFull(uint256 marketId,uint256 positionId,bool isLong,uint256 tokens) view returns ((uint256 amount,uint256[] positionIds,uint256[] longBeforeWad,uint256[] longAfterWad,uint256 reserveBeforeWad,uint256 reserveAfterWad))',
    'function previewBuyForUSDCFull(uint256 marketId,uint256 positionId,bool isLong,uint256 usdcIn) view returns ((uint256 amount,uint256[] positionIds,uint256[] longBeforeWad,uint256[] longAfterWad,uint256 reserveBeforeWad,uint256 reserveAfterWad))',
]);
export const parseTokens = (count) => BigInt(Math.max(0, Math.round(count))) * 1000000n;
export const parseUSDC = (amount) => BigInt(Math.max(0, Math.round(amount * 1e6)));
export function resolveTrade(idx, board, priced) {
    const id = priced.positionIds[idx];
    if (id == null)
        throw Error(`REFUSING THE TRADE: slot ${idx} has no position id`);
    const club = board.clubs?.[idx];
    if (club && Number(id) !== idx)
        throw Error(`REFUSING THE TRADE: slot ${idx} is ${club.name} in the roster, but the price vector puts position ${id} there`);
    const price = priced.prices[idx];
    if (price == null || !Number.isFinite(price))
        throw Error(`REFUSING THE TRADE: position ${id} is not priced by the market maker, so it cannot be bought on this board`);
    return { positionId: BigInt(id), price, label: club?.name ?? `position ${id}` };
}
export function clients(account) {
    const transport = http(world.rpcUrl);
    return {
        publicClient: createPublicClient({ chain: sepolia, transport }),
        walletClient: account ? createWalletClient({ account, chain: sepolia, transport }) : undefined,
    };
}
export async function sendTrade(wallet, account, trade) {
    if (trade.usdcIn != null)
        return wallet.writeContract({
            account,
            chain: sepolia,
            address: world.ledger,
            abi: ledgerAbi,
            functionName: 'buyForMarket',
            args: [
                world.marketId,
                trade.positionId,
                trade.isLong,
                trade.usdcIn,
                trade.minTokensOut ?? 0n,
            ],
            gas: defaults.gasLimit,
        });
    if (trade.tokens == null || trade.maxUSDCIn == null)
        throw Error('exact-token trade requires tokens and maxUSDCIn');
    return wallet.writeContract({
        account,
        chain: sepolia,
        address: world.ledger,
        abi: ledgerAbi,
        functionName: 'buyExactTokensForMarket',
        args: [world.marketId, trade.positionId, trade.isLong, trade.tokens, trade.maxUSDCIn],
        gas: defaults.gasLimit,
    });
}
export async function chainPrices(client) {
    const [ids, wads] = await client.readContract({
        address: world.maker,
        abi: makerAbi,
        functionName: 'getAllLongPricesWad',
        args: [world.marketId],
    });
    return { positionIds: ids.map(Number), prices: wads.map((x) => Number(x) / 1e18) };
}
