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
