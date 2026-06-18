# Implementation Notes

## Bug Fix: IND Money USD Wallet Deposit Double-Conversion (Jun 4, 2026)

### What was broken

Adding a wallet deposit to a **USD cash-class asset** (e.g. "IND Money USD Wallet") via the
Deposit / Withdraw form on the Assets page was recording the transaction correctly in the
database but displaying completely wrong amounts everywhere — inflated by ~85× (the USD/INR
exchange rate).

### Root cause

`DepositWithdrawForm` (the primary deposit UI) correctly stores the transaction as:

```
quantity  = INR_amount / exchange_rate   (e.g. ₹85,000 / 85.5 = 994.15 USD units)
price     = exchange_rate                (e.g. 85.5)
```

This model is **intentional and correct**: it stores the exact USD units purchased while
preserving the historical INR cost via `price`. This is necessary so that the fund-source
netting in `transaction.service.ts` deducts the right rupee amount from the linked bank
account (`quantity × price = INR_amount`).

The bug was that **every display path** then treated the transaction like a USD stock trade
(where `quantity × price` is a USD value) and multiplied by the live USD/INR rate a second
time:

| Display location | What it did | Result |
|---|---|---|
| `cash-flow.service.ts → inrAmount()` | `(qty × rate) × usdInrRate` | ₹85,000 → ₹72.6 lakh |
| `Transactions.tsx` totals | `toInr(qty × rate, 'USD', usdToInr)` | same inflation |
| `Transactions.tsx` row | `CurrencyValue value={qty×rate} currency='USD'` | same |
| `Assets.tsx` TransactionRows | same as above | same |

Note: the **initial balance** created by `ManualAssetForm` uses `price = 1` (not the exchange
rate) because there is no fund-source to net against. `quantity × 1 = USD_amount`, which
IS in USD and should be converted — the existing code handled this correctly.

### Detection condition

A transaction on a USD cash asset is a "rate deposit" (raw = INR) if and only if:

```
assetClass === 'cash'  AND  currency === 'USD'  AND  price !== 1
```

`price !== 1` cleanly separates:
- `ManualAssetForm` initial balance → `price = 1` → raw in USD → convert via usdToInr ✓
- `DepositWithdrawForm` subsequent deposits → `price = exchange_rate (~83–90)` → raw in INR ✓

### Files changed

| File | Change |
|---|---|
| `packages/backend/src/services/cash-flow.service.ts` | `inrAmount()`: for USD cash with `price !== 1`, return `raw` directly (already INR) |
| `packages/frontend/src/pages/Transactions.tsx` | Added `txAmountInr()` helper; fixed totals and `TransactionRow` price/amount cells |
| `packages/frontend/src/pages/Assets.tsx` | Fixed `TransactionRows` price cell (shows "₹X/USD") and invested cell (formats as INR) |

### Tradeoffs / decisions not in the spec

1. **No schema migration**: The cleanest long-term fix would be adding an `exchange_rate`
   column to `transactions` so that `price` always means "price in asset's own currency".
   Chose not to do this to avoid a DB migration and keep the PR small; the `price !== 1`
   heuristic is robust for USD/INR (exchange rate is never 1).

2. **Heuristic detection**: Using `price !== 1` to distinguish "rate deposit" from "initial
   balance" is a pragmatic compromise. It would misclassify a deposit where someone manually
   entered exchange_rate = 1 in the form, but that is not a realistic USD/INR scenario.

3. **P&L column in Assets TransactionRows for USD cash**: `curVal = quantity × currentPrice`
   where `currentPrice = 1` for cash-like assets. For a "rate deposit" transaction, this gives
   a USD face value, not INR. P&L for cash wallets is therefore always shown as near-zero /
   fluctuating with exchange rate. This is pre-existing behaviour and was not changed.

4. **Transactions.tsx totals**: The `totalBuyValue` stat now correctly excludes the
   double-conversion for USD cash deposits. `totalSellValue` was fixed symmetrically.

---

## Bug Fix: Portfolio Chart Cash Spike (June 2–5) — Double-Conversion in performance.service.ts (Jun 17, 2026)

### What was broken

The "Portfolio Performance" chart showed a massive Cash spike around **June 2–5**: the Cash
category jumped from a realistic ₹5–6L to ~₹53L, inflating the total portfolio to ₹1.2Cr for
those dates, then silently correcting itself.

### Root cause

`_loadPriceTimelines` in `performance.service.ts` feeds transaction prices into the price
timeline for **every** asset, including cash-like wallets. For a USD cash wallet deposit made
via `DepositWithdrawForm`:

```
tx.price = exchange_rate  (e.g. 84)   ← rate, NOT a market price
```

For dates June 2–4, `getPriceAtDate(USD_wallet_timeline, date)` returned **84**.
Then `_calcPortfolioValue` computed:

```
value = toInr(quantity × 84, 'USD', 84)
      = quantity × 84 × 84           ← double-conversion: 84² factor
```

e.g. for 750 USD: `750 × 84 × 84 = ₹52.9L` instead of the correct `750 × 84 = ₹63,000`.

The spike resolved on June 5 because a subsequent `price = 1` transaction reset the timeline.

### Why current positions (Assets page) were unaffected

`getAllPositions` in `transaction.service.ts` explicitly overrides `currentPrice = 1` for
cash-like assets. This guard was absent from the historical chart path.

### Fix

Three changes to `performance.service.ts`:

1. **New constant** `PRICE_ALWAYS_ONE_CLASSES = new Set(['cash', 'lended', 'fixed_deposit', 'ppf', 'epf'])`.
2. **`_loadPriceTimelines`**: Skip adding `tx.price` to the timeline for any asset in
   `PRICE_ALWAYS_ONE_CLASSES` — their "price" in a transaction is an exchange rate, not a
   market price, and must never be used for historical valuation.
3. **`_calcPortfolioValue` and `_calcPortfolioValueByCategory`**: When computing historical
   portfolio value, force `price = 1` for cash-like assets regardless of what the timeline
   contains. Mirrors the same guard already present in `getAllPositions`.

### Tradeoffs / decisions

- Used a dedicated `PRICE_ALWAYS_ONE_CLASSES` rather than reusing the broader
  `CASH_LIKE_ASSET_CLASSES` (which includes `bonds` and `external_portfolio`). Bonds have
  real market prices so they should not be forced to price=1.
- The fix is also a defence against future form changes that might change encoding conventions:
  even if someone adds a new deposit path, cash wallets will always use price=1 in chart calc.
