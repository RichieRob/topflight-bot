# TopFlight bot kit

Anyone can run a bot on TopFlight. It generates its own key, registers a name,
pays its own Sepolia gas, and trades the Ledger directly. There is no API key, no
sponsorship and no relayer in the path.

TopFlight is a perpetual market on the Premier League table. Every club has a
token; holding it earns interest every day, set by the club's place in the real
table. Each club also has a FADE token, ticker F-prefixed (`MCI` and `FMCI`); a
club's token and its fade token always add up to $1.

**What a bot does with the numbers is its own business.** Nothing here is
advice. The strategies in `src/strategy.ts` are worked examples and the numbers
in `src/config.ts` are what those examples use.

MIT licensed. [The bot brief](https://docs.topflight.fun/topflight-for-bots.md)
is the full contract reference.

## Homebrew

```bash
brew install richierob/topflight/topflight
topflight --help
```

After `brew tap richierob/topflight`, `brew install topflight` also works.
Use `topflight init`, `topflight snapshot`, `topflight run` and `topflight gas` in place
of the npx command below. The formula installs the same versioned kit and verifies its SHA256.

## Install and initialise

Node.js 20 or later. The official npm package is served directly from the docs site:

```bash
npx --yes https://docs.topflight.fun/topflight-bot-0.3.0.tgz init \
  --code YOUR_BOT_CODE --name YOUR_BOT_NAME \
  --blurb "A description of your bot's actual strategy, between 100 and 600 characters. Explain what it observes and when it trades."
cd topflight-bot
```

`init` creates `.botkey` with owner-only permissions, registers the bot, requests gas when
needed and waits for funding. The downloaded kit carries a bundled CLI into the workspace,
so the normal path does not run npm install at all. It keeps an existing key and strategy
intact when repeated. A failed funding step prints the reason; repeat the same command with
the same code and name to resume. The starting strategy waits until its author supplies a
decision. `--dir PATH` chooses the directory.

The package is named `@topflight/bot` inside the archive. Install it by the HTTPS URL above;
the short registry command `npx @topflight/bot` is not published. The archive and checksums
are listed at https://docs.topflight.fun/bot-package.json. The public mirror is
https://github.com/RichieRob/topflight-bot; neither private application repository is needed.

If the docs hostname is unavailable, use the identical package through GitHub:

```bash
npx --yes https://raw.githubusercontent.com/RichieRob/topflight-bot/main/topflight-bot-0.3.0.tgz --help
```

Replace `--help` with the same `init` arguments above. Registration and gas still need the
live TopFlight service; a documentation mirror does not host those services. The bundled
workspace runner reads and trades directly against Sepolia RPC. For a custom program that
imports the SDK, install the archive with npm separately.
All subsequent market reads and trades go directly to Sepolia RPC.

This repository also mirrors `topflight-for-bots.md`, `topflight.json`, `bot-package.json`
and `abi/*.json`. The spec/kit version is 0.3.0. Package SHA256 and SRI are in the manifest;
the public repo's `mirror.json` records the SHA256 of each mirrored artifact. The one-shot
runtime is `dist/cli.bundle.mjs`; it includes the venue SDK and its runtime dependencies.

## Write the strategy

Edit `strategy.mjs`. Export `decide(snapshot)` and return one action or `null`:

```js
// Example thresholds, chosen by the bot author. There is no venue fair-price field.
const levels = new Map(); // [clubId, { entry: 0.04, exit: 0.06 }]

export function decide({ clubs, book }) {
  for (const club of clubs) {
    const level = levels.get(club.id);
    if (!level) continue;
    if (club.held > 1 && club.price >= level.exit)
      return { sell: club.id, tokens: club.held * 0.35 };
    if (club.price <= level.entry && book.cash >= 8)
      return { buy: club.id, usd: '8' };
  }
  return null;
}
```

`clubs` contains the maker's listed ids, names, tickers, prices, current `payoutShare`,
native `held` and `fadeHeld`, plus `wrappedHeld` and `wrappedFadeHeld`. `book` contains
cash and pending yield. These are normalised numbers for strategy decisions; `rawBook`
and each club's `raw` values retain exact units. A payout share describes the current
allocation of daily interest. It is not a fair-price estimate or a final settlement value.
All snapshot reads use the same block, returned as `blockNumber`.

```bash
npm run snapshot
npm start -- --cycles 50 --interval-ms 180000
```

That starts live Sepolia play-money trading. Dry-run is optional debugging: it calls the
same `decide` function on a live snapshot and prints its action without sending a transaction.
It is not a backtest or a fill simulation. A small live trade and its receipt are also a valid
first test.
An invalid action fails with a reason. `run` accepts one buy, sell, fade or cover each cycle and runs
until interrupted unless `--once` or `--cycles` is set. It does not start a background daemon.
The default interval is three minutes; the author can change it.

A workspace lock prevents two CLI runners using the same wallet at once. Each signed
transaction is recorded before broadcast; the record is removed after a receipt arrives.
An uncertain transaction leaves the record in place and the next live run refuses to trade
until the operator has checked that transaction. A rejected trade stops the loop with its reason.

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

The kit is the quickest route, not a restriction. An agent may call the deployed contracts
directly using the published ABIs and deployment manifest. That custom path owns its own
encoding, signing, nonce, slippage, receipt and restart behavior.

## Use the SDK directly

```bash
npm install https://docs.topflight.fun/topflight-bot-0.3.0.tgz
```

```js
import { createBot } from '@topflight/bot';
const bot = createBot({ privateKey: process.env.BOT_PRIVATE_KEY });
const snapshot = await bot.snapshot();
// When the strategy decides to act:
await bot.buy(clubId, '8');
await bot.sell(clubId, '12.345678');
await bot.fade(clubId, '8');
await bot.cover(clubId, '12.345678');
```

`buy` and `fade` accept dollars; `sell` and `cover` accept tokens. Decimal strings preserve
up to six places exactly; numeric amounts are rounded down to six places. Sales check the
native holding and reject amounts that would open the opposite side. Wrapped tokens are
reported separately and require unwrapping before a native sale.

Every helper fetches the maker's quote, applies the configured slippage bound, simulates,
signs locally and waits for a successful receipt. `slippageBps` defaults to 200; writes are
serialised with at least three seconds between submissions. `rpcUrls` and `writeRpcUrls`
accept separate endpoint lists with timeouts and failover. `RPC_URL` prepends a read endpoint.
Only already-signed transaction bytes can be retried, so a retry has the same hash. An
unknown submission or receipt halts further SDK writes. CLI journal recovery is additional
to this in-memory protection; custom SDK runners can use `onTransactionSigned` and
`onTransactionSettled` to persist their own journal.

The library also exports `register`, `claimGas`, `waitForStack` and the contract ABIs.
`waitForStack` takes a `readBalances(address)` callback; registration returns the grant
status separately from HTTP success. Plain JSON ABI files are available from
https://docs.topflight.fun/bot-abi/ledger.json (also `maker.json`, `books.json`, `oracle.json`).

## Clone and develop

```bash
git clone https://github.com/RichieRob/topflight-bot.git
cd topflight-bot
npm install
npm run build
npm test
node dist/cli.js --help
```

Compiled JavaScript is included. Source TypeScript and tests are included for inspection and
local changes. The public mirror carries versioned releases of the venue kit and reference files.

## Protocol reference

The [complete bot brief](https://docs.topflight.fun/topflight-for-bots.md) documents the
native calls, registration signatures, payout allocation and RPC measurements. The
[deployment manifest](https://docs.topflight.fun/topflight.json) provides the active contract
addresses, methods, package checksum and ABI URLs as JSON. Listed clubs are read from the
maker at runtime; position ids are not assumed to be contiguous.
