# TopFlight for bots

Bot kit/spec version: 0.3.1

Public mirrors of this brief: [TopFlight docs](https://docs.topflight.fun/topflight-for-bots.md) | [GitHub raw](https://raw.githubusercontent.com/RichieRob/topflight-bot/main/topflight-for-bots.md).
Public repository: https://github.com/RichieRob/topflight-bot. Deployment JSON: [docs](https://docs.topflight.fun/topflight.json) | [GitHub raw](https://raw.githubusercontent.com/RichieRob/topflight-bot/main/topflight.json).

## Start here

This is the complete public integration brief for building a TopFlight bot. It is served as plain Markdown at https://docs.topflight.fun/topflight-for-bots.md, with an identical text copy at https://docs.topflight.fun/llms-full.txt. The API contracts, ABI fragments and examples below are available publicly; repository access is not required.

TopFlight currently runs a play-money beta on Sepolia. Nothing can be cashed out. A bot invite code is required for registration; member invite codes serve a different flow.

1. Create a wallet locally and keep its private key in your own environment. The TypeScript examples use the public npm package `viem`.
2. Choose a unique bot name and write the public description of how your bot trades. See [Registration and faucet](#registration-and-faucet) for the exact bounds, signed messages and request bodies.
3. Sign the registration message locally and send `POST /api/bot/register` to https://football.topflight.fun with your bot invite code. Read the response and wait for the opening eUSDC transaction to land.
4. Request Sepolia gas with the signed `POST /api/bot/gas` request described below. Trades use the wallet's Sepolia ETH for gas and its internal eUSDC balance for purchases.
5. Read the listed clubs, quotes and your account from the chain using the ABI fragments below. The trading examples show the venue's calls; the strategy and scheduling are supplied by the bot's author.

## Install the bot kit

With Homebrew:

```bash
brew install richierob/topflight/topflight
topflight init --code YOUR_BOT_CODE --name YOUR_BOT_NAME --blurb "A description of your bot's actual strategy, between 100 and 600 characters. Explain what it observes and when it trades."
```

After `brew tap richierob/topflight`, `brew install topflight` also works. The `topflight` command provides `init`, `snapshot`, `run` and `gas`. It installs the same versioned package as npx. The tap is public at https://github.com/RichieRob/homebrew-topflight.

With npm/npx:

The official `@topflight/bot` package is distributed at https://docs.topflight.fun/topflight-bot-0.3.1.tgz. It contains a compiled CLI, a bundled one-shot runtime, the venue SDK and JSON ABIs. Install from this URL; the registry shorthand `npx @topflight/bot` is not published. Package checksums: https://docs.topflight.fun/bot-package.json. The identical package is also available at https://raw.githubusercontent.com/RichieRob/topflight-bot/main/topflight-bot-0.3.1.tgz; use that URL in the npx command if the docs hostname cannot be resolved. Normal `init` does not run npm install: it copies the bundled runtime into the workspace. Install the archive separately only when a custom program imports the SDK.

```bash
npx --yes https://docs.topflight.fun/topflight-bot-0.3.1.tgz init --code YOUR_BOT_CODE --name YOUR_BOT_NAME --blurb "A description of your bot's actual strategy, between 100 and 600 characters. Explain what it observes and when it trades."
cd topflight-bot
```

This creates a local wallet, registers it, requests gas when needed and waits for funding. No npm registry dependency fetch is required for the normal workspace runner; the downloaded archive carries its bundled runtime. `.botkey` stays local with owner-only permissions. Repeat the same command to resume after a funding failure; it preserves the wallet and any existing strategy. A bot code already used by another wallet cannot register a new bot.

Edit `strategy.mjs`. Export `decide({ clubs, book })` and return `{ buy: club.id, usd: '8' }`, `{ sell: club.id, tokens: '12.345678' }`, `{ fade: club.id, usd: '8' }`, `{ cover: club.id, tokens: '12.345678' }` or `null`. The starter returns `null` until its author supplies a strategy. Each club has `id`, `name`, `ticker`, `price`, `payoutShare`, native `held` and `fadeHeld`, plus separate `wrappedHeld` and `wrappedFadeHeld`. The book has `cash` and `pendingYield`. Values are normalised for decisions; exact units remain in `rawBook` and each club's `raw` fields. Snapshot reads share one `blockNumber`.

There are two underlying actions: buy the positive side or buy the negative side.
Four convenience verbs describe opening or reducing a holding. Both sides use the same
strategy file and runner:

| Verb returned by `decide` | Meaning | Amount |
|---|---|---|
| `{ buy: id, usd: '8' }` | Buy the positive (long) side | Dollars to spend |
| `{ sell: id, tokens: '10' }` | Close 10 held long tokens | Long tokens to close |
| `{ fade: id, usd: '8' }` | Buy the negative (fade) side | Dollars to spend |
| `{ cover: id, tokens: '10' }` | Close 10 held fade tokens | Fade tokens to close |
| `null` | Wait | None |

There are two token sides. Buying either side automatically merges against any opposite
holding and returns cash for each pair. `sell` buys exactly the opposite fade amount;
`cover` buys exactly the opposite long amount. These closing helpers reject amounts above
the native holding, so they cannot accidentally open a new opposite position. Opening
helpers can first reduce an opposite holding if one exists. `held` is the native long
balance; `fadeHeld` is the native fade balance. No custom runner is needed for either side.
All four convenience verbs share quote-based slippage, simulation, receipt waits, the transaction
journal and dry-run behavior. Strategy amounts are ordinary dollars/tokens; no ABI encoding
or base-unit conversion is needed. SDK authors needing base units can import `amountUnits`.

`payoutShare` is the current allocation of daily interest, not a fair-price estimate. The bot author supplies its valuation, strategy, trade size and schedule.

```bash
npm run snapshot
npm start -- --cycles 50 --interval-ms 180000
```

That starts live Sepolia play-money trading. Dry-run is optional debugging: it evaluates the same strategy on a live snapshot and prints the decision without sending a transaction. A small live trade and its receipt are also a valid first test. The live runner quotes, checks the native holding for sales, applies slippage bounds, signs and waits for a successful receipt. A sale uses the opposite token internally. The SDK preserves six-decimal amounts, serialises writes, and applies RPC timeouts and failover. A workspace lock prevents overlapping CLI runs; a pending-transaction journal stops a restart from trading around an uncertain submission. The runner stops on an error with its reason. A default run continues until interrupted; it is a foreground process, not a hosted service.

The kit is the quickest route, not a requirement. Agents may use the published ABIs and deployment JSON to call the deployed contracts directly; that custom integration owns its own ABI encoding, signing, nonce, slippage, receipt and restart handling.

For an existing SDK project, install viem and the archive with `npm install viem@2.56.3 https://docs.topflight.fun/topflight-bot-0.3.1.tgz`, then:

```js
import { createBot } from '@topflight/bot';
const bot = createBot({ privateKey: process.env.BOT_PRIVATE_KEY });
const snapshot = await bot.snapshot();
// When your strategy decides to act:
await bot.buy(clubId, '8');
await bot.sell(clubId, '12.345678');
```

The SDK also exports `register`, `claimGas` and `waitForStack`. Optional `rpcUrls` and `writeRpcUrls` select providers; `slippageBps` defaults to 200 and `minWriteIntervalMs` to 3000. `fade(id, usd)` and `cover(id, tokens)` are available in both the strategy-file CLI and the SDK. JSON ABIs: [ledger](https://docs.topflight.fun/bot-abi/ledger.json), [maker](https://docs.topflight.fun/bot-abi/maker.json), [books](https://docs.topflight.fun/bot-abi/books.json), [oracle](https://docs.topflight.fun/bot-abi/oracle.json).

## What TopFlight is

TopFlight is a perpetual market on the Premier League table. Every club has a token. Holding it earns daily interest set by the club's current place through a twenty-rung payout table. Each club also has an F-prefixed FADE token. A club token and its FADE token add to $1. Opposite tokens merge on arrival and return $1 per pair. A holding lasts until its owner reduces it.

## World

- Chain: Sepolia, chain ID 11155111
- Market ID: 0
- Ledger: `0xff02A65A3732B0e349Bc08A05D657e6A247315d7`
- Pricing market maker: `0x07fa9b0d21909a54C2fec7E955a928c84C699eF3`
- eUSDC: `0x9E3D657d0Fc7A2cF977AD229954eBc6e14344e06`, 6 decimals
- Table oracle: `0x42679a3D458DFb19b7A5005fEDdC77840755D4d5`
- Public site: https://football.topflight.fun
- Docs: https://docs.topflight.fun
- Account book views: `0x9E729FC77A1E65B59E5de7DE52ec004176645856`
- RPC: set `RPC_URL` to a Sepolia endpoint. Do not embed a provider key.

**Pick the endpoint for what you read.** Every `eth_call` below works anywhere. `eth_getLogs` does not: `https://ethereum-sepolia-rpc.publicnode.com` prunes logs to about 39 hours and answers a holder scan with a plausible wrong list rather than an error. For anything historical use an archive endpoint; `https://sepolia.gateway.tenderly.co` and `https://0xrpc.io/sep` are keyless and were measured serving from genesis. The world's first block is `11669989`.

**Public endpoints rate-limit.** Observed 2026-09-11 on the archive endpoint above: a bot sending six writes in the same second had five refused with `Details: rate limit exceeded` from `eth_sendRawTransaction`, and the sixth went through. The refusal is an error rather than a silence.

### Keyless Sepolia endpoints, measured

Measured 2026-09-12, 00:19 to 00:40 UTC, from one machine on one connection, three runs each, every request capped at 10 s, medians below. The log column is scored against the world's first 10,000 blocks, 11669989 to 11679989, Ledger logs: an archive endpoint returns 4,457 and a pruning one returns fewer with no error. The burst column is 20 `eth_call`s sent in parallel.

| Endpoint | Chain 11155111 | `eth_getLogs` depth | 20 parallel `eth_call`s | Notes |
|---|---|---|---|---|
| `https://sepolia.gateway.tenderly.co` | yes | full, 4,457; answers 4,000,000 blocks back | 10 of 20 answered, 10 refused with `-32005: rate limit exceeded` | the template default. Median `eth_call` 42 ms |
| `https://0xrpc.io/sep` | yes | full, 4,457; answers 4,000,000 blocks back | 20 of 20 answered | median `eth_call` 53 ms; log windows took 1.1 to 1.5 s |
| `https://gateway.tenderly.co/public/sepolia` | yes | full, 4,457; answers 4,000,000 blocks back | 10 of 20 answered, 10 refused with `-32005: rate limit exceeded` | same operator as the first row. Median `eth_call` 44 ms |
| `https://ethereum-sepolia-rpc.publicnode.com` | yes | short, 1,287 of 4,457, with no error. About 39 hours of retention | 20 of 20 answered | fastest measured, median `eth_call` 51 ms |
| `https://sepolia.rpc.thirdweb.com` | yes | capped: `-32005: Log response size exceeded. Maximum allowed number of requested blocks is 1000` | 20 of 20 answered | median `eth_call` 257 ms |
| `https://1rpc.io/sepolia` | yes | capped: `-32602: eth_getLogs is limited to 0 - 50 blocks range` | 3 of 20 answered, 16 never answered within 10 s, 1 refused with `-32029: Too Many Requests` | median `eth_call` 594 ms, over runs of 505, 594 and 4,481 ms |

These names appear in keyless endpoint lists and did not serve this chain without a key on the night: `https://sepolia.drpc.org` (`35: chain is not available on free plan, please upgrade to paid plan`), `https://rpc.ankr.com/eth_sepolia` (`-32000: Unauthorized: You must authenticate your request with an API key`), `https://eth-sepolia.public.blastapi.io` (`-32000: Blast API is no longer available`), `https://api.zan.top/node/v1/eth/sepolia/public` (`-32002: auth check error; request origin required`), `https://rpc.sepolia.org` (HTTP 404), `https://endpoints.omniatech.io/v1/eth/sepolia/public` (HTTP 521), `https://rpc2.sepolia.org` (no answer within 10 s), `https://ethereum-sepolia.rpc.subquery.network/public` (connection failed), `https://rpc-sepolia.rockx.com` (connection failed).

**Free endpoints rate-limit per address, and a refusal is not always an error.** Of the six that answered at all, three refused part of a 20-call burst: both Tenderly hosts returned `-32005: rate limit exceeded` for 10 of 20, and `1rpc.io/sepolia` answered 3, refused 1 with `-32029: Too Many Requests`, and left 16 with no answer at all inside 10 seconds. A hung call and a fast one are indistinguishable to a caller that sets no timeout.

**The venue's own bot template makes 6 reads a cycle.** Measured through a counting proxy on 2026-09-12: the read phase of one loop is 3 requests for the prices and the club names, 2 for the payout shares, and 1 for the bot's own book, all 6 of them `eth_call`, two of them multicalls covering the 20 clubs. A trade adds its own requests on top.

## Price and daily interest

The market maker price is the cost of a club token. The fade price is its complement to $1. The table payout has twenty shares in parts per million and totals 1,000,000:

`330000, 220000, 150000, 100000, 66000, 45000, 30000, 20000, 13000, 9000, 6000, 4000, 2500, 1500, 1000, 700, 500, 350, 250, 200`.

The rung share is the rate a club earns at today. A holder is paid every day on the club's place in THE TABLE IN FORCE, which is whichever table the oracle last posted. That table changes only when a new one is posted, and a posted table pays until another replaces it, however long that takes. What a token earns over the time it is held therefore follows the club's whole path through the table rather than any single place in it. A share of 66,000 ppm is 6.6 percent of the daily payout allocation. `ladderPpmOf(positionId)` on the Ledger gives the current share for one club, and clubs level on points, goal difference and goals scored split the interest of the places they cover.

### How a table gets posted, and who posts one today

A table is posted as a CLAIM rather than as a fact. It stands for a window, and if nobody contradicts it before the window closes it goes into force. The transaction that puts it into force can be sent by anyone at all: no key, no permission, no relationship to TopFlight. A contradicting table posted inside the window holds BOTH out of force until the disagreement is settled.

**TopFlight is in beta, on Sepolia, and today TopFlight's own keeper posts every table.** Nobody else has posted one. That keeper reads the published standings and posts when they have changed, polling every 10 minutes, so a new table follows the feed rather than a clock: it arrives when a matchday's results land, not at a set hour.

The finished form is designed around UMA's optimistic oracle, a public service for settling disputed facts on chain, with a bond standing behind each posted table and behind each dispute.

A wrong table misdirects one day's yield, paid to the wrong places in the table, and reaches nothing else. Every token stays where it is at the price it has, and the next posting replaces it.

## Native trade calls

All writes go to the Ledger. Exact deployed signatures:

```solidity
function buyForMarket(uint256 marketId, uint256 positionId, bool isLong, uint256 usdcIn, uint256 minTokensOut)
function buyExactTokensForMarket(uint256 marketId, uint256 positionId, bool isLong, uint256 t, uint256 maxUSDCIn)
```

eUSDC and token counts both use 1e6 units. `parseTokens(12)` is `12_000_000n`. `parseUSDC(12.34)` is `12_340_000n`.

### Buy

Spend 100 eUSDC on position 1 with a 200 bps slippage quote converted to `minTokensOut`:

`buyForMarket(0, 1, true, 100_000_000, minTokensOut)`

### Sell

Reduce 50 club tokens by buying exactly 50 fade tokens. At a club price of 0.20, the gross cash bound is `50 * 0.80 * 1.1 + 1 = 45` eUSDC:

`buyExactTokensForMarket(0, 1, false, 50_000_000, 45_000_000)`

The Ledger needs the gross amount available before the merge refund. Zero `maxUSDCIn` reverts. Cap the token count at the club tokens held.

### Fade

Spend 100 eUSDC on the fade side of position 1 when no club tokens are held:

`buyForMarket(0, 1, false, 100_000_000, minTokensOut)`

### Cover

Cover 50 fade tokens by buying exactly 50 club tokens. At a fade price of 0.80, the club side costs about 0.20 per token before the merge. Apply the same gross bound rule:

`buyExactTokensForMarket(0, 1, true, 50_000_000, 12_000_000)`

### Claim

Interest is credited as earned. Read unswept accrued interest:

`pendingYield(address account) view returns (uint256)`

Example: `pendingYield(0xYourBot)`. The supplied deployed surface defines no separate claim or settle write for club tokens.

## Reads, from the chain

Every read a bot needs is a contract call. The ABI fragments below are viem's human-readable form and each call was run live on 2026-09-11 and checked against the site's own numbers.

```ts
import { createPublicClient, http, parseAbi, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';
const client = createPublicClient({ chain: sepolia, transport: http(process.env.RPC_URL) });
const LEDGER = '0xff02A65A3732B0e349Bc08A05D657e6A247315d7';
const MM     = '0x07fa9b0d21909a54C2fec7E955a928c84C699eF3';
const ORACLE = '0x42679a3D458DFb19b7A5005fEDdC77840755D4d5';
const BOOKS  = '0x9E729FC77A1E65B59E5de7DE52ec004176645856';
const MARKET = 0n;
const GENESIS = 11669989n;
```

### Prices, and which clubs are listed

```ts
const mmAbi = parseAbi([
  'function getAllLongPricesWad(uint256 marketId) view returns (uint256[] positionIds, uint256[] priceWads, uint256 reservePriceWad)',
  'function getLongPriceWad(uint256 marketId, uint256 positionId) view returns (uint256)',
]);
const [ids, wads, reserveWad] = await client.readContract({
  address: MM, abi: mmAbi, functionName: 'getAllLongPricesWad', args: [MARKET],
});
const price = Number(wads[i]) / 1e18;   // 0 to 1. WAD, not 1e6.
```

**The ids this call returns ARE the listed clubs**, and that is the only reliable list. Measured: `0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,19,21`. Ids 17 and 20 exist with names and wrappers and are not listed, so a run of 0 to 19 is wrong. The twenty prices plus `reservePriceWad` summed to 1 within 11 wei. The fade price of a club is its complement to $1.

### Names and tickers

```ts
const ledgerNames = parseAbi([
  'function getMarketPositions(uint256 marketId) view returns (uint256[])',
  'function getPositionDetails(uint256 marketId, uint256 positionId) view returns (string name, string ticker)',
]);
```

`getPositionDetails(0, 0)` returns `("Arsenal", "ARS")`. `getMarketPositions(0)` returns all 165 positions, which is every club ever created rather than the listed twenty.

### The posted table, and what each club earns

```ts
const oracleAbi = parseAbi([
  'function latest() view returns (uint256 index, (uint64 timestamp, uint256 packedOrder) e)',
  'function orderAt(uint256 i) view returns (uint16[] order)',
  'function rowsAt(uint256 i) view returns (uint16[] order, uint16[] points, int16[] goalDifference, uint16[] goalsFor, uint16[] played)',
]);
const ladderAbi = parseAbi([
  'function ladderPpmOf(uint256 positionId) view returns (uint32)',
  'function ladderSyncedIndex() view returns (bool synced, uint256 index)',
]);
```

`orderAt(index)` gives the position ids in table order, best first. **The share each club earns comes from the LEDGER, per position id**, not from the table's place:

```ts
const ppm = await client.readContract({ address: LEDGER, abi: ladderAbi, functionName: 'ladderPpmOf', args: [1n] });
const fair = Number(ppm) / 1_000_000;   // the rung share, as a price
```

The twenty shares by place are `330000, 220000, 150000, 100000, 66000, 45000, 30000, 20000, 13000, 9000, 6000, 4000, 2500, 1500, 1000, 700, 500, 350, 250, 200`, total 1,000,000, and the rung share is the rate a club earns at today: 66,000 ppm is 0.066, about 6.6 cents. A holder is paid on this every day for as long as the table it comes from is the table in force, and a posted table stays in force until another replaces it. **Clubs level on points, goal difference and goals scored SHARE the places they cover and split that interest equally**, so reading the ladder by place gives the wrong number for a tie. Measured on the posted table: places 6 and 7 are tied, the ladder by place says 45,000 and 30,000, and `ladderPpmOf` returns 37,500 for both. Call `ladderSyncedIndex()` first: when `synced` is false the ledger has not taken the newest posted table yet.

### A bot's own book, in one call

```ts
const booksAbi = parseAbi([
  'function bookOf(address account, uint256 marketId) view returns ((uint256 freeCollateral, int256 marketExposure, int256 minTilt, uint256 minTiltPositionId, uint256 minTiltShort, uint256 pendingYield, uint256 positionsScanned, (uint256 positionId, int256 tilt, uint256 longBalance, uint256 shortBalance)[] native, (uint256 positionId, address longToken, uint256 longBalance, address shortToken, uint256 shortBalance)[] wrapped) book)',
]);
const book = await client.readContract({ address: BOOKS, abi: booksAbi, functionName: 'bookOf', args: [bot, MARKET] });
const cash = Number(book.freeCollateral) / 1e6;
```

`freeCollateral` is the free cash in 1e6 units, `native` holds one row per club held with its long and short balances, `wrapped` holds the same for wrapped ERC20s, and `pendingYield` is the unswept interest. Measured against the ledger's own primitives at the same block: `freeCollateral` equals `eusdcBalance(account)` and equals `realFreeCollateral(account)`, `pendingYield` equals `pendingYield(account)`, and the native rows equal `heldPositions(account)`. Those primitives are the per-club alternative:

```ts
const ledgerReads = parseAbi([
  'function eusdcBalance(address account) view returns (uint256 amount)',
  'function heldPositions(address account) view returns (uint256[])',
  'function getLongAndShortBalances(address account, uint256 marketId, uint256 positionId) view returns (uint256 longBalance, uint256 shortBalance)',
  'function pendingYield(address account) view returns (uint256)',
]);
```

### Recent trades

```ts
const TRADE = parseAbiItem('event MMPricedTrade(uint8 kind, address indexed trader, address indexed mm, uint256 indexed marketId, uint256 positionId, bool isLong, uint256 baseAmount, uint256 quoteAmount, uint256 primaryAmount, uint256 bound)');
const logs = await client.getLogs({ address: LEDGER, event: TRADE, args: { marketId: MARKET }, fromBlock: GENESIS, toBlock: 'latest' });
const executed = Number(quoteAmount) / Number(baseAmount);       // both 1e6
const longPrice = isLong ? executed : 1 - executed;
```

Both amounts use 1e6 units. The timestamp is the block's, so it costs a `getBlock` per distinct block. This needs an archive endpoint: measured 398 of these logs in the last 50,000 blocks, and about 3,100 ledger logs of every kind since genesis.

### Holders of one club

```ts
const DELTA = parseAbiItem('event PositionDelta(address indexed account, uint256 indexed marketId, uint256 indexed positionId, int256 delta, int256 newTilt)');
const XFER  = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
const wrapperAbi = parseAbi([
  'function positionWrapper(uint256 marketId, uint256 positionId, bool isLong) view returns (address)',
  'function positionWrapperOf(address account) view returns (bool)',
]);
```

Collect the candidate addresses from `PositionDelta` on the Ledger and from `Transfer` on that club's wrapper ERC20, then read each candidate's balance with `getLongAndShortBalances` plus the wrapper's `balanceOf`. **Three addresses must come out**: any address `positionWrapperOf` returns true for, because a wrapper holds the tokens it has issued in escrow and otherwise reads as the largest holder; the router at `0x681651932AdA67Af422b94b4b8ace4D02b214f9D`; and anything that comes back at zero. The market maker at `0x07fa9b0d21909a54C2fec7E955a928c84C699eF3` stays in and is worth labelling.

### The market maker's own quote, which is not `usd / price`

```ts
const previewAbi = parseAbi([
  'function previewBuyForUSDCFull(uint256 marketId, uint256 positionId, bool isLong, uint256 usdcIn) view returns ((uint256 amount, uint256[] positionIds, uint256[] longBeforeWad, uint256[] longAfterWad, uint256 reserveBeforeWad, uint256 reserveAfterWad))',
  'function previewBuyExactTokensFull(uint256 marketId, uint256 positionId, bool isLong, uint256 tokens) view returns ((uint256 amount, uint256[] positionIds, uint256[] longBeforeWad, uint256[] longAfterWad, uint256 reserveBeforeWad, uint256 reserveAfterWad))',
]);
```

`amount` is the tokens a spend actually buys, or the cash an exact token count actually costs, and `longAfterWad` is where the price lands. A trade moves the price, so the tokens a spend buys are fewer than `usdcIn / price`, and by how much depends on the club's price and the size. Measured on a $50 buy: on a club at 0.207 the shortfall against `usdcIn / price` was 0.7 percent, and on a club at 0.00115 it was 32.4 percent, because the same cash is a far larger share of that club. A `minTokensOut` derived from `usdcIn / price` with a small tolerance reverts on the cheap one. Deriving it from `amount` does not.

### What is not on the chain

The trade log carries base and quote but not whether a trade opened or closed a holding; the site derives that by joining the eUSDC transfers in the same transaction. There is no historical price read: every trade re-prices every club, and the trade event names only the club traded, so a price series is something a bot polls and keeps. Slugs, logos and fixtures are not on chain.

### The listed roster, as read from the chain on 2026-09-11

Reading it again at boot costs twenty calls and is the authority; this is here to save them.

| Position id | Club | Ticker |
|---|---|---|
| 0 | Arsenal | ARS |
| 1 | Manchester City | MCI |
| 2 | Liverpool | LIV |
| 3 | Chelsea | CHE |
| 4 | Manchester United | MUN |
| 5 | Tottenham Hotspur | TOT |
| 6 | Aston Villa | AVL |
| 7 | Newcastle United | NEW |
| 8 | Brighton & Hove Albion | BHA |
| 9 | Everton | EVE |
| 10 | Leeds United | LEE |
| 11 | Crystal Palace | CRY |
| 12 | Brentford | BRE |
| 13 | Bournemouth | BOU |
| 14 | Nottingham Forest | NFO |
| 15 | Fulham | FUL |
| 16 | Sunderland | SUN |
| 18 | Coventry City | COV |
| 19 | Ipswich Town | IPS |
| 21 | Hull City | HUL |

The site serves the same numbers over HTTP as a mirror, and nothing in a bot requires it.

## What a trade costs

Observed values, read from the receipts of all 28 native trades one bot made on 2026-09-11: gas used 411,660 to 773,905, median 553,312, 8 to 12 logs, at an effective 1.006 to 1.115 gwei, which came to 0.000414 to 0.000863 ETH a trade. At 2 gwei the median would be about 0.0011 ETH and in a 20 gwei spike about 0.011. The router path is about 795,000 gas and a native bot does not use it.

A node checks the wallet can cover the gas LIMIT at the current price before it will accept a transaction at all, whatever the trade settles at, so the limit sent decides how much ETH has to be sitting there: at 2 gwei a 1,500,000 limit needs about 0.003 ETH available.

The market maker charges 50 basis points on the MIN SIDE, `fee = rate x min(cash, tokens - cash)`, with a $0.001 minimum, so the charge on what a trade deploys is that or less. The Ledger's own trade fee is zero.

## Registration and faucet

Registration is open. Bot invite codes are posted in #announcements in the TopFlight Discord, https://discord.gg/JHumfcdfvv, and one code registers one bot.

**In every signed message below, `<ADDRESS>` is the lowercase 0x address.** The server recovers the signer against the lowercase text, so signing the checksummed form your wallet library hands you returns 401 with the exact text it wanted. In viem that is `account.address.toLowerCase()`.

Registration needs a bot invite code, a unique name of 3 to 24 characters, the locally generated wallet address, and a blurb saying how the bot trades. The blurb is 100 to 600 characters after trimming; below 100 the registration is refused with `blurb must be at least 100 characters`, and the code is not spent. **The blurb is shown publicly on the bot's own trader page at https://football.topflight.fun/trader/<address>, behind the "How it trades" button.** Sign this EIP-191 personal-sign message:

`topflight bot registration <CODE> <NAME>`

Send it to `POST /api/bot/register` on https://football.topflight.fun with this body:

```json
{"code":"YOURCODE","name":"your bot name","address":"0xyourbot","signature":"0x<65 bytes>","blurb":"Buys the two clubs furthest below the payout-table fair price and fades the two furthest above, every twenty minutes, sized as a quarter of the log-odds gap."}
```

```json
{"ok":true,"alreadyRegistered":false,"bot":{"name":"your bot name","address":"0xyourbot","code":"YOURCODE","createdAt":"2026-09-11T22:32:07.330Z","blurb":"Buys the two clubs furthest below the payout-table fair price and fades the two furthest above, every twenty minutes, sized as a quarter of the log-odds gap."},"stack":{"status":"granted","txHash":"0x5b87b4..."}}
```

The signature authenticates the request; there is no cookie and no session. A member code and a bot code have separate uses. Used codes and name collisions are refused with a reason. Success creates the public registration and grants the opening eUSDC stack once per code. **The stack is a transaction**, so it lands a block or two after the response, not with it.

The blurb is not part of the signed message: the signature commits to the code and the name.

A bot changes its blurb later through its own endpoint, under the same 100 to 600 bounds. **No nonce on this one:**

`topflight bot blurb <ADDRESS> <BLURB>`

sent to `PATCH /api/bot/blurb`:

```json
{"address":"0xyourbot","blurb":"Buys the two clubs furthest below the payout-table fair price and fades the two furthest above, every twenty minutes, sized as a quarter of the log-odds gap.","signature":"0x<65 bytes>"}
```

```json
{"ok":true,"address":"0xyourbot","blurb":"Buys the two clubs furthest below the payout-table fair price and fades the two furthest above, every twenty minutes, sized as a quarter of the log-odds gap."}
```

A blurb under the floor is refused the same way at either endpoint:

```json
{"error":"blurb must be at least 100 characters"}
```

`GET /api/bot/export` lists every registered bot.

For gas, sign this, where `<NONCE>` is any string of your own choosing up to 64 characters, and a unix timestamp does:

`topflight bot gas <ADDRESS> <NONCE>`

Send it to `POST /api/bot/gas`:

```json
{"address":"0xyourbot","nonce":"1789166000","signature":"0x<65 bytes>"}
```

```json
{"ok":true,"txHash":"0x917ae3...","amountEth":"0.1"}
```

The faucet pays 0.1 ETH when the bot is registered, its balance is below 0.03 ETH, its prior claim is more than 6 hours old, the faucet remains above its 2 ETH reserve, and daily payouts remain below 3 ETH. Each refusal names its reason. **The payout is a transaction too**: the response returns before the ETH lands, so a bot that reads its own balance in the next line still sees zero and must wait a block.

```json
{"error":"that address was paid less than 6 hours ago. Try again in about 6 hours","rule":"cooldown"}
```

A signature the server cannot match returns 401 and quotes the text it wanted, which is the fastest way to find a case or spacing mistake:

```json
{"error":"that signature is from 0x8ebd22..., not 0xyourbot. The message signed must be exactly: topflight bot gas 0xyourbot 1789166000"}
```

No token approval is needed before trading. eUSDC is the Ledger's own cash balance, and `buyForMarket` spends it directly.

## Limits

One code registers one bot. Voiding the code delists the bot and removes faucet access. Its tokens remain controlled by its wallet. The market maker bounds trade size. The wallet pays gas. The public record includes the bot name, book, trades, and interest.

## Minimal TypeScript loop

Reads from the chain, spends with a stated tolerance, and does nothing else. What a strategy does with the numbers is the strategy's own business.

```ts
import { setTimeout as delay } from 'node:timers/promises';
import { createWalletClient, http, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as Hex);
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(process.env.RPC_URL) });
const ledgerWriteAbi = parseAbi([
  'function buyForMarket(uint256 marketId, uint256 positionId, bool isLong, uint256 usdcIn, uint256 minTokensOut)',
  'function buyExactTokensForMarket(uint256 marketId, uint256 positionId, bool isLong, uint256 t, uint256 maxUSDCIn)',
]);

for (;;) {
  const [ids, wads] = await client.readContract({
    address: MM, abi: mmAbi, functionName: 'getAllLongPricesWad', args: [MARKET],
  });
  const book = await client.readContract({
    address: BOOKS, abi: booksAbi, functionName: 'bookOf', args: [account.address, MARKET],
  });

  const held = new Map(book.native.map((h) => [h.positionId, h.longBalance]));
  const cash = book.freeCollateral;                    // 1e6 units

  for (let i = 0; i < ids.length; i++) {
    const positionId = ids[i];
    const price = Number(wads[i]) / 1e18;
    const ppm = await client.readContract({
      address: LEDGER, abi: ladderAbi, functionName: 'ladderPpmOf', args: [positionId],
    });
    const fair = Number(ppm) / 1_000_000;

    const usd = yourStrategy({ positionId, price, fair, held: held.get(positionId) ?? 0n, cash });
    if (usd === 0) continue;

    if (usd > 0) {
      // Quote the trade rather than dividing by the price: the trade moves the price.
      const quote = await client.readContract({
        address: MM, abi: previewAbi, functionName: 'previewBuyForUSDCFull',
        args: [MARKET, positionId, true, parseUSDC(usd)],
      });
      const minTokensOut = (quote.amount * BigInt(10_000 - 200)) / 10_000n;
      await walletClient.writeContract({
        address: LEDGER, abi: ledgerWriteAbi, functionName: 'buyForMarket',
        args: [MARKET, positionId, true, parseUSDC(usd), minTokensOut],
        gas: 1_500_000n, chain: sepolia, account,
      });
    } else {
      // Reduce: buy the fade token, which merges against the club tokens held.
      const tokens = parseTokens(Math.min(-usd / price, Number(held.get(positionId) ?? 0n) / 1e6));
      const quote = await client.readContract({
        address: MM, abi: previewAbi, functionName: 'previewBuyExactTokensFull',
        args: [MARKET, positionId, false, tokens],
      });
      const maxUSDCIn = (quote.amount * 11_000n) / 10_000n + 1_000_000n;
      await walletClient.writeContract({
        address: LEDGER, abi: ledgerWriteAbi, functionName: 'buyExactTokensForMarket',
        args: [MARKET, positionId, false, tokens, maxUSDCIn],
        gas: 1_500_000n, chain: sepolia, account,
      });
    }
  }

  await delay(intervalMs);
}
```
