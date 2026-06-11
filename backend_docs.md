# Backend Documentation: AdvisorsME Financial Engine

**Source of Truth** for system logic, data architecture, and operational flows.
**Last updated:** 2026-05-18 (added §13 `engine2` — PDF → Excel formula-linked model via Gemini 3.1 Pro)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FastAPI Server (port 8000)               │
├────────────────┬──────────────────┬─────────────────────────────┤
│  PDF Extractor │  Historical Agent │    Financial Engine         │
│  (AgentixPdf)  │  (Gemini + Tools) │    (app/engine/)            │
│                │                   │                             │
│  Extracts      │  Maps extracted   │  Computes IS, BS, CFS      │
│  tables from   │  tables to Lv3    │  from assumptions +         │
│  PDF via AI    │  historical data  │  historical data            │
├────────────────┴──────────────────┴─────────────────────────────┤
│  engine2 (NEW)  PDF → formula-linked Excel via Gemini 3.1 Pro   │
│  Mounted at /engine2  (see §13)                                  │
├──────────────────────────────────────────────────────────────────┤
│                         Firestore                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │  statements/  │  │ calculations/│  │  users/          │       │
│  │  (raw tables) │  │ (processed)  │  │  (auth)          │       │
│  └──────────────┘  └──────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

> **Two engines live side-by-side.** The original `app/engine/` runs the
> Firestore-driven 5-step cascade (assumptions + historical data → forecasts).
> The new `app/engine2/` is a stand-alone PDF → Excel pipeline that does not
> use Firestore; it sends PDFs to Gemini 3.1 Pro and writes a formula-linked
> workbook. UI clients can call either. See §13 for the engine2 contract.

---

## 2. Firestore Schema

### 2.1 Collection: `statements/{client_id}/client_statements/`

**Purpose:** Raw extracted financial tables from PDF documents.

```
{
  "table_english": "Revenue,2023,2022,2021\nSales,40067175,...",
  "title_english": "Statement of Comprehensive Income",
  "financial_bucket": "Statement of Comprehensive Income",
  "statement_year": 2023,
  "metadata": { "type": "normal", "note_number": null },
  "has_error": false
}
```

**Financial Buckets:**
| Bucket | Contains |
|---|---|
| `Statement of Comprehensive Income` | Revenue, COGS, expenses, net income |
| `Notes of Statement of Comprehensive Income` | S&M, G&A line item breakdowns |
| `Statement of Financial Position` | Assets, liabilities, equity |
| `Notes of Statement of Financial Position` | PP&E schedules, debt, WC details |
| `Statement of Cash Flows` | CFO, CFI, CFF |
| `Statement of Changes in Equity` | Share capital, reserves, RE movements |

### 2.2 Collection: `calculations/{client_id}/`

```
calculations/{client_id}/
├── assumptions/
│   └── current              ← Stored assumptions JSON
├── historical_lv1/
│   ├── IS-CON               ← Income Statement (historical)
│   ├── BS                   ← Balance Sheet (historical)
│   ├── CF                   ← Cash Flow Statement (historical, AI-extracted from Statement of Cash Flows bucket)
│   └── _validation          ← Post-extraction validation warnings (written by generate-all)
├── historical_lv3/
│   ├── S&M, G&A, FA, WC, DEBT
├── forecasting_lv1/
│   ├── IS-CON               ← Forecasted Income Statement
│   ├── BS                   ← Forecasted Balance Sheet
│   └── CF                   ← Forecasted Cash Flow Statement
└── forecasting_lv3/
    ├── S&M, G&A, FA, WC, DEBT, equity, eosp
```

### 2.3 Document Format & Ordering

Every document contains line items with year keys. **Output includes both historical AND forecast years.**

**Key ordering is guaranteed by the API.** Firestore does not preserve key order, so `routes.py` re-orders all responses using `MODULE_KEY_ORDER` before returning to the UI. The frontend can iterate keys in the received order — no client-side reordering needed.

Section headers (BS and CF) are rows with `"is_header": true` and no year values. The frontend should detect `is_header` and render these as visual dividers:

```json
{
  "revenue": {
    "param_name": "Revenue",
    "2019": 28000000,
    "2020": 31500000,
    "2023": 40067175,
    "2024": 61302778,
    "2028": 82504226
  }
}
```

---

## 3. The Level Hierarchy

### Level 1 (Lv1) — Primary Statements
| Doc | Description |
|---|---|
| IS-CON | Income Statement — Revenue through Net Income |
| BS | Balance Sheet — Assets, Liabilities, Equity |
| CF | Cash Flow Statement — FCF, Cash Reconciliation |

### Level 3 (Lv3) — Sub-Module Detail
| Doc | Feeds Into |
|---|---|
| S&M | IS-CON selling expenses |
| G&A | IS-CON admin expenses |
| FA | IS-CON depreciation, BS PPE |
| WC | BS current assets/liabilities, CF working capital |
| DEBT | IS-CON finance costs, BS borrowings |
| equity | BS equity section |
| eosp | BS EOSB, CF EOSI |
| BV | Business Valuation — DCF + sensitivity + trailing multiples (optional) |
| Comps | Comparable Companies — forward EV/EBITDA scenarios (optional, depends on BV) |
| VM | Valuation Methodology — football field + weighted fair value (optional, depends on BV + Comps) |

### Level Connections
```
S&M.totalSellingMarketingExpenses  →  IS-CON.sellingMarketingExpenses
G&A.totalGeneralAdminExpenses      →  IS-CON.generalAdminExpenses
FA.depreciation                    →  IS-CON.depreciationAmortization
FA.closingNBV                      →  BS.propertyAndEquipment
DEBT.financeCosts                  →  IS-CON.financeCosts
DEBT.currentPortion                →  BS.shortTermBorrowings
DEBT.nonCurrentPortion             →  BS.longTermBorrowings (via closingBalance)
WC items                           →  BS current assets/liabilities
WC.changeInWorkingCapital          →  CF.workingCapital (forecast only; historical uses BS NWC changes)
equity components                  →  BS equity, CF equity movements
eosp.terminationBenefits           →  BS.employeeTerminationBenefits
CF.closingBalance                  →  BS.cashAndCashEquivalents
```

### Historical Data Computations

Lv1 modules (IS-CON, BS, CF) do **not** simply pass through raw Firestore values for historical years. They compute derived/subtotal/total rows from the raw line items, matching the Excel model's logic:

**IS-CON historical computed rows:**
| Row | Formula |
|---|---|
| `grossProfit` | `revenue + costOfRevenue` |
| `totalExpenses` | `sellingMarketingExpenses + generalAdminExpenses` |
| `operatingProfit` | `grossProfit + totalExpenses` |
| `EBITDA` | `operatingProfit + equityIncome + fairValueLoss + otherIncomeLoss + oneOffItems` |
| `netIncome` | `EBITDA - \|D&A\| - \|financeCosts\| - \|zakat\|` (US3-R1: renamed from `netIncomeLoss`) |

**`oneOffItems` field:** An optional Firestore field in IS-CON lv1 for one-time items (e.g., impairment provisions) that appear between Operating Profit and EBITDA in the audited statements. These flow into historical EBITDA but are intentionally **not** included in `otherIncomeLoss` — keeping the forecast `other_income` seed clean. Store in Firestore as a year-keyed dict with negative values (expenses).

**IS-CON historical sign correction:** Firestore stores expense items (costOfRevenue, sellingMarketingExpenses, generalAdminExpenses, depreciationAmortization, financeCosts, zakat) as **positive** values. After merging historical data, the IS-CON calculator forces these to negative using `-abs(val)`. This ensures all derived-row formulas work correctly (e.g., `grossProfit = revenue + costOfRevenue` where COGS is negative).

**BS historical computed rows:**
| Row | Formula |
|---|---|
| `totalCurrentAssets` | sum of cash, trade receivables, due from RP, inventories, prepayments |
| `totalNonCurrentAssets` | sum of PPE, investments at FV, equity investment, other receivables NC |
| `totalAssets` | `totalCurrentAssets + totalNonCurrentAssets` |
| `totalCurrentLiabilities` | sum of ST borrowings, trade payables, accrued expenses, due to RP, zakat payable |
| `otherLiabilities` | positive residual `totalAssets − totalEquity − totalCurrentLiabilities − Σ(canonical NCL rows)` — plug for liability lines the canonical schema has no slot for (US3-R3) |
| `totalNonCurrentLiabilities` | sum of EOSB, due to RP NC, otherLiabilities |
| `otherReserves` | `shareholdersEquity - (shareCapital + statutoryReserve + retainedEarnings)` — plug for unextracted equity components (General Reserve, Revaluation Reserve, etc.) |
| `totalEquity` | `shareCapital + statutoryReserve + otherReserves + retainedEarnings` |
| `totalLiabilitiesAndEquity` | `totalCurrentLiabilities + totalNonCurrentLiabilities + totalEquity` |

**`otherReserves` plug:** Many clients have equity components (General Reserve, Revaluation Reserve, Partners' Accounts) that the AI extraction prompt may not name as individual line items. The BS calculator computes the gap between the AI-extracted `shareholdersEquity` total and the sum of known components (SC + SR + RE). Any gap > 1 SAR is stored as `otherReserves`. For the forecast, `otherReserves` is held flat at the last historical value. This ensures BS always balances regardless of extraction completeness. When the gap = 0 (all components were extracted), `otherReserves` is omitted from the output.

**`otherLiabilities` plug (US3-R3):** The liabilities-side counterpart of `otherReserves`. For each historical year, after totals are computed, the BS calculator checks whether the canonical liability rows (ST borrowings, trade payables, accrued expenses, due-to-RP current/non-current, zakat payable, EOSB) plus equity sum to total assets. Any **positive** shortfall is stored as `otherLiabilities` in the non-current-liabilities section (a negative shortfall — total assets too low, e.g. a mis-extracted FV investment — is left visible, not plugged). For the forecast, `otherLiabilities` is held flat at the last historical value (0 when the last historical year already balances).

**BS zero-fill:** After merging historical data, the BS calculator fills missing year values with 0 for all non-header, non-total data rows. This handles items like `investmentsAtFairValue` that are `None` in Firestore after divestment (2022+) but should display as 0. Without this, those cells would be absent from the output, breaking totals and the UI display.

**BS historical key mapping** — Firestore uses different key names for some BS items:
| Engine Key | Firestore Key |
|---|---|
| `prepayments` | `prepaymentsAndOtherReceivables` |
| `investmentsAtFairValue` | `investmentsAtFairValueThroughProfitOrLoss` |
| `accruedExpenses` | `accruedExpensesAndOtherLiabilities` |
| `otherReceivablesNonCurrent` | `otherReceivables` |
| `dueToRelatedParties` | `dueToRelatedPartiesLiabilities` |
| `dueToRelatedPartiesNonCurrent` | `dueToRelatedPartiesCurrent` |

**IMPORTANT:** The last two mappings are counterintuitive — the Firestore key names are swapped relative to their actual meaning.

**CF historical — dual source:**

The engine stores **two separate CF representations** for historical years:

1. **Engine-computed CF** (`cf.py` calculator) — derives all CF components from BS balance changes, producing the FCF model (see table below). Used in the merged forecast+historical export and in `GET /engine/results/{client_id}/CF`.
2. **AI-extracted CF** (`historical_lv1/CF` Firestore doc) — the `extraction_historical_cf` Gemini prompt reads the `Statement of Cash Flows` bucket from `statements/` and extracts the direct-method statement structure: `operatingActivities`, `investingActivities`, `financingActivities`, `netCashChange`, `openingCash`, `closingCash` plus individual line items. Used in `GET /engine/historical/{client_id}/CF` and the historical-only Excel export.

The two representations are intentionally independent. The FCF model reconciles to BS cash changes; the direct-method statement reflects the audited financial statement layout.

**CF historical computed rows (derived from BS data directly, for engine-computed CF):**

All CF historical components are computed from BS balance changes (not WC/FA modules),
matching the Excel approach. "Others" acts as a plug to ensure FCF always reconciles
to actual cash movement.

| Row | Formula | Source |
|---|---|---|
| `netIncome` | from IS-CON `netIncomeLoss` | IS-CON |
| `depreciationAmortization` | `\|D&A from IS-CON\|` | IS-CON hist |
| `endOfServiceIndemnities` | `EOSB[year] - EOSB[year-1]` | BS |
| `cashIncome` | `netIncome + D&A + EOSI` | computed |
| `workingCapital` | `NWC[year-1] - NWC[year]` where NWC = BS current assets(WC) - BS current liabilities(WC) | BS |
| `capitalExpenditures` | `-(BS_PPE[year] - BS_PPE[year-1] + D&A)` | BS + IS-CON |
| `debtFinancing` | `totalDebt[year] - totalDebt[year-1]` | BS |
| `freeCashFlows` | `cash_change - equity_movements` (for reconciled years) | BS |
| `othersFCF` | **plug**: `FCF - cashIncome - WC - capex - debtFinancing` | derived |
| `equityPartnersAccounts` | `ΔRetainedEarnings - netIncome` (non-NI equity changes) | BS |
| `closingBalance` | `openingBalance + FCF + equity movements` | computed |
| `difference` | `closingBalance - cashBalancePerBS` (always 0) | computed |

**NWC items from BS** — current assets: `tradeReceivables`, `dueFromRelatedParties`, `inventories`,
`prepaymentsAndOtherReceivables`; current liabilities: `tradePayables`,
`accruedExpensesAndOtherLiabilities`, `dueToRelatedPartiesLiabilities`, `zakatPayable`,
`amountsDueToCustomersForContractWork` (construction contract advance — present for ESCO and similar clients).

**CF historical year determination:** The engine determines which years to compute historical CF rows for using only the `cash_series` (BS `cashAndCashEquivalents`). Years that have D&A or RE data but no cash balance are excluded. This is important because construction clients (ESCO) may have RE/D&A data from an additional prior year that doesn't appear in the cash balance series — including it would cause wrong first-year EOSI and WC delta calculations.

**Why Others is a plug:** IS-CON historical netIncome may have known errors (D&A double-counting
when G&A includes depreciation, fairValueLoss sign flip in Firestore). Rather than propagating
these errors into FCF, the "Others" row absorbs the difference so that FCF always reconciles
to the actual cash change from BS. This means the CF statement is always internally consistent,
even when individual components have data quality issues.

The orchestrator passes IS-CON historical data to the CF calculator via the `_is_con` key inside the historical dict, alongside BS data. CF historical data (if any) is passed via `_cf`.

**WC historical computation:** The WC calculator computes `changeInWorkingCapital` for historical years (not just forecast) by calculating the year-over-year difference in `operatingWorkingCapital`. Note: the CF module uses BS data directly for WC (not the WC module), since the WC Firestore data includes items that differ from the BS current items.

**WC forecast seed (IMPORTANT):** The forecast `changeInWorkingCapital` is computed AFTER the historical OWC loop, using `prev_owc_h` (the last historical `operatingWorkingCapital` value from the data dict, post-merge) as the seed. This avoids a seed mismatch that occurred when using `_compute_historical_owc` (which reads raw Firestore and can pick stale prior-year values for items missing in the reporting year).

**CF SR reconciliation (IMPORTANT):** Statutory Reserve (SR) transfers are internal RE→SR reclassifications and do NOT affect cash. In the CF forecast reconciliation, `equityStatutoryReserve` is recorded for display but excluded from the `closingBalance` computation. Only external equity movements (new capital injections, dividends paid) affect closing cash. Dividends are read from `equity_data["re_dividends"]` (stored negative as a deduction from RE).

### D&A Double-Count Pattern (client-specific)

Some clients (e.g. US-1) embed D&A fully within G&A and S&M cost centers in their income statement structure. When the IS-CON lv1 Firestore also contains a `depreciationAmortization` key (from a supplementary disclosure footnote), the engine subtracts D&A twice: once in Operating Profit (via G&A/S&M line items) and once explicitly below EBITDA.

**Detection:** EBITDA = Operating Profit (no add-back) and Net Income is understated by the full D&A amount.

**Resolution for affected clients:**
1. Zero out `depreciationAmortization` year values in IS-CON Firestore lv1 (removes double-count for historical years)
2. Zero out the `"depreciation"` item in G&A and S&M assumptions (removes double-count for forecast years — FA module provides the authoritative D&A below EBITDA)

**Note:** When `depreciationAmortization` is zeroed in Firestore, the IS-CON historical formula produces EBITDA = OP (no D&A add-back) and `netIncomeLoss = EBITDA - financeCosts - zakat`. This is technically correct for the IS-CON structure where D&A is embedded in operating expenses rather than shown as a separate line.

### US-3 Review (2026-05-10) — third-cycle fixes (R3, R17)

- **Balance Sheet liabilities plug (US3-R3).** The BS rebuild now has an
  `otherLiabilities` row (in the non-current-liabilities section) that
  mirrors the `otherReserves` equity plug. For each historical year it
  absorbs the **positive** residual `totalAssets − totalEquity −
  totalCurrentLiabilities − Σ(canonical non-current-liability rows)` — the
  case where the AI extraction's canonical liability rows don't sum to the
  extracted `currentLiabilities` + `nonCurrentLiabilities` totals (extra
  unmapped lines, or a current item the engine reclassified to non-current).
  A *negative* residual is left visible — it indicates a known asset-side
  data-quality issue (e.g. a mis-extracted FV investment) rather than
  something to paper over. For the forecast `otherLiabilities` is held flat
  at the last historical value (0 for clients whose last historical year
  already balances). This makes the historical BS balance for clients like
  US-3 (FY2023 residual ≈ 1.98M, FY2024 ≈ 0.16M) without disturbing the
  benchmark clients (NSC clean years balance already → plug = 0).

- **US-3 chart-of-accounts notes (US3-R17).** US-3's BS Lv1 extraction is
  faithful to the source; several canonical WC items are genuinely zero:
  - `prepayments` / `accruedExpenses` (Firestore
    `prepaymentsAndOtherReceivables` / `accruedExpensesAndOtherLiabilities`)
    are **not line items** in US-3's chart of accounts — zero in every year.
    `otherReceivables` (non-current) is likewise zero everywhere.
  - `dueFromRelatedParties` / `dueToRelatedParties` carry real balances in
    FY2023/FY2024 but **settled to 0 in FY2025**.
  The R17 acceptance test's `ACCEPTABLE_ZERO` set lists these four keys.
  If a future review against US-3's actual financial statements shows
  non-zero FY2025 values for any of them, the fix is upstream in the AI
  historical extraction (`app/agents/historical_generation`), not the WC
  alias map.

### US-3 Review (2026-05-10) — second-cycle fixes

The QA cycle on 2026-05-09 passed 12 of the 20 US-3 requirements; the
2026-05-10 SWE pass re-implemented the remaining 8 (R3, R5, R8, R11, R12,
R14, R17, R20):

- **Module-name resolution (US3-R20).** Firestore stores `equity` and `eosp`
  lowercase while `IS-CON`/`FA`/`S&M`/… and the new valuation modules
  `BV`/`Comps`/`VM` use mixed casing. The route
  handlers now run the requested module name through
  `_resolve_module_name()` (case-insensitive lookup) before hitting the
  repo — so `GET /engine/results/{client}/EOSP` resolves to the `eosp`
  doc instead of 404-ing. `eosbRate` is the first key in
  `MODULE_KEY_ORDER["eosp"]`.

- **WC days sign (US3-R5).** `defaults_generator._derive_wc_days` now emits
  POSITIVE day durations for `trade_payables_days_cogs` and
  `accrued_expenses_days_cogs`. The WC calculator decides the credit
  (negative) sign for COGS-driven items from `WC_LIABILITY_ITEMS`
  membership, not from the sign of the days assumption (and `abs()`-es the
  days first — so legacy hand-tuned negative-days assumptions still produce
  the same result).

- **S&M / G&A total terminal (US3-R8).** `_order_module_data` moves the
  `total*` row (and `_analytics`) to the end of the S&M / G&A output, so
  any non-canonical leftover line items (legacy `legalCost`, `insurance`,
  `professionalFees`, `managementRecharge`, …) land before the total.

- **FA seeding from BS PPE (US3-R11/R13/R14).** When FA Lv3's own closing
  NBV for the reporting year diverges >50% from BS Lv1 `propertyAndEquipment`,
  the orchestrator overlays the BS PPE series onto FA historical
  `closingNBV`/`PropertyAndEquipment`. The FA forecast then seeds from the
  authoritative BS value, `openingNBV[Y] = closingNBV[Y-1] = BS.PPE[Y-1]`,
  and historical `additions` is re-derived from the roll-forward identity
  `closingNBV[Y] - openingNBV[Y] + |depreciation[Y]|` (first historical
  year `additions = 0`, matching CF's `capex_h = 0`). Small discrepancies
  (e.g. the NSC 50K rounding case) leave FA Lv3 untouched.

- **IS-CON D&A zero-as-missing (US3-R12).** The Step-3 FA→IS-CON D&A
  injection now treats `-0.0`/`0` IS-CON Lv1 values as "missing" and fills
  them from `outputs["FA"].data["depreciation"]`; non-zero IS-CON Lv1
  values are still preserved. The FA-injected IS-CON historical is also
  passed to the CF calculator (`_is_con`) so CF's depreciation/capex rows
  reconcile with FA.

### US-3 Review (2026-05-09) — Output schema changes

The 2026-05-09 client review introduced fixed canonical schemas for several
modules. The calculator code still produces the legacy keys; routes-layer
filtering (`_order_module_data` in `routes.py`) drops non-canonical keys
and applies output-side renames before returning JSON. Calculator-to-
calculator data flow (`upstream` dicts) is unchanged.

**IS-CON terminal row (US3-R1).** The terminal Net Income row is now
`netIncome` (was `netIncomeLoss`). The rename is applied in
`MODULE_OUTPUT_KEY_ALIASES["IS-CON"]`. All cross-module reads continue to
use the calculator key `netIncomeLoss` in-memory.

**IS-CON D&A reconciliation (US3-R2/R12).** The orchestrator injects FA
historical depreciation into the IS-CON historical merge when IS-CON Lv1
lacks a `depreciationAmortization` value for a year **or the value is ~zero**
(`-0.0` / `0` are treated as missing). **Tie-break rule: FA wins** — FA is
the source of truth for depreciation; IS-CON D&A is derived from
`outputs["FA"].data["depreciation"]`. Non-zero IS-CON Lv1 values are
preserved (they may be a deliberate double-count fix — see §3 "D&A
Double-Count Pattern"). This guarantees
`abs(IS-CON.depreciationAmortization[Y]) == FA.depreciationCharge[Y]`
for every year (within 1 SAR). The FA-injected IS-CON historical is also
passed to the CF calculator so CF's depreciation/capex rows reconcile.

**Canonical CF schema (US3-R7).** `MODULE_KEY_ORDER["CF"]` now defines a
real-statement layout (profit before zakat → adjustments → operating
working capital changes → operating activities → investing → financing
→ net change → opening/closing cash). The CF calculator populates these
canonical rows alongside the legacy FCF rows; the routes-layer filter
drops legacy keys at read time.

| Legacy CF key | Canonical CF key |
|---|---|
| `depreciationAmortization` | `depreciation` |
| `capitalExpenditures` | `capex` |
| `openingBalance` | `openingCash` |
| `closingBalance` | `closingCash` |
| `equityDividendPaid` | `dividendsPaid` |
| `cashIncome` | `cashGeneratedFromOperatingActivities` |
| `freeCashFlows` | `netChangeInCash` |

`difference` and `cashBalancePerBS` are kept as derived reconciliation rows
(US3-R6 — see below).

**CF reconciliation difference (US3-R6).** `cf.difference[Y]` is now derived
from `closing_cash - cashBalancePerBS` (forecast: 0 by construction; historical:
the engine vs. BS gap). It is no longer a hard-coded zero.

**Canonical FA schema (US3-R15/R16).** FA output is restricted to the
canonical NSC/ECSO layout: `openingNBV`, `additions`, `depreciationCharge`,
`closingNBV`. Asset-class breakdowns (Land / Buildings / Vehicles / etc.)
are dropped from the JSON response. Categorical FA mode still computes
per-category schedules internally for the cascade, but only summary rows
ship in the response.

| Legacy FA key | Canonical FA key |
|---|---|
| `PropertyAndEquipment` | `openingNBV` |
| `depreciation` | `depreciationCharge` |

**FA opening balance correction (US3-R11).** For historical years,
`FA.openingNBV[Y]` now equals the prior year's closing NBV (= `BS.propertyAndEquipment[Y-1]`).
The original calculator merged historical PPE balances directly into
the opening row, which incorrectly placed year-end values into the
opening column.

**Canonical DEBT schema (US3-R19).** DEBT output is restricted to:
`openingBalance`, `borrowings`, `repayments`, `closingBalance`,
`currentPortion`, `nonCurrentPortion`, `_analytics`. `loanProceeds` is
renamed to `borrowings`. `financeCosts` is filtered from the JSON
response (still flows internally to IS-CON via the upstream dict).

**S&M / G&A canonical line-item order (US3-R8/R9).** The line items now
ship in this exact order: `salariesWagesAndBenefits`,
`repairsAndMaintenance`, `rent`, `travelAndCommunication`,
`sellingAndPromotion`, `stationary`, `other`, `totalSellingMarketing/AdminExpenses`.
Per-item analytics groups (`annualGrowth`, `pctOfRevenue`, `commonSize`)
are reordered to mirror the line-item sequence. The legacy
`Other / Unallocated` row (`other_gap`) is dropped from the JSON response
(`_order_module_data`); it still feeds gap-detection internally.

**WC junk filter (US3-R18).** `amountsDueToCustomers` is dropped from the
WC response when its historical values are all zero / empty. Clients who
have construction-contract advances continue to see the row.

**WC alias coverage (US3-R5/R17).** Additional Firestore alias mappings for
`tradePayables`, `accruedExpenses`, `dueToRelatedParties`, `dueFromRelatedParties`,
`inventories`, `zakatPayable`, and `prepayments` were added to `WC_HIST_KEY_MAP`
(calculator-side) and `HIST_KEY_ALIASES["WC"]` (routes-side) so US-3's
historical extraction lands in the canonical WC slot.

**EOSP eosbRate row (US3-R20).** `eosp.eosbRate` is now a visible row in
both the JSON response and the Excel export, populated with the EOSB rate
(`1/24 = 0.041666...` per CLAUDE.md convention #5) for every year so
analysts can see the assumption driving the provision movement.

### Known Firestore Data Quality Issues (pwc-test-123456)

| Year | Issue | Impact |
|---|---|---|
| All | G&A may include depreciation for some years (not 2023) | IS-CON netIncome D&A double-counted; CF Others absorbs the error |
| 2020 | `investmentsAtFairValueThroughProfitOrLoss` = 6.6M (should be 66.6M) | totalNonCurrentAssets, totalAssets off by ~60M; BS doesn't balance |
| 2020 | `fairValueLoss` sign flipped (-24.6M should be +24.6M) | EBITDA and netIncomeLoss off by ~49M |
| 2020 | `accruedExpensesAndOtherLiabilities` off by ~900K | CF WC off by ~900K |
| 2021 | `dueFromRelatedParties` value differs from Excel | totalCurrentAssets off by ~8M |
| 2021 | `propertyAndEquipment` = 624682 (should be 674682, off by 50K) | CF capex off by 50K for 2021-2022 |
| All | FA historical `additions` stores PPE balances, not actual additions | CF capex uses BS PPE changes instead |

### Engine Validation Test Suite

**File:** `tests/test_engine_validation.py` — 114 tests validating engine output against the reference Excel model (`app/core/NSC Financial Model MI.xlsx`) for client `pwc-test-123456`.

| Test Class | Count | What it validates |
|---|---|---|
| `TestHistoricalData` | 9 | Firestore data retrieval |
| `TestDefaultAssumptions` | 3 | Auto-generated assumption values |
| `TestIsConForecast` | 8 | IS-CON forecast vs Excel |
| `TestSmForecast` | 5 | S&M forecast vs Excel |
| `TestGaForecast` | 4 | G&A forecast vs Excel |
| `TestFaForecast` | 3 | FA forecast vs Excel |
| `TestDebtForecast` | 3 | DEBT forecast vs Excel |
| `TestWcForecast` | 7 | WC forecast vs Excel |
| `TestEquityForecast` | 3 | Equity forecast vs Excel |
| `TestBsForecast` | 6 | BS forecast vs Excel (incl balance check) |
| `TestCfForecast` | 4 | CF forecast vs Excel |
| `TestModuleCompleteness` | 4 | All modules produce expected keys |
| `TestIsConHistorical` | 6 | IS-CON formula consistency + spot-checks |
| `TestBsHistorical` | 33 | BS formula consistency, zero-fill, spot-checks for clean years |
| `TestCfHistorical` | 16 | CF formula consistency, reconciliation balance=0, spot-checks |

Tests use tolerance of 1.0 SAR for absolute values (rounding differences between Excel floats and Python). Clean years (2019, 2022, 2023) are spot-checked against Excel reference data. Dirty years are tested for formula consistency only.

---

## 4. The 5-Step Cascade

### Trigger
- `POST /engine/recalculate/{client_id}` (explicit)
- `PATCH /engine/assumptions/{client_id}` (implicit)
- `POST /engine/auto-setup/{client_id}` (auto — generates defaults first)
- `POST /agents/historical/generate-all?client_id=X` (auto — after historical generation)

### Steps

```
Step 1: Revenue & Gross Profit
  Input: Historical IS-CON revenue + assumptions.revenue
  Output: revenue, costOfRevenue, grossProfit

Step 2: Parallel Lv3 Modules
  S&M  ← revenue + assumptions.opex.sm_expenses
  G&A  ← assumptions.opex.ga_expenses
  FA   ← historical FA + assumptions.capex & depreciation
  WC   ← revenue + assumptions.working_capital
  Debt ← historical DEBT + assumptions.debt
    Current/Non-Current Split: If historical debt has NO long-term borrowings
    (all short-term), the entire forecast closing balance is classified as
    currentPortion (→ BS.shortTermBorrowings). Otherwise, currentPortion =
    min(annual_repayment, closing) and the remainder is nonCurrentPortion.

Step 2b: EOSP
  Input: S&M salaries + G&A salaries + assumptions.other.eosb
  Output: totalSalaries, eosi, terminationBenefits

Step 3: IS-CON Consolidation
  Input: Revenue + S&M + G&A + FA + Debt + assumptions.other
  Output: Full P&L through Net Income (15 line items)

Step 3b: Equity
  Input: Historical BS equity + IS-CON Net Income
  Output: shareCapital, statutoryReserve, retainedEarnings, totalEquity

Step 4: Cash Flow Statement
  Input: IS-CON + WC + FA + Debt + Equity + EOSP
  Output: FCF section + Cash Reconciliation section + Validation
  Historical: all components derived from BS balance changes;
    "Others" = plug ensuring FCF reconciles to actual cash movement.
  Forecast: components from upstream modules (WC, FA, DEBT, etc.).

Step 5: Balance Sheet
  Input: WC + FA + Debt + Equity + CF + EOSP + IS-CON
  Output: Full BS with validation (balanceCheck = 0)

Step 6a: BV — Business Valuation (DCF) [optional — runs if assumptions.valuation.bv]
  Input: CF (freeCashFlows) + IS-CON (EBITDA, NI, revenue) + DEBT (closingBalance) + BS (cash)
  Output: DCF schedule + Gordon-growth terminal + 3×3 sensitivity matrix
          + EV/EBITDA, P/E, EV/Sales trailing multiples (historical + forecast)

Step 6b: Comps — Comparable Companies [optional — runs if assumptions.valuation.comps]
  Input: BV (presentValueFactor) + IS-CON (EBITDA) + DEBT (closingBalance) + BS (cash)
  Output: 4 scenario blocks (Global × FY+1, FY+2; Emerging × FY+1, FY+2)
          + industry-averages table + applied multiples + source note

Step 6c: VM — Valuation Methodology [optional — runs if assumptions.valuation.vm]
  Input: BV (equityValue, sensitivity) + Comps (block.equityEstimate) + IS-CON (revenue) + BS (totalEquity)
  Output: Football-field range table (DCF / EBITDA FY+1 / EBITDA FY+2 / Revenue / Book Value)
          + weighted-average panel + final fair-value estimate (FLOOR rounded to 0.5 SAR MM)
```

---

## 5. Module Output Reference

### 5.1 IS-CON (14 data rows, 9 analytics)

**Data (in guaranteed display order):**
| Key | Display |
|---|---|
| `revenue` | Revenue |
| `costOfRevenue` | Cost of revenue |
| `grossProfit` | Gross profit |
| `sellingMarketingExpenses` | Selling and marketing expenses |
| `generalAdminExpenses` | General and administrative expenses |
| `totalExpenses` | Total expenses |
| `operatingProfit` | Operating profit |
| `equityIncome` | Share of income from equity accounted investment |
| `fairValueLoss` | Fair value loss on investments |
| `EBITDA` | EBITDA |
| `depreciationAmortization` | Depreciation and amortization |
| `financeCosts` | Finance costs |
| `zakat` | Zakat |
| `netIncome` | Net income/(loss) (US3-R1: terminal IS-CON row, renamed from `netIncomeLoss`) |

**Analytics (in guaranteed display order):** `salesGrowthYoY`, `smGrowthYoY`, `smPctOfRevenue`, `gaGrowthYoY`, `gaPctOfRevenue`, `grossProfitMargin`, `operatingProfitMargin`, `EBITDAMargin`, `netIncomeMargin`

**First forecast year analytics:** Growth KPIs (salesGrowthYoY, smGrowthYoY, gaGrowthYoY) for the first forecast year use the last historical year as the base — they are never `None`.

### 5.2 Balance Sheet (26 data rows + 3 section headers, 4 analytics)

**Data (in guaranteed display order):**

Section headers have `"is_header": true` and no year values — they are visual dividers only.

**Every data row has both historical AND forecast values.** The "Forecast Source" column shows where each item's forecast value comes from.

| Key | Display | Type | Forecast Source |
|---|---|---|---|
| `_sectionAssets` | ASSETS | header | — (no values) |
| `cashAndCashEquivalents` | Cash and cash equivalents | data | CF closing balance |
| `tradeReceivables` | Trade receivables | data | WC module (days-of-sales) |
| `dueFromRelatedParties` | Due from related parties | data | WC module (days-of-sales) |
| `inventories` | Inventories | data | WC module (days-of-COGS) |
| `prepayments` | Prepayments and other receivables | data | WC module (days-of-COGS) |
| `totalCurrentAssets` | Current Assets | subtotal | Sum of above 5 items |
| `propertyAndEquipment` | Property and equipment | data | FA module (closing NBV) |
| `investmentsAtFairValue` | Investments at fair value through P&L | data | Held flat (last historical) |
| `equityAccountedInvestment` | Equity accounted investment | data | Held flat (last historical) |
| `otherReceivablesNonCurrent` | Other receivables | data | Held flat (last historical) |
| `totalNonCurrentAssets` | Non-Current Assets | subtotal | Sum of above 4 items |
| `totalAssets` | TOTAL ASSETS | total | CA + NCA |
| `_sectionLiabilitiesEquity` | LIABILITIES AND EQUITY | header | — (no values) |
| `shortTermBorrowings` | Short-term borrowings | data | DEBT module (current portion) |
| `tradePayables` | Trade payables | data | WC module (days-of-COGS, negative) |
| `accruedExpenses` | Accrued expenses and other liabilities | data | WC module (days-of-COGS, negative) |
| `dueToRelatedParties` | Due to related parties | data | WC module (fixed amount) |
| `zakatPayable` | Zakat payable | data | WC module (fixed amount) |
| `totalCurrentLiabilities` | Current Liabilities | subtotal | Sum of above 5 items |
| `employeeTerminationBenefits` | Employee termination benefits | data | EOSP module |
| `dueToRelatedPartiesNonCurrent` | Due to related parties (non-current) | data | Held flat (last historical) |
| `otherLiabilities` | Other liabilities | data | Plug (US3-R3): historical positive residual `TA − Equity − CL − Σ(canonical NCL)`; held flat in forecast (0 when last historical year balances) |
| `totalNonCurrentLiabilities` | Non-Current Liabilities | subtotal | LT borrowings + EOSB + RP NC + otherLiabilities |
| `_sectionEquity` | SHAREHOLDERS' EQUITY | header | — (no values) |
| `shareCapital` | Share capital | data | Equity module (held flat) |
| `statutoryReserve` | Statutory reserve | data | Equity module (10% of NI, capped) |
| `otherReserves` | Other reserves | data | Held flat at last historical plug value (0 if no gap) |
| `retainedEarnings` | Retained earnings | data | Equity module (NI - dividends - reserve) |
| `totalEquity` | Shareholders' Equity | subtotal | Sum of above 4 items |
| `totalLiabilitiesAndEquity` | TOTAL LIABILITIES & EQUITY | total | CL + NCL + Equity |

**Analytics:** `currentRatio`, `leverageRatio` (Total Debt / Total Equity), `roa`, `roe`

### 5.3 Cash Flow Statement (21 data rows + 2 section headers)

**Data (in guaranteed display order):**

Section headers have `"is_header": true`. The API injects them automatically.

| Key | Display | Type |
|---|---|---|
| `netIncome` | Net income | data |
| `depreciationAmortization` | Depreciation and amortization | data |
| `endOfServiceIndemnities` | End of service indemnities | data |
| `cashIncome` | Cash income | data |
| `workingCapital` | Working capital | data |
| `capitalExpenditures` | Capital expenditures | data |
| `debtFinancing` | Debt financing | data |
| `othersFCF` | Others | data |
| `freeCashFlows` | Free Cash Flows | data |
| `cumulativeCashFlows` | CUMULATIVE CASH FLOWS | data |
| `_sectionReconciliation` | Cash reconciliation | header |
| `openingBalance` | Opening balance | data |
| `fcf` | FCF | data |
| `_sectionEquityMovements` | Equity movements (RE) | header |
| `equityCapital` | Capital | data |
| `equityStatutoryReserve` | Statutory reserve | data |
| `equityDividendPaid` | Dividend Paid (RE) | data |
| `equityPartnersAccounts` | Partners' accounts | data |
| `othersReconciliation` | Others | data |
| `closingBalance` | Closing balance | data |
| `closingBalanceCheck` | Closing balance | data |
| `cashBalancePerBS` | Cash balance per BS | data |
| `difference` | Difference | data |

**Analytics:** None

### 5.4 S&M (dynamic data rows + total, 5 analytics sections)

**Data:** Line items are **dynamically discovered** from the client's historical data — not hardcoded. The engine reads whatever line items exist in the `S&M` historical collection and forecasts each one. The last row is always `totalSellingMarketingExpenses`.

**Driver classification:** Each line item has a driver type:
- `yoy_growth`: `prev_year * (1 + rate)` — default for most items
- `pct_of_revenue`: `revenue * rate` — used when `base_kpi` from AI extraction contains "Sales%"
- `fixed`: constant value

**Shared dynamic opex methods** live in `BaseCalculator` (`base.py`): `discover_line_items()`, `classify_driver()`, `apply_driver()`, `order_items()`. Both S&M and G&A calculators use these shared methods — the calculators themselves only define their total key, module name, legacy field maps, and analytics labels.

**Analytics (ordered):**
1. `smAnnualGrowth` — Total S&M annual growth % (computed from totalSellingMarketingExpenses, not per-item)
2. `smPctOfRevenue` — Total S&M as % of revenue (computed from totalSellingMarketingExpenses)
3. `annualGrowth` — Per-item annual growth % (nested group: each line item as sub-row)
4. `pctOfRevenue` — Per-item % of revenue (nested group)
5. `commonSize` — Per-item common size % (nested group: each item / total S&M)

**Important:** Summary KPIs (#1-2) are computed from totals, not aggregated from per-item values. This ensures they match the IS-CON totals even when gap items exist.

### 5.5 G&A (dynamic data rows + total, 5 analytics sections)

**Data:** Same dynamic discovery as S&M using shared `BaseCalculator` methods. Line items come from the client's `G&A` historical collection. The last row is always `totalGeneralAdminExpenses`.

**Analytics (ordered):** Same structure and order as S&M:
1. `gaAnnualGrowth` — Total G&A annual growth % (from totalGeneralAdminExpenses)
2. `gaPctOfRevenue` — Total G&A as % of revenue (from totalGeneralAdminExpenses)
3. `annualGrowth` — Per-item annual growth %
4. `pctOfRevenue` — Per-item % of revenue
5. `commonSize` — Per-item common size %

### 5.6 FA (4 summary rows + optional per-category breakdowns, no analytics)

**Data (Blended mode):** `PropertyAndEquipment`, `additions`, `depreciation`, `closingNBV`

**Data (Categorical mode — when `assumptions.capex.categories` is set):** Summary totals plus per-category sections (e.g., `buildings_opening`, `buildings_additions`, `buildings_depreciation`, `buildings_closing` for each category). Falls back to blended mode if no categorical historical data exists.

### 5.7 WC (10 data rows, 8 analytics)

**Data:** `tradeReceivables`, `dueFromRelatedParties`, `inventories`, `prepayments`, `tradePayables`, `accruedExpenses`, `dueToRelatedParties`, `zakatPayable`, `operatingWorkingCapital`, `changeInWorkingCapital`

**WC export filtering:** The `_load_combined_module` function filters historical WC items to only include the 10 valid keys above. Firestore WC data often contains many unrelated items (property, names, totals, etc.) that must not appear in the output.

**WC historical key mapping** — Firestore uses different key names for some WC items. Multiple aliases are supported per engine key (tried in order):
| Engine Key | Firestore Aliases (tried in order) |
|---|---|
| `tradeReceivables` | `amountsDueFromCustomersForContractWork`, `amountDueFromCustomersForContractWork`, `tradeAndOtherReceivables` |
| `prepayments` | `prepaymentsAndOtherReceivables`, `prepaidExpenses` |
| `accruedExpenses` | `accruedExpensesAndOtherLiabilities` |
| `dueToRelatedParties` | `dueToRelatedPartiesLiabilities` |
| `inventories` | `inventory`, `finishedGoods` |
| `zakatPayable` | `zakatProvision` |

**Coverage-preference rule:** The alias lookup prefers the source (direct key or alias) with the most historical year data. If a direct key has 1 year and an alias has 6 years, the alias wins. This handles clients like ESCO that store receivables under contract-specific key names while still having a sparse `tradeReceivables` key from the AI extraction. The same preference applies in `_compute_historical_owc` (for the OWC seed used to compute the first-year WC change) and in `_wc_lookup` in defaults_generator.py (for computing WC days assumptions).

**WC liability sign convention:** `WC_LIABILITY_ITEMS = {tradePayables, accruedExpenses, dueToRelatedParties, zakatPayable}` are stored positive in Firestore but displayed as **negative** in the WC schedule (they reduce working capital). Sign correction:
1. **Historical:** `wc.py` negates historical year values of liability items after `merge_historical_into_data`.
2. **Forecast:** `defaults_generator.py` generates negative days for `tradePayables`/`accruedExpenses` and negative fixed amounts for `dueToRelatedParties`/`zakatPayable`. The WC calculator's `if days < 0` branch produces negative forecast values. The Fixed driver fallback (`last_hist_value`) is also negated for liability items.
3. **Analytics:** Days calculations use `abs(val)` so days-on-hand are always positive.

**Analytics (in guaranteed display order):** `tradeReceivablesDays`, `dueFromRelatedPartiesDays`, `inventoriesDays`, `prepaymentsDays`, `tradePayablesDays`, `accruedExpensesDays`, `dueToRelatedPartiesDays`, `zakatPayableDays`

### 5.8 Debt (7 data rows, 1 analytics)

**Data:** `openingBalance`, `loanProceeds`, `repayments`, `closingBalance`, `financeCosts`, `currentPortion`, `nonCurrentPortion`

**Historical data injection (orchestrator):** DEBT Lv3 Firestore stores borrowing balances under `total` or `shortTermBorrowings`, not `closingBalance`. The orchestrator injects into `debt_hist` before calling DEBT:
- **`financeCosts`:** From IS-CON historical (positive in Firestore) so the financing rate is computed from actual data.
- **`closingBalance`:** If DEBT Lv3 has no balance year data, BS `shortTermBorrowings` is injected as `closingBalance`.
- `debt.py` explicitly copies `hist_closing` year values into `data["closingBalance"]` (cannot be done via `merge_historical_into_data` since key names differ).

**Historical derivation:** After populating historical `closingBalance`: `openingBalance[year] = closingBalance[prev_year]`, `loanProceeds` defaults to 0, `repayments = openingBalance - closingBalance`.

**Sign note:** Forecast `financeCosts` are **negative** (expense convention, for IS-CON). Excel DEBT sheets show them positive. Benchmark against IS-CON `financeCosts`, not DEBT.

**Analytics:** `financingRate`

### 5.9 EOSP (3 data rows, no analytics)

**Data:** `totalSalaries`, `eosi`, `terminationBenefits`

**Historical data:** The calculator computes historical values (not just forecast) by combining S&M and G&A upstream salary data:
- `totalSalaries[hist_year]` = abs(S&M salaries) + abs(G&A salaries) for each historical year
- `eosi[hist_year]` = totalSalaries * eosb_pct (or derived from balance changes if EOSB balance data is available: `eosi = eosb[year] - eosb[prev_year]`)
- `terminationBenefits` includes both historical balances from BS and forecast running balance (opening + EOSI)

**Salary key resolution:** The calculator uses `_find_salary_data(module_data)` to locate the salary row in S&M/G&A output. It tries multiple key name variants in order: `salariesWagesAndBenefits`, `salariesAndWagesAndBenefits`, `salaries`, `staffCosts`, `wagesAndSalaries`. If none match, it falls back to any key containing `"salari"`. This handles clients that store the salary line under variant key names (e.g. US-1 uses `"salariesAndWagesAndBenefits"` with an extra "And").

**Depends on:** S&M salary row (any key variant above), G&A salary row, BS employeeTerminationBenefits (historical balance)

### 5.10 Equity (4-5 summary + 13-16 movement detail rows, 1 analytics)

**Data (Summary):** `shareCapital`, `statutoryReserve`, `retainedEarnings`, [`partnersCurrentAccounts`], `totalEquity`

**Dynamic Partners:** The `partnersCurrentAccounts` row only appears if the client's historical data contains partner account balances. This is determined by checking `historical.get("partnersCurrentAccounts")` — if no values exist, the entire Partners section (summary + movement detail) is omitted. Total equity includes partners when present.

**Data (Movement Detail):** Section headers + per-component reconciliation:
- Share Capital: `sc_opening`, `sc_additions`, `sc_closing`
- Statutory Reserve: `sr_opening`, `sr_transfer`, `sr_closing`
- Retained Earnings: `re_opening`, `re_netIncome`, `re_statReserveTransfer`, `re_dividends`, `re_closing`
- Partners' Current Accounts (conditional): `pa_opening`, `pa_movements`, `pa_closing`

**Historical movement data:** After merging historical balances, the calculator derives historical movement details from year-over-year balance changes:
- `sc_additions[year]` = shareCapital[year] - shareCapital[prev_year]
- `sr_transfer[year]` = statutoryReserve[year] - statutoryReserve[prev_year]
- `re_dividends[year]` derived as plug: opening + NI - SR transfer - closing (only when NI available from IS-CON)
- `pa_movements[year]` = partners[year] - partners[prev_year]

**Analytics:** `dividendPayoutRatio`

**Equity component initialization (None-aware):** The forecast starting balances for Share Capital, Statutory Reserve, and Retained Earnings use `_last_hist_value(data)` instead of `extract_year_values`. This is critical for clients where the most recent historical year has `None` values (e.g. SR withdrawn: `{"2022": 3M, "2023": 3M, "2024": None, "2025": None}`). `extract_year_values` skips None and would incorrectly seed the forecast at 3M. `_last_hist_value` reads the chronologically latest year key and returns 0 when that value is None.

### 5.11 BV — Business Valuation (DCF) (optional)

Only generated when `assumptions.valuation.bv` is set. File: `app/engine/calculators/bv.py`.

**Data (display order):**
- **DCF block** — `freeCashFlow` (per forecast year), `presentValueFactor` (1.0 at valuation year, `1/(1+dr)^(year-val_date)` elsewhere), `presentValueFcf` (0 at valuation year, `fcf * pv` elsewhere)
- **Assumptions** — `discountRate`, `growthRate` (single value placed in valuation-year column)
- **Terminal Value** — `fcfNextPeriod` = `last_fcf * (1+g)`, `terminalValue` = `fcfNextPeriod / (dr − g)`, `terminalPvFactor` = PV factor of the last forecast year, `presentValueTerminal` = `terminalValue * terminalPvFactor`
- **Summary** — `sumPvFcf` (sum across forecast years, rounded to 100K), `pvTerminalRounded`, `equityValue` = `sumPvFcf + pvTerminalRounded`. All three placed in last-forecast-year column
- **Sensitivity** — `sensitivity` row holds a nested dict: `{"matrix": {str(dr): {str(g): equity_value, ...}, ...}, "discount_rates": [dr−Δ, dr, dr+Δ], "growth_rates": [g−Δ, g, g+Δ]}`. Center cell == `equityValue`. Each cell uses the same `ROUND(...,-5)` rounding as the summary
- **Trailing multiples** — `evEbitda` = `equity / EBITDA`, `peRatio` = `equity / NI`, `evSales` = `equity / revenue`, populated for **all** years (historical + forecast) so analysts can compare implied multiples through time

### 5.12 Comps — Comparable Companies (optional, depends on BV)

Only generated when `assumptions.valuation.comps` is set. File: `app/engine/calculators/comps.py`.

**Data (4 scenarios + industry table):**
- **Scenario blocks** — `globalFy1`, `globalFy2`, `emergingFy1`, `emergingFy2`. Each is a nested dict with `ebitda`, `multiple`, `evEstimateGross`, `pvFactor` (reused from BV.presentValueFactor), `evEstimate`, `netDebt` (= `−(DEBT.closingBalance − BS.cash)` at valuation date), `equityEstimate`. Each row carries `{label, year, value}` so the export can render the year band
- **Industry-averages table** — one `industry_<slug>` row per `comps.industries` entry with `global` and `emerging` columns
- **Averages & applied multiples** — `globalAverage`, `emergingAverage`, `liquidityDiscountGlobal/Emerging`, `appliedMultipleGlobal/Emerging` (`= avg * (1 − discount)`, rounded to 1 dp). The applied multiple is the value used by the scenario blocks
- **Source note** — `sourceNote` row (string-only, e.g. "Source: Damodaran (Jan 2024 data)")

### 5.13 VM — Valuation Methodology (optional, depends on BV + Comps)

Only generated when `assumptions.valuation.vm` is set. File: `app/engine/calculators/vm.py`. **Values are in SAR Millions** (divided by 1,000,000) to mirror the Excel.

**Data:**
- **Football field ranges** — `dcfRange` (lower = BV sensitivity at `dr+Δ, g+Δ`; upper = at `dr−Δ, g−Δ`), `ebitdaMultipleFy1Range` (lower = Comps.globalFy1.equityEstimate, upper = Comps.emergingFy1.equityEstimate), `ebitdaMultipleFy2Range` (FY+2 variant), `revenueMultipleRange` (= `revenue[last_hist] * [low, high]` from `vm.revenue_multiple_low/high`), `bookValueRange` (lower = upper = `BS.totalEquity[val_date]`). Each row carries `{lower, upper, lowerLabel, upperLabel, comment}`
- **Weighted summary** — `weightedDcf` (value = BV central, weight = `vm.weights.dcf`), `weightedEbitdaFy1/Fy2` (value = midpoint of corresponding range), `weightedBookValue` (value = book-value lower). Each carries `{value, weight, contribution}`
- **Final fair value** — `fairValueEstimate` row: `{value: FLOOR(Σ contributions, 0.5), weight_total: 1.0}`. Excel uses `FLOOR(x, 0.5)`; engine uses `math.floor(x / 0.5) * 0.5`. The model_validator on `VmAssumptions` enforces `weights` sum to 1.0 ± 1e-6

---

## 6. Default Assumptions Generator

**File:** `app/engine/defaults_generator.py`

Auto-generates assumptions from historical data for new clients.

| Assumption | Source |
|---|---|
| Revenue YoY growth | Avg last 3 years' YoY from IS-CON revenue |
| GP margin | Avg last 3 years' GP/Revenue ratio |
| S&M items (dynamic) | Auto-discovers all line items; classifies driver from `base_kpi` field; computes avg rate |
| G&A items (dynamic) | Same as S&M — auto-discovers, classifies, computes |
| WC days | Avg (balance/base) * 365 per item |
| Capex % | Avg additions/opening from FA |
| Depreciation rate | Avg depreciation/opening from FA |
| Financing rate | Avg finance costs/opening from DEBT |
| Zakat rate | Avg zakat/EBT from IS-CON |

**Dynamic line-item assumptions:** S&M and G&A use `LineItemAssumption` objects with a `driver` ("yoy_growth", "pct_of_revenue", "fixed"), a `rate`, and an optional `base_value`. The generator reads the `base_kpi` field set during AI extraction to classify each item's driver automatically. Legacy hardcoded assumption fields are still supported for backward compatibility.

**Growth rate capping:** Each per-year YoY growth rate is capped at ±100% before averaging to prevent a single outlier year from dominating. The final averaged rate is further capped at ±50% to prevent compounding from producing implausible forecasts. This applies to both G&A/S&M line items and the top-level revenue growth rate. Revenue YoY growth rates are capped at ±50% before the 3-year average is computed.

**Gap detection:** The defaults generator compares the sum of extracted line items against the IS-CON total for S&M and G&A. If the sum falls short by >5%, a synthetic gap item (`otherSMExpenses` or `otherGAExpenses`) is created with `base_value` set to the last known gap amount and `rate` set to 5% (flat growth). This ensures the forecast captures costs that exist in the P&L but were not extracted as named line items.

**Accrued expenses fallback:** When the WC historical data has no `accruedExpenses` balance (days = 0), the defaults generator derives the implied balance from the `currentLiabilities` residual: `CL - shortTermBorrowings - tradePayables - dueToRelatedParties - zakatPayable`. If the residual is positive and COGS is non-zero, the implied days-of-COGS is computed and stored as a negative accrued expenses assumption. This prevents the WC balance from being understated for clients whose accrued expenses key was extracted under a non-standard name.

**WC fixed-amount items:** `dueToRelatedParties` and `zakatPayable` use the most recent year's historical value as the fixed forecast amount. The most recent year is determined by `max(keys())` — NOT by `values()[-1]` — because Firestore does not guarantee insertion order. Using insertion-order last-element was a bug that produced the wrong year's value (e.g., 2018 instead of 2023).

**base_value field:** `LineItemAssumption.base_value` provides a seed value for items with no historical data. When a line item exists in assumptions but has no historical year values, the calculator uses `base_value` as the starting point for `yoy_growth` driver. This is primarily used by synthetic gap items.

---

## 7. API Endpoints Reference

### Financial Engine
| Method | Path | Purpose |
|---|---|---|
| POST | `/engine/assumptions/{client_id}` | Save full assumptions |
| GET | `/engine/assumptions/{client_id}` | Get stored assumptions |
| PATCH | `/engine/assumptions/{client_id}` | Partial update + auto-recalculate |
| PATCH | `/engine/assumptions/{client_id}/classify-item` | Override S&M/G&A line item driver + recalculate |
| POST | `/engine/recalculate/{client_id}` | Full model recalculation |
| GET | `/engine/results/{client_id}/{module}` | Get single module results |
| GET | `/engine/results/{client_id}` | Get all module results |
| POST | `/engine/generate-defaults/{client_id}` | Auto-generate assumptions |
| **POST** | **`/engine/auto-setup/{client_id}`** | **Generate defaults + recalculate (one-click)** |
| **GET** | **`/engine/validate/{client_id}`** | **Structured health check: BS balance, CF reconciles, IS-CON formulas, data_quality_score (0–100)** |
| GET | `/engine/historical/{client_id}/{module}` | Get historical data for one module (JSON) |
| GET | `/engine/historical/{client_id}` | Get all historical data (JSON) — **UI should call this, not the legacy endpoint** |
| **GET** | **`/engine/export/{client_id}/{module}`** | **Export single module (hist + forecast) as Excel** |
| **GET** | **`/engine/export/{client_id}`** | **Export all modules as multi-sheet Excel** |
| **GET** | **`/engine/export/{client_id}/historical-only`** | **Export raw historical data only (no forecast) as multi-sheet Excel** |

### Full Pipeline (PDF → Engine, SSE streaming)
| Method | Path | Purpose |
|---|---|---|
| **POST** | **`/process-pipeline`** | **Complete pipeline: PDF extraction → Lv1 → Lv3 → validation → engine. Streams SSE progress events.** |

**Request:** `multipart/form-data`
- `client_id` (str) — client identifier
- `years` (str) — JSON array of ints matching file order, e.g. `[2024, 2023]`
- `force` (bool, default `false`) — re-run PDF extraction even if statements exist
- `dpi` (int, default `150`) — PDF render resolution
- `files` (File[]) — one or more PDF financial statements

**Response:** `text/event-stream` — SSE events (`data: {JSON}\n\n`).

Each event shape:
```json
{
  "type": "stage_start|progress|stage_complete|error|complete",
  "stage": "pdf_extraction|lv1_generation|lv3_generation|validation|engine",
  "stageName": "PDF Extraction",
  "step": "Extracting Annual Report 2024.pdf — page 3 of 42",
  "progress": 15,
  "stageProgress": 42,
  "status": "running|completed|warning|error|skipped",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "detail": {}
}
```

Progress weights: Stage 0 (0–35%), Stage 1 (35–55%), Stage 2 (55–80%), Stage 3 (80–85%), Stage 4 (85–100%).
Stage 0 emits `status: "skipped"` and jumps to 35% if statements already exist and `force=false`.
Errors in stages 0–3 emit `status: "warning"` and the pipeline continues. Stage 4 failure emits `status: "error"` in the terminal `"type": "complete"` event.

**React.js consumption:**
```js
const fd = new FormData();
fd.append('client_id', clientId);
fd.append('years', JSON.stringify([2024, 2023]));
fd.append('force', 'false');
files.forEach(f => fd.append('files', f));

const res = await fetch('/process-pipeline', { method: 'POST', body: fd });
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  const lines = buf.split('\n');
  buf = lines.pop();           // hold last incomplete line
  for (const line of lines) {
    if (line.startsWith('data: ')) onEvent(JSON.parse(line.slice(6)));
  }
}
```

**Source:** `app/api/pipeline.py` — registered via `register_pipeline_routes(app, db)` called from `AgentixAIPdf.__init__`.

### Historical Agent
| Method | Path | Purpose |
|---|---|---|
| POST | `/agents/historical/generate?force=false` | Generate Lv3 for one document code (add `?force=true` to bypass cache) |
| **POST** | **`/agents/historical/generate-all?client_id=X`** | **Generate all historical (Lv1: IS-CON, BS, CF + Lv3) + validation + auto-setup model** |
| **POST** | **`/agents/historical/generate-all?client_id=X&force=true`** | **Force fresh AI extraction even if cached data exists** |
| GET | `/agents/historical/codes` | List valid document codes |
| POST | `/agents/historical/codes` | Add new document code mapping |

**AI model used for extraction:** Controlled globally via `GET/POST /settings/ai`. Default: `gemini-3.1-pro-preview`, `thinking_budget=-1`.
- All Lv1 and Lv3 callers read from `app/api/helper/ai_settings.py` at call time.
- Per-request override: `PdfExtractor.model` / `PdfExtractorFixer.model` fields in PDF endpoints override global (pass `null` to use global).
- `_normalize_gemini_response()` in `AIHelper.py` converts list-wrapped Gemini responses to dict before returning.

> **⚠️ Legacy endpoint removed:** `GET /historical/fetch/firestore/{client_id}` is deprecated and reads from the old HTML-based collection. Use `GET /engine/historical/{client_id}` instead. The legacy endpoint will be deleted once the UI migration is confirmed.

### generate-all Response Shape
```json
{
  "status": "success",
  "client_id": "US-1",
  "lv1_results": { "IS-CON": "success", "BS": "success", "CF": "success" },
  "historical_results": { "S&M": "success", "G&A": "success", "FA": "success", "WC": "success", "DEBT": "success" },
  "validation_warnings": [
    {
      "check": "BS does not balance (assets ≠ CL + NCL + equity)",
      "severity": "critical",
      "year": "2022",
      "expected": 12000000,
      "actual": 11800000,
      "pct_diff": 1.7
    },
    {
      "check": "BS equity components sum ≠ shareholdersEquity total",
      "severity": "warning",
      "year": "2022",
      "expected": 5000000,
      "actual": 4800000,
      "gap": 200000,
      "action": "Check for unextracted equity reserves (general reserve, revaluation, etc.)"
    }
  ],
  "data_quality_score": 74,
  "model_status": "success",
  "modules_computed": ["IS-CON", "BS", "CF", "S&M", "G&A", "FA", "WC", "DEBT", "equity", "eosp", "BV", "Comps", "VM"]
}
```

`validation_warnings` is always present (empty list `[]` if all checks pass). Warnings are advisory — data is saved regardless. Each warning has a `severity` field (`"critical"` or `"warning"`). `data_quality_score` is 0–100: starts at 100, deducts 20 per critical warning and 3 per any warning. Warnings are also saved to `calculations/{client_id}/historical_lv1/_validation` for the `/engine/validate/` endpoint to read.

**`GET /engine/validate/{client_id}` response:**
```json
{
  "client_id": "US-1",
  "overall": "healthy",
  "data_quality_score": 100,
  "checks": [
    { "check": "historical_data_quality", "passed": true, "critical_warnings": 0, "total_warnings": 0 },
    { "check": "bs_balance", "passed": true, "issues": [] },
    { "check": "cf_reconciles", "passed": true, "issues": [] },
    { "check": "is_con_formulas", "passed": true, "issues": [] }
  ]
}
```
`overall` is `"healthy"` only when all 4 checks pass. `data_quality_score` deducts 20 per BS balance issue, 10 per CF reconciliation issue, and 5 per IS-CON formula issue.

### PDF Extraction
| Method | Path | Purpose |
|---|---|---|
| POST | `/split-pdf-to-images` | PDF pages to base64 images |
| POST | `/extract-tables` | Extract financial tables (streaming) |
| POST | `/fix-table` | Fix incorrectly extracted table |

### Settings
| Method | Path | Purpose |
|---|---|---|
| **GET** | **`/settings/ai`** | **Get current global AI model and thinking budget** |
| **POST** | **`/settings/ai`** | **Update model and/or thinking_budget (persists to Firestore)** |

**POST /settings/ai body:**
```json
{ "model": "gemini-3.1-pro-preview", "thinking_budget": -1 }
```
Both fields are optional — omit either to keep existing value. `-1` = unlimited thinking, `0` = disabled.

### Users
| Method | Path | Purpose |
|---|---|---|
| POST | `/users/create` | Register user |
| GET | `/users/login/{email}/{password}` | Login |

---

## 8. Excel Export System

**Files:** `app/engine/engine_export_manager.py` (rendering), `app/engine/routes.py` (`_load_combined_module` + `HIST_KEY_ALIASES`)

Exports combined historical + forecasted data to Excel format with professional formatting.

### How Export Data Merging Works

The export endpoint loads **both** forecast data (from `forecasting_lv1/lv3`) and historical data (from `historical_lv1/lv3`), then merges them. This is necessary because:
- Forecast data already contains historical years (merged by the engine calculators)
- Historical data may contain additional items not in the forecast (e.g., discontinued line items)

**Key alias mapping (`HIST_KEY_ALIASES` in routes.py):** Firestore historical data uses different key names for some items (e.g., `prepaymentsAndOtherReceivables` vs engine's `prepayments`). Without mapping, the export would show duplicate rows. The alias map merges these into the correct engine key.

| Module | Firestore Historical Key | Engine Key |
|---|---|---|
| BS | `prepaymentsAndOtherReceivables` | `prepayments` |
| BS | `accruedExpensesAndOtherLiabilities` | `accruedExpenses` |
| BS | `investmentsAtFairValueThroughProfitOrLoss` | `investmentsAtFairValue` |
| BS | `dueToRelatedPartiesLiabilities` | `dueToRelatedParties` |
| BS | `dueToRelatedPartiesCurrent` | `dueToRelatedPartiesNonCurrent` |
| BS | `otherReceivables` | `otherReceivablesNonCurrent` |
| BS | `currentAssets`, `nonCurrentAssets`, etc. | `totalCurrentAssets`, etc. |
| BS | `otherEquityReserves` | `otherReserves` |
| BS | `generalReserve` | `otherReserves` |
| BS | `revaluationReserve` | `otherReserves` |
| WC | `prepaymentsAndOtherReceivables` | `prepayments` |
| WC | `prepaidExpenses` | `prepayments` |
| WC | `accruedExpensesAndOtherLiabilities` | `accruedExpenses` |
| WC | `dueToRelatedPartiesLiabilities` | `dueToRelatedParties` |
| WC | `finishedGoods` | `inventories` |
| WC | `inventory` | `inventories` |
| WC | `zakatProvision` | `zakatPayable` |
| S&M | `total` | `totalSellingMarketingExpenses` |
| G&A | `total` | `totalGeneralAdminExpenses` |
| DEBT | `total` | `closingBalance` |
| DEBT | `shortTermBorrowings` | `currentPortion` |
| CF | `openingCash` | `openingBalance` |
| CF | `closingCash` | `closingBalance` |
| CF | `profitForThePeriod` | `netIncome` |
| CF | `depreciationAndAmortization` | `depreciationAmortization` |

> **CF historical-only export:** The `GET /engine/export/{client_id}/historical-only` endpoint uses raw AI-extracted CF data (direct-method statement format). The HIST_KEY_ALIASES above map AI-extracted keys to engine display keys. Structural subtotal keys from the statement (`operatingActivities`, `investingActivities`, `financingActivities`, `netCashChange`) are passed through as-is since they don't conflict with engine keys.

**Historical-only items** (e.g., G&A `rent`, `itCosts`, `depreciation` which existed in 2017-2022 but were dropped in 2023) are included in the export with historical values only — no forecast is generated for discontinued items. This is correct behavior.

### Features
- **Single module export:** `GET /engine/export/{client_id}/{module}` — one sheet per module **plus an `Assumptions` sheet** (when assumptions are stored for the client)
- **All modules export:** `GET /engine/export/{client_id}` — one sheet per module in a single workbook, with the `Assumptions` sheet inserted as the **first tab** (when stored assumptions exist)
- **Assumptions sheet:** `Parameter | Value | <forecast_year_1> | <forecast_year_2> | …` layout. Sections rendered in order: General → FX Rates → Revenue → Margins → Operating Expenses → Working Capital → Capital Expenditures → Depreciation Rates → Other → Debt → Valuation. Per-year dicts (e.g., `revenue.growth_yoy_pct`, `margins.gp_margin_sales_pct`) spread across year columns with `0.00%` formatting; scalars in the Value column. `LineItemAssumption` rows (under `opex.sm_expenses.items`, `opex.ga_expenses.items`) render as `<item label> | <driver> | <rate values across year cols>`. The historical-only export (`GET /engine/export/{client_id}/historical-only`) deliberately omits the Assumptions sheet — there is no forecast context for it
- **Canonical display order preserved** for IS-CON, BS, CF (uses `MODULE_KEY_ORDER` from routes.py)
- **Visual distinction:** Historical year columns have green headers, forecast years have orange headers
- **Section headers** (BS, CF) rendered as bold divider rows
- **Total/subtotal rows** rendered bold (grossProfit, totalAssets, freeCashFlows, etc.)
- **Analytics** rendered in a "Key Indicators" section below the data table. Supports both flat analytics (single row) and nested per-item analytics groups (e.g., `pctOfRevenue` containing sub-rows per line item)
- **Percentage formatting:** Analytics keys like margins, growth rates, ROA/ROE are formatted as `0.00%`. Ratios (Current Ratio, Leverage, Beta) use `0.00` format
- **Data row formatting:** Valuation rate/percentage data rows (Rf, WACC, Ke, Kd) use `0.00%` format. Ratio data rows (Beta, Discount Factor) use `0.00`. All monetary data rows use `#,##0`
- **Historical-only export:** `GET /engine/export/{client_id}/historical-only` produces a multi-sheet Excel with raw AI-extracted historical data only (no forecast columns). Uses the AI-extracted CF statement format rather than the engine-computed FCF format
- **`forecast_start` auto-detection:** Export endpoints now read the stored assumptions to determine the first forecast year (from `revenue.growth_yoy_pct` keys), ensuring correct green (historical) vs orange (forecast) column coloring
- **Frozen panes:** row 2, column A frozen for easy scrolling
- **Returns** `StreamingResponse` with `.xlsx` content type for direct browser download

### Sheet Names
| Module | Sheet Name |
|---|---|
| IS-CON | Income Statement |
| BS | Balance Sheet |
| CF | Cash Flow Statement |
| S&M | Selling & Marketing Expenses |
| G&A | General & Admin Expenses |
| FA | Fixed Assets |
| WC | Working Capital |
| DEBT | Debt Schedule |
| equity | Equity |
| eosp | End of Service Provision |
| BV | Business Valuation |
| Comps | Comparable Companies |
| VM | Valuation Methodology |

---

## 9. End-to-End API Workflow (PDF → Financial Model)

This is the exact sequence of API calls the UI (or any agent) must follow to go from a raw PDF to a fully computed financial model. Each step builds on the previous one.

### Step 1: Create Client

```
POST /users/create
Body: { "name": "Company XYZ", ... }
Response: { "client_id": "xyz-123456" }
```

Save the returned `client_id` — it's used in every subsequent call.

### Step 2: Upload PDF & Extract Tables

```
# 2a. Convert PDF to images (one image per page)
POST /split-pdf-to-images
Body: multipart file upload, dpi=300
Response: { "images": ["base64...", "base64...", ...] }

# 2b. Extract financial tables from images using AI (Gemini vision)
POST /extract-tables
Body: { "client_id": "xyz-123456", "images": [...], "prompt": "..." }
Response: Streams extracted tables as JSON

# 2c. Save extracted tables to Firestore
POST /save-table/
Body: { "client_id": "xyz-123456", "statement_year": 2023, "tables": [...], "usage": {...} }
Response: {
  "status": "success",
  "saved": 5,
  "tables_with_errors": 1,
  "unknown_buckets": [],
  "warning": "1 table(s) had unreadable numbers — consider re-extracting"
}
```

`tables_with_errors` counts tables where `has_error: true` (AI flagged unreadable numbers). Non-null `warning` means at least one table should be re-extracted before running generate-all.

**After this step:** Raw CSV tables are stored in `statements/{client_id}/client_statements/` in Firestore, organized by financial bucket (Income Statement, Balance Sheet, Notes, etc.).

### Step 3 & 4: Generate All Historical + Auto-Run Model (One Call)

```
# RECOMMENDED: Single call that does everything
POST /agents/historical/generate-all?client_id=xyz-123456
```

This single call performs 5 sub-steps:
1. **Generates Lv1 historical (IS-CON, BS & CF)** — uses Gemini `gemini-3.1-pro-preview` with unlimited thinking to parse raw extracted tables from `statements/` into structured data. Each statement type uses a dedicated structured extraction prompt: `extraction_historical_is_con` (IS-CON with sign convention and self-check), `extraction_historical_bs` (BS with equity self-balancing `otherEquityReserves` plug requirement), `extraction_historical_cf` (CF direct-method). Saves to `calculations/{client_id}/historical_lv1/{IS-CON,BS,CF}`
2. **Generates Lv3 historical** for all 5 document codes (S&M, G&A, FA, WC, DEBT) — the agent reads raw tables from `statements/`, parses them into structured line items, and saves to `calculations/{client_id}/historical_lv3/{code}`. Lv3 results are cached — use `?force=true` to bypass the cache and force fresh AI extraction
3. **Runs post-extraction validation** — cross-checks IS-CON derived rows, BS balance equation (`totalAssets = currentLiabilities + nonCurrentLiabilities + shareholdersEquity` using actual Firestore keys), BS equity component sum vs total (detects unextracted equity reserves), and Lv3↔Lv1 reconciliation (S&M/G&A sum vs IS-CON totals). Each warning includes a `severity` field (`"critical"` for >5% balance discrepancy, `"warning"` for Lv3 reconciliation gaps). Data is saved regardless. Warnings also saved to `calculations/{client_id}/historical_lv1/_validation`. Response includes `data_quality_score` (0–100).
4. **Auto-generates default assumptions** from the historical data (revenue growth, margins, WC days, capex %, etc.)
5. **Runs the full 5-step financial model cascade** (Revenue → Lv3 → IS-CON → Equity → CF → BS)

Response:
```json
{
  "status": "success",
  "client_id": "xyz-123456",
  "lv1_results": { "IS-CON": "success", "BS": "success", "CF": "success" },
  "historical_results": { "S&M": "success", "G&A": "success", ... },
  "validation_warnings": [],
  "model_status": "success",
  "modules_computed": ["revenue", "S&M", "G&A", "FA", "WC", "DEBT", "eosp", "is_con", "equity", "CF", "BS"]
}
```

**After this step:** All historical + forecast data is computed and stored. The model is ready for viewing.

### Step 5: View Results

```
# All modules at once (historical + forecast merged)
GET /engine/results/{client_id}

# Single module
GET /engine/results/{client_id}/IS-CON
GET /engine/results/{client_id}/BS
GET /engine/results/{client_id}/CF
GET /engine/results/{client_id}/S&M
GET /engine/results/{client_id}/G&A
GET /engine/results/{client_id}/FA
GET /engine/results/{client_id}/WC
GET /engine/results/{client_id}/DEBT
GET /engine/results/{client_id}/equity
GET /engine/results/{client_id}/eosp
GET /engine/results/{client_id}/BV       ← Business Valuation (DCF + sensitivity + multiples)
GET /engine/results/{client_id}/Comps    ← Comparable Companies (4 scenarios + industry table)
GET /engine/results/{client_id}/VM       ← Valuation Methodology (football field + weighted summary)

# Historical only
GET /engine/historical/{client_id}
GET /engine/historical/{client_id}/{module}

# Download as Excel (historical + forecast)
GET /engine/export/{client_id}
GET /engine/export/{client_id}/{module}

# Download historical-only Excel (AI-extracted data, no forecast)
GET /engine/export/{client_id}/historical-only
```

### Step 6: Adjust Assumptions & Re-Run

```
# View current assumptions
GET /engine/assumptions/{client_id}

# Partially update assumptions (auto-triggers recalculation)
PATCH /engine/assumptions/{client_id}
Body: { "revenue": { "growth_yoy_pct": { "2024": 0.10, "2025": 0.08 } } }
Response: { "status": "success", "modules_computed": [...] }

# OR: Full replace + manual recalculate
POST /engine/assumptions/{client_id}
Body: { full Assumptions JSON }
POST /engine/recalculate/{client_id}
```

### Alternative: Step-by-Step (instead of generate-all)

If you need more control, you can run each step individually:

```
# Generate Lv3 historical for one module at a time
POST /agents/historical/generate
Body: { "client_id": "xyz-123456", "document_code": "S&M" }
# Repeat for: "G&A", "FA", "WC", "Debt"

# Auto-generate assumptions + run model (requires Lv1 historical to exist)
POST /engine/auto-setup/{client_id}

# OR: Generate assumptions only (without running model)
POST /engine/generate-defaults/{client_id}?save=true

# Then run model manually
POST /engine/recalculate/{client_id}
```

> **Note:** When running step-by-step, `auto-setup` and `recalculate` require Lv1 historical data (IS-CON, BS) to already exist. The `generate-all` endpoint handles this automatically. The legacy `/calculation/*` endpoints for manual Lv1 generation are deprecated — use `POST /agents/historical/generate-all?client_id=X` instead.

### Quick Reference: API Call Sequence

```
PDF Upload Flow:
  POST /split-pdf-to-images          ← PDF → images
  POST /extract-tables               ← images → tables (AI)
  POST /save-table/                  ← tables → Firestore

Model Generation Flow (one call does everything):
  POST /agents/historical/generate-all?client_id=X   ← Lv1 + Lv3 historical + assumptions + model

View & Iterate Flow:
  GET  /engine/results/{client_id}                    ← View all results
  PATCH /engine/assumptions/{client_id}               ← Adjust + auto-recalculate
  GET  /engine/export/{client_id}                     ← Download Excel
```

---

## 10. File Structure

```
AdvisorsME-API/
├── main.py
├── app/
│   ├── engine/
│   │   ├── models.py                    # Pydantic: Assumptions, ModuleOutput, LineItemAssumption
│   │   ├── firestore_repo.py            # Firestore CRUD (read+write for both Lv1 and Lv3)
│   │   ├── orchestrator.py              # 5-step cascade controller
│   │   ├── routes.py                    # API endpoints (incl. auto-setup)
│   │   ├── defaults_generator.py        # Auto-generate assumptions
│   │   ├── engine_export_manager.py     # Excel export (hist + forecast)
│   │   └── calculators/
│   │       ├── base.py                  # Shared utilities + dynamic opex methods
│   │       ├── revenue.py, sm.py, ga.py, fa.py, wc.py, debt.py
│   │       ├── eosp.py, is_con.py, equity.py
│   │       ├── cf.py                    # Cash Flow (FCF + Reconciliation)
│   │       ├── bs.py                    # Balance Sheet (27 line items)
│   │       ├── bv.py                    # Business Valuation (DCF + sensitivity + multiples — optional)
│   │       ├── comps.py                  # Comparable Companies (4-block scenario grid — optional)
│   │       └── vm.py                     # Valuation Methodology (football field + weighted summary — optional)
│   ├── api/
│   │   ├── AgentixPdf.py                # ACTIVE: PDF extraction, statement CRUD
│   │   ├── Users.py                     # ACTIVE: User auth & management
│   │   ├── AgenticAdvisor.py            # ACTIVE: Financial bucket queries
│   │   ├── legacy_api.py               # DEPRECATED: old /calculation/* endpoints
│   │   ├── models/Models.py            # Pydantic models
│   │   └── helper/
│   │       ├── firebase_service.py      # ACTIVE: Firebase singleton
│   │       ├── ExportManager.py         # PARTIAL: generate_excel_by_year active
│   │       ├── AIHelper.py              # ACTIVE: Gemini API helpers
│   │       └── APIAiHelper.py           # DEPRECATED: old calculation logic
│   ├── agents/historical_generation/    # ACTIVE: AI agent + generate-all (Lv1 + Lv3 + model)
│   ├── engine2/                         # ACTIVE: PDF → formula-linked Excel via Gemini 3.1 Pro (see §13)
│   │   ├── __init__.py                  # generate_excel_model() library entry
│   │   ├── gemini_client.py             # Gemini 3.1 Pro v1alpha client (thinking_level=high)
│   │   ├── prompts.py                   # System prompt sent to Gemini
│   │   ├── schemas.py                   # Pydantic models for Gemini's JSON output
│   │   ├── excel_builder.py             # Writes the 13-sheet .xlsx with real formulas
│   │   └── router.py                    # FastAPI router mounted at /engine2
│   ├── Utils/
│   │   ├── FirestoreUtlis.py            # PARTIAL: statement queries active, calc deprecated
│   │   ├── CalculationHelper.py         # DEPRECATED: old calc functions
│   │   └── test_data.py                 # DEPRECATED: test fixtures
│   └── ...
```

### Legacy Endpoint Migration Map

All `/calculation/*` endpoints in `legacy_api.py` are deprecated. Use these engine equivalents:

| Legacy Endpoint | Engine Replacement |
|---|---|
| `/calculation/PL/create/ai/{id}` | `POST /agents/historical/generate-all?client_id=X` (Lv1 IS-CON now included) |
| `/calculation/PL/fetch/{id}` | `GET /engine/results/{id}/IS-CON` |
| `/calculation/lv1/revenue/create` | `POST /engine/recalculate/{id}` |
| `/calculation/lv1/create` | `POST /engine/recalculate/{id}` |
| `/calculation/lv1/fetch` | `GET /engine/results/{id}/IS-CON` |
| `/calculation/lv3/sm_ga/*` | `GET /engine/results/{id}/S&M` or `G&A` |
| `/calculation/lv3/fa/*` | `GET /engine/results/{id}/FA` |
| `/calculation/lv3/debt/*` | `GET /engine/results/{id}/DEBT` |
| `/calculation/lv3/WC/*` | `GET /engine/results/{id}/WC` |
| `/calculation/BS/*` | `GET /engine/results/{id}/BS` |
| `/calculation/BS/lv3/EOSP/*` | `GET /engine/results/{id}/eosp` |
| `/calculation/BS/lv3/equity/*` | `GET /engine/results/{id}/equity` |
| `/export/historical/*` | `GET /engine/export/{id}` |
| `/historical/create/ai/*` | `POST /agents/historical/generate-all` |

To fully remove legacy endpoints: delete `legacy_api.py` and remove `register_legacy_routes(app)` from `main.py`.

---

## 11. Accuracy Testing

**Benchmark script:** `tests/benchmark_excel.py` — reads two human-verified Excel files and compares cell-by-cell against engine HTTP output.

**Reference Excel files:**
- `app/core/excel/human/NSC Financial Model MI.xlsx` → client `pwc-test-123456`
- `app/core/excel/human/ECSO-Financial Model MH.xlsx` → client `ESCO-1`

**Current combined accuracy: 98.9%** (1225/1238 cells, 1 SAR tolerance) — as of 2026-05-01.
- NSC (`pwc-test-123456`): 654/663 = 98.6%
- ESCO (`ESCO-1`): 571/575 = 99.3%
- Perfect modules: NSC IS-CON, BS, S&M, FA, DEBT, equity; ESCO IS-CON, BS, S&M, G&A, FA, equity

**Known structural limitations (13 remaining mismatches — accepted, not bugs):**

| Client | Module | Years | Cause |
|---|---|---|---|
| NSC | CF/WC | 2019 | Excel 2019 WC uses 2018 as prior year; engine's 2018 data differs from Excel reference |
| NSC | G&A | 4 cells | IS-CON total vs Lv3 per-item growth rate trade-off |
| ESCO | CF | 2018 | First historical year has no prior year for WC/EOSI/capex delta — all 0 vs small Excel values |

**Key fixes applied to reach 98.9% (2026-04-28 → 2026-05-01):**

1. **`other_gap` in historical output (H16):** `_fill_lv3_gap` creates an `other_gap` residual row in memory, but `merge_historical_into_data` only processes keys already in `data`. Since `other_gap` is excluded from forecasting by `_SKIP_KEYS`, it was never added to `data`. Fixed by explicitly injecting `other_gap` from `historical` into `data` in `ga.py` and `sm.py` after the merge.

2. **One-time provision items (H17):** `_derive_dynamic_items` in defaults_generator assigned `rate=0.0` to items that were 0 in all years except the last (one-time spikes like impairment provisions). These were then forecasted at the spike value indefinitely. Fixed by detecting such items and assigning `rate=-1.0` (decline to 0 in year 1).

3. **`lv3_max_year` guard for gap detection:** `_add_gap_item` skips IS-CON years beyond the last Lv3 year to avoid creating spurious gap items for years without Lv3 data. When `items` is empty (no Lv3 data at all), `lv3_max_year` is now `None` (not `"0"`), allowing all IS-CON years through.

4. **CF historical year boundary (H19):** CF historical years restricted to `cash_series` only — excluding years with D&A/RE but no cash balance (e.g., ESCO 2017). Prevents wrong first-year EOSI/WC computations.

5. **CF NWC contract liability (H19):** Added `amountsDueToCustomersForContractWork` to `nwc_cl_keys` in `cf.py`. Construction clients have significant advance-payment liabilities that must be included in historical NWC to get accurate WC change figures.

6. **IS-CON `oneOffItems` (H20):** Added `oneOffItems` Firestore key to historical EBITDA computation in `is_con.py`. Flows into historical EBITDA without polluting the forecast `other_income` base.

7. **Exact EOSB rate (H21):** `eosb_pct` must be exactly `1/24 = 0.041666666...` not `0.04167`. The rounding error accumulates to 170+ SAR over 5 forecast years. Always patch with the Python literal `1/24`.

8. **Exact FA blended rate (H21):** When tuning for benchmark accuracy, compute the exact blended rate from Excel implied D&A rather than using the 3-year average. Example: `0.142760472359814` for NSC.

**Reliability Sprint fixes (2026-05-01) — improves correctness for new clients (does not affect NSC/ESCO benchmarks):**

9. **`otherReserves` equity plug (R01):** `bs.py` now computes the gap between the AI-extracted `shareholdersEquity` total and the sum of SC+SR+RE. Any gap > 1 SAR is stored as `otherReserves` and held flat in forecast. Fixes 8M+ equity gap for clients with General Reserve or similar unextracted components.

10. **BS extraction prompt equity rules (R02):** `extraction_historical_bs` now requires the AI to extract ALL equity components by name (camelCase keys) and, as a mandatory self-check, populate `otherEquityReserves` with any residual gap. Prevents missing equity from the very first extraction pass.

11. **IS-CON structured extraction prompt (R03):** `_generate_is_con_historical` now uses `create_extraction_gemini` with `extraction_historical_is_con` — a structured prompt with sign convention rules, required field list, and self-check formulas. Previously it used unstructured `create_calculations_gemini("Extract the needed Data")`.

12. **BS balance validation fix (R04):** `_validate_historical` was checking non-existent keys `totalLiabilities` and `totalEquity`. Now correctly uses `currentLiabilities + nonCurrentLiabilities + shareholdersEquity` (actual Firestore keys). Added `severity` field to all warnings; added equity component sum check; added `data_quality_score` to generate-all response.

13. **Accrued expenses fallback (R05):** `defaults_generator._derive_wc_days` now derives implied accrued expenses days from the `currentLiabilities` residual when the WC data has no `accruedExpenses` balance.

14. **`has_error` surfacing (R06):** `save-table` endpoint now returns `tables_with_errors` count and a `warning` message when any extracted table has `has_error: true`.

**New assumption fields added during accuracy restoration sprint (2026-05-02):**

15. **`capex_half_year` flag (FA):** `CapexAssumptions.capex_half_year: bool = True`. When `False`, no half-year convention is applied to capex additions in the year of purchase (`additions_depr_base = 0` instead of `additions × 0.5`). Use `False` for clients whose Excel model depreciates only the opening balance (not new additions in year 1). Patch: `{"capex": {"capex_half_year": false}}`.

16. **`eosb_salary_growth_pct` override (EOSP):** `OtherAssumptions.eosb_salary_growth_pct: Optional[float] = None`. When set, EOSP grows total salaries from last historical year at this fixed annual rate instead of summing G&A + S&M `salariesWagesAndBenefits` from upstream. Use when IS-CON aggregate G&A assumptions cause salary trajectory to diverge from the standalone EOSP schedule. Patch: `{"other": {"eosb_salary_growth_pct": 0.03}}`.

17. **`other_receivables_nc_annual_change` per-year (BS):** `OtherAssumptions.other_receivables_nc_annual_change: Optional[Dict[str, float]] = None`. When set, BS adds this annual increment to `otherReceivablesNonCurrent` each forecast year (instead of holding flat at last historical value). Positive = balance grows (CF outflow). Patch: `{"other": {"other_receivables_nc_annual_change": {"2023": 182594, "2024": 115168, "2025": 141688, "2026": 36915, "2027": 39130}}}`.

18. **`statutory_reserve_cap_pct` for early-maxed reserve (Equity):** `OtherAssumptions.statutory_reserve_cap_pct: float = 0.50`. When the statutory reserve has already reached its cap at the last historical year, set this to `cap_amount / share_capital`. Example: ESCO reserve already at 150K on 500K capital → `cap_pct = 0.30`. Patch: `{"other": {"statutory_reserve_cap_pct": 0.30}}`.

19. **WC days precision matters:** When two WC items are symmetric (e.g., `prepayments` and `amounts_due_to_customers` use the same days but opposite signs), both must use exactly the same decimal-precision days value. Rounding one to 2 d.p. while leaving the other rounded differently causes them to no longer cancel in `operatingWorkingCapital`, shifting the CF cash balance. Always patch both together.

20. **Test isolation — `run_full_model_with_historical(save=False)` (T01):** `orchestrator.run_full_model_with_historical` now accepts `save: bool = True`. Unit/integration tests must pass `save=False` to prevent the test's in-memory assumptions from overwriting benchmark clients' stored results in Firestore. Without this, running pytest corrupts NSC/ESCO stored forecasts.

**Running the benchmark:**
```bash
# Prerequisites: server running + both clients auto-setup
uvicorn app.main:app --reload
curl -X POST http://127.0.0.1:8000/engine/auto-setup/pwc-test-123456
curl -X POST http://127.0.0.1:8000/engine/auto-setup/ESCO-1

python3 tests/benchmark_excel.py
```

## 12. Test Suite (170 tests)

| File | Tests | Type |
|------|-------|------|
| `tests/test_engine_validation.py` | 126 | Integration (Firestore) |
| `tests/test_gap_detection.py` | 14 | Unit |
| `tests/test_valuation_suite.py` | 21 | Integration (TestClient) — VAL-R1..R6 regression for BV / Comps / VM |
| `tests/test_leverage_ratio.py` | 3 | Unit |
| `tests/test_export_formatting.py` | 16 | Unit |

Run: `pytest tests/ -v` (all) or `pytest tests/test_gap_detection.py tests/test_leverage_ratio.py tests/test_export_formatting.py -v` (unit only, no Firestore).

---

## 13. engine2 — PDF → Formula-Linked Excel (NEW)

A second, self-contained engine that takes raw PDF financial statements and
produces a fully-formula-linked Excel three-statement model. It lives in
`app/engine2/` and is mounted at the `/engine2` prefix. It **does not** read
Firestore, share assumptions with the original engine, or use the 5-step
cascade — it is a parallel pipeline meant for one-shot UI uploads where the
user just wants a workbook.

### 13.1 What it does

```
PDFs ──► Gemini 3.1 Pro (thinking_level=high, media_resolution_high)
              │  extracts structured JSON (IS / BS / CF / schedules / assumptions)
              ▼
        GeminiAnalysis (Pydantic validated locally)
              │
              ▼
        openpyxl builder ──► <ShortName>_Financial_Model.xlsx
              │   13 sheets: Cover, Assumptions, IS, BS, CF,
              │   Working_Capital_Schedule, PPE_Schedule, Debt_Schedule,
              │   Equity_Schedule, Ratios, Checks, Line_Item_Map, Reconciliation
              ▼   Every projected cell is a real Excel formula referencing Assumptions.
```

### 13.2 Environment variables

| Var | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | **yes** | — | Gemini Developer API key. Project must have billing enabled — `gemini-3.1-pro-preview` has no free tier. |
| `GEMINI_MODEL` | no | `gemini-3.1-pro-preview` | Override to swap to Flash for cheaper testing. |
| `THINKING_LEVEL` | no | `high` | `high` = max reasoning for Pro. Lower = faster but lower accuracy. |
| `MEDIA_RESOLUTION` | no | `media_resolution_high` | Per-PDF OCR token allowance. |
| `ENGINE2_DATA_DIR` | no | `./engine2_data` | Where uploads and outputs are stored (e.g. `engine2_data/uploads/<job_id>`, `engine2_data/outputs/<job_id>/<File>.xlsx`). |
| `ENGINE2_WORKERS` | no | `2` | Background thread pool size. |

### 13.3 API endpoints

Mounted in `main.py` with `app.include_router(engine2_router, prefix="/engine2")`.

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/engine2/health` | Returns `{ok, gemini_key_set, model, thinking_level, media_resolution, upload_dir, output_dir}`. Use to confirm the API key is wired and show config in your UI. |
| `POST` | `/engine2/generate` | `multipart/form-data` with one or more `files=` fields (PDFs only). Returns `202` with `{id, status:"queued", ...}`. The job runs in a background thread. |
| `GET`  | `/engine2/status/{job_id}` | Returns `{status, message, summary, company_name, download_url, output_filename, error, ...}`. Poll every ~2 s. `status` ∈ `queued / analyzing / building / done / error`. |
| `GET`  | `/engine2/download/{job_id}` | Streams the `.xlsx` when `status == "done"`. `409` if not ready, `404` if the id is unknown. |

### 13.4 End-to-end UI flow

```
1. (Optional) GET /engine2/health
       └─► confirm gemini_key_set == true before showing the upload button.

2. POST /engine2/generate                       (multipart, one or more PDFs)
       └─► 202 { id: "<job_id>", status: "queued", ... }

3. Loop every ~2 s:
       GET /engine2/status/<job_id>
       └─► status transitions: queued → analyzing → building → done
                                                              └─ error
       └─► when status == "done":
              - response.summary           ← 250-word executive summary
              - response.company_name      ← detected company name
              - response.download_url      ← "/engine2/download/<job_id>"

4. GET /engine2/download/<job_id>
       └─► streams <ShortName>_Financial_Model.xlsx
```

Typical latency: **60–240 seconds per generation** (Gemini Pro with
`thinking_level=high`). Never block an HTTP handler on this — the router
already runs the work in a `ThreadPoolExecutor`.

### 13.5 Operational limits

- **Inline PDF cap:** total request payload is soft-capped at **18 MB**.
  PDFs are sent as `inline_data` (not via the v1alpha Files API, which has a
  known upload bug). A 5–8 file pack of typical 1–3 MB statements is comfortable.
- **Cost:** ~$0.20–$1.50 per generation (Gemini 3.1 Pro: $2/$12 per 1M
  input/output tokens below 200k tokens; $4/$18 above).
- **Job state is in-process.** `JOBS` is a dict guarded by a lock. With
  multiple uvicorn workers, a job created on worker A won't be visible on
  worker B. For production, swap `JOBS` for Redis and replace the
  `ThreadPoolExecutor` with Celery/RQ/Arq — only `_run_job` needs to move.

### 13.6 Output workbook

Always one `.xlsx`. Hard-coded historicals are **blue**, formula projections
are **black/green**, check cells are **red on FAIL**. Example formulas:

| Cell | Formula |
|---|---|
| Revenue projection | `=D4*(1+'Assumptions'!E10)` |
| COGS | `=-SUM('IS'!E4)*'Assumptions'!E11` |
| Depreciation | `=-'PPE_Schedule'!E7` |
| BS cash plug | `='CF'!E7` |
| Gross margin | `=IFERROR('IS'!E6/SUM('IS'!E4),"")` |
| BS balance check | `=IF(ABS(SUM(...)-SUM(...))<1,"OK","FAIL")` |

### 13.7 Library usage (no HTTP)

For server-side jobs that already have the PDFs locally:

```python
from pathlib import Path
from app.engine2 import generate_excel_model, GeminiError

try:
    xlsx_path = generate_excel_model(
        pdf_paths=[Path("fs_2022.pdf"), Path("fs_2023.pdf")],
        output_dir=Path("/tmp/models"),
    )
    # xlsx_path → /tmp/models/<ShortName>_Financial_Model.xlsx
except GeminiError as e:
    ...  # billing not enabled, quota exhausted, malformed PDF, etc.
```

The call is synchronous and slow (1–4 min). Run it inside a background task
or `run_in_executor`, never directly in a request handler.

### 13.8 When things break — first place to look

| Symptom | Likely cause | Fix |
|---|---|---|
| `/engine2/health` shows `gemini_key_set: false` | env var missing | Export `GEMINI_API_KEY` and restart uvicorn. |
| Status `error` + message mentions `400 Bad Request` | Gemini schema/prompt drift | Read `app/engine2/prompts.py` against current `GeminiAnalysis` in `app/engine2/schemas.py`. |
| Status `error` + `429 RESOURCE_EXHAUSTED` | Billing not enabled on the key's GCP project | Enable billing on the Google AI Studio project that owns the key. |
| BS sheet shows `FAIL` in Checks | Model under-reported a BS line; usually a missing `projection_method` | Update the prompt in `app/engine2/prompts.py` — not the builder. |
| Cells show formulas, not values | Reader doesn't auto-evaluate | Open in real Excel or re-save in LibreOffice. |

### 13.9 Relationship to the original engine

`engine2` and `app/engine/` are **independent**. They do not share Firestore
collections, Pydantic models, the Excel exporter, the test suite, or the
assumption generator. Adding endpoints under `/engine/*` does not affect
`/engine2/*` and vice versa.

---

To fully remove legacy later:

  1. Delete app/api/legacy_api.py
  2. Remove register_legacy_routes(app) from main.py
  3. Delete app/api/helper/APIAiHelper.py
  4. Delete app/Utils/CalculationHelper.py, app/Utils/test_data.py, app/api/scratches.py
  5. Clean deprecated functions from app/Utils/FirestoreUtlis.py
