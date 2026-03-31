# Backend Documentation: AdvisorsME Financial Engine

**Source of Truth** for system logic, data architecture, and operational flows.
**Last updated:** 2026-03-30

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
│                         Firestore                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │  statements/  │  │ calculations/│  │  users/          │       │
│  │  (raw tables) │  │ (processed)  │  │  (auth)          │       │
│  └──────────────┘  └──────────────┘  └──────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Firestore Schema

### 2.1 Collection: `statements/{client_id}/client_statements/`

**Purpose:** Raw extracted financial tables from PDF documents.

Each document represents one table extracted by the AI PDF processor.

```
{
  "table_english": "Revenue,2023,2022,2021\nSales,40067175,...",
  "title_english": "Statement of Comprehensive Income",
  "financial_bucket": "Statement of Comprehensive Income",
  "statement_year": 2023,
  "metadata": {
    "type": "normal",
    "note_number": null
  },
  "has_error": false
}
```

**Financial Buckets** (the grouping system):
| Bucket | Contains |
|---|---|
| `Statement of Comprehensive Income` | Revenue, COGS, expenses, net income |
| `Notes of Statement of Comprehensive Income` | Detailed breakdowns (S&M, G&A line items) |
| `Statement of Financial Position` | Assets, liabilities, equity (Balance Sheet) |
| `Notes of Statement of Financial Position` | PP&E schedules, debt details, WC breakdowns |
| `Statement of Cash Flows` | CFO, CFI, CFF |
| `Statement of Changes in Equity` | Share capital, reserves, retained earnings movements |

### 2.2 Collection: `calculations/{client_id}/`

**Purpose:** Processed financial data organized by level and time horizon.

```
calculations/{client_id}/
├── assumptions/
│   └── current              ← Stored assumptions JSON
│
├── historical_lv1/
│   ├── IS-CON               ← Aggregated Income Statement (historical)
│   ├── BS                   ← Aggregated Balance Sheet (historical)
│   └── CF                   ← Cash Flow Statement (historical)
│
├── historical_lv3/
│   ├── S&M                  ← Selling & Marketing detail (historical)
│   ├── G&A                  ← General & Admin detail (historical)
│   ├── FA                   ← Fixed Assets schedule (historical)
│   ├── WC                   ← Working Capital items (historical)
│   └── DEBT                 ← Debt schedule (historical)
│
├── forecasting_lv1/
│   ├── IS-CON               ← Forecasted Income Statement
│   ├── BS                   ← Forecasted Balance Sheet
│   └── CF                   ← Forecasted Cash Flow Statement
│
└── forecasting_lv3/
    ├── S&M                  ← Forecasted S&M expenses
    ├── G&A                  ← Forecasted G&A expenses
    ├── FA                   ← Forecasted Fixed Assets
    ├── WC                   ← Forecasted Working Capital
    ├── DEBT                 ← Forecasted Debt
    ├── equity               ← Forecasted Equity components
    └── eosp                 ← Forecasted EOSB/EOSP
```

### 2.3 Document Format (calculations)

Every document in `calculations/` follows this format:

```json
{
  "lineItemKey": {
    "param_name": "Human-readable label",
    "2019": 800000,
    "2020": 900000,
    "2021": 1000000,
    "2022": 1200000,
    "2023": 1350000,
    "2024": 1500000,
    "2025": 1650000,
    "2026": 1800000,
    "2027": 1950000,
    "2028": 2100000
  }
}
```

- Keys are camelCase identifiers (e.g., `revenue`, `costOfRevenue`, `tradeReceivables`)
- `param_name` is the display label
- Year keys are string digits
- **Historical years** (e.g., 2019-2023) come from `historical_lv1/lv3` Firestore data
- **Forecast years** (e.g., 2024-2028) are computed by the engine
- Both historical and forecast years appear in the same output document
- Some items include `growth_assumption`, `base_kpi`, `order` metadata (legacy format from agent tools)

---

## 3. The Level Hierarchy

### Level 1 (Lv1) — Primary Financial Statements

| Document | Description |
|---|---|
| IS-CON | Income Statement Consolidated — Revenue through Net Income |
| BS | Balance Sheet — Assets, Liabilities, Equity |
| CF | Cash Flow Statement — Operating, Investing, Financing activities |

### Level 3 (Lv3) — Sub-Module Detail

| Document | Feeds Into | Contains |
|---|---|---|
| S&M | IS-CON (Selling & Marketing Expenses line) | Salaries, rent, repairs, travel, etc. |
| G&A | IS-CON (General & Admin Expenses line) | Salaries, mgmt recharge, professional fees, etc. |
| FA | IS-CON (Depreciation line) + BS (PPE line) | Opening, Additions, Depreciation, Closing NBV |
| WC | BS (Current Assets & Current Liabilities) + CF (Change in WC) | Trade receivables, inventories, payables, etc. |
| DEBT | IS-CON (Finance Costs line) + BS (Borrowings lines) | Opening, Proceeds, Repayments, Closing, Interest |
| equity | BS (Equity section) + CF (Dividends) | Share capital, statutory reserve, retained earnings |
| eosp | BS (EOSB line) + CF (Change in EOSB) | Total salaries, EOSI, termination benefits |

### How Levels Connect

```
Level 3 (Detail)              Level 1 (Aggregated)
─────────────────             ────────────────────
S&M.totalSellingMarketingExpenses  →  IS-CON.sellingMarketingExpenses
G&A.totalGeneralAdminExpenses      →  IS-CON.generalAdminExpenses
FA.depreciation                    →  IS-CON.depreciationAmortization
FA.closingNBV                      →  BS.propertyAndEquipment
DEBT.financeCosts                  →  IS-CON.financeCosts
DEBT.currentPortion                →  BS.shortTermBorrowings
DEBT.nonCurrentPortion             →  BS.longTermBorrowings
WC.tradeReceivables                →  BS.tradeReceivables
WC.changeInWorkingCapital          →  CF.changeInWorkingCapital
equity.totalEquity                 →  BS.totalEquity
equity.dividends                   →  CF.dividendsPaid
eosp.terminationBenefits           →  BS.employeeTerminationBenefits
CF.closingCash                     →  BS.cashAndCashEquivalents
```

---

## 4. The AI Agent Tool: "Get by Financial Bucket"

### Purpose

The Historical Generation Agent uses the `get_by_financial_bucket` tool to query raw extracted statements from Firestore and map them into structured Lv3 historical data.

### Location

`app/agents/historical_generation/tools.py`

### How It Works

```python
def get_by_financial_bucket(client_id: str, financial_bucket: str) -> list[dict]:
    """
    Queries statements/{client_id}/client_statements/
    where financial_bucket == {bucket_name}
    Returns list of matching documents (CSV tables + metadata)
    """
```

### Tool Registry

| Tool | Purpose |
|---|---|
| `get_by_financial_bucket` | Query statements by bucket |
| `save_historical_lv3` | Write processed Lv3 data to calculations/{client_id}/historical_lv3/{doc} |
| `get_document_code_mappings` | Fetch the mapping config |
| `add_document_code_mapping` | Add new document type mapping |

### Agent Flow

```
1. Receive (client_id, document_code) e.g., ("pwc-test-123456", "S&M")
2. Look up bucket mapping for "S&M"
3. Call get_by_financial_bucket(client_id, "Notes of Statement of Comprehensive Income")
4. AI parses returned CSV tables to find "Selling and marketing expenses" section
5. Extracts individual line items (salaries, rent, etc.) with year values
6. Structures as Lv3 JSON format
7. Calls save_historical_lv3(client_id, "S&M", structured_data)
```

---

## 5. Recalculation Flow

### Trigger

Any of these API calls triggers recalculation:
- `POST /engine/recalculate/{client_id}` (explicit)
- `PATCH /engine/assumptions/{client_id}` (implicit — auto-recalculates after merge)

### The 5-Step Cascade

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Revenue & Gross Profit                                  │
│   Input: Historical IS-CON revenue + assumptions.revenue        │
│   Output: Forecasted revenue, COGS, gross profit per year       │
├─────────────────────────────────────────────────────────────────┤
│ Step 2: Parallel Level 3 Modules                                │
│   S&M  ← revenue output + assumptions.opex.sm_expenses         │
│   G&A  ← assumptions.opex.ga_expenses                          │
│   FA   ← historical FA + assumptions.capex & depreciation      │
│   WC   ← revenue output + assumptions.working_capital          │
│   Debt ← historical DEBT + assumptions.debt                    │
├─────────────────────────────────────────────────────────────────┤
│ Step 2b: EOSP                                                   │
│   Input: S&M salaries + G&A salaries + assumptions.other.eosb  │
│   Output: Total salaries, EOSI, termination benefits            │
├─────────────────────────────────────────────────────────────────┤
│ Step 3: Income Statement Consolidation (IS-CON)                 │
│   Input: Revenue + S&M total + G&A total + FA depreciation      │
│          + Debt finance costs + assumptions.other               │
│   Output: Full P&L through Net Income                           │
├─────────────────────────────────────────────────────────────────┤
│ Step 3b: Equity                                                 │
│   Input: Historical BS equity + IS-CON Net Income               │
│   Output: Share capital, statutory reserve, retained earnings    │
├─────────────────────────────────────────────────────────────────┤
│ Step 4: Cash Flow Statement                                     │
│   Input: IS-CON + WC changes + FA additions + Debt movement     │
│          + Equity dividends + EOSP changes                      │
│   Output: CFO, CFI, CFF, closing cash balance                  │
├─────────────────────────────────────────────────────────────────┤
│ Step 5: Balance Sheet                                           │
│   Input: WC items + FA closing + Debt portions + Equity totals  │
│          + CF closing cash + IS-CON net income (for analytics)  │
│   Output: Full BS, validates Assets = Liabilities + Equity      │
└─────────────────────────────────────────────────────────────────┘
```

### Why Full Cascade?

The engine always runs ALL steps, even if only one assumption changed. Reasons:
1. **Interdependencies are complex** — changing revenue growth affects S&M (% of revenue items), WC (days of sales), IS-CON, CF, and BS
2. **Calculation is fast** — pure arithmetic, no AI/LLM calls, no network I/O during computation
3. **Consistency guaranteed** — no risk of stale data from partial updates

### Data Flow During Recalculation

```
1. LOAD: Read all historical data from Firestore (one batch)
   calculations/{client_id}/historical_lv1/ → IS-CON, BS, CF
   calculations/{client_id}/historical_lv3/ → S&M, G&A, FA, WC, DEBT

2. COMPUTE: Run all calculators in dependency order (pure functions)
   Each calculator receives: (historical, assumptions, upstream_outputs, forecast_years)
   Each calculator returns: ModuleOutput(module_name, level, data, analytics)
   Each calculator merges historical year values into its output data

3. SAVE: Write all outputs to Firestore (one batch)
   calculations/{client_id}/forecasting_lv1/ → IS-CON, BS, CF
   calculations/{client_id}/forecasting_lv3/ → S&M, G&A, FA, WC, DEBT, equity, eosp
```

---

## 6. Module Output Data & Analytics Reference

Every calculator returns a `ModuleOutput` with `data` (line items) and `analytics` (key indicators). Both contain historical + forecast years.

### 6.1 Revenue (`revenue.py`)

**Data Keys:**
| Key | Display Name |
|---|---|
| `revenue` | Revenue |
| `costOfRevenue` | Cost of revenue |
| `grossProfit` | Gross profit |

**Analytics:**
| Key | Display Name |
|---|---|
| `salesGrowthYoY` | Sales annual growth % |
| `grossProfitMargin` | Gross profit margin % |

**Logic:**
```
Revenue[year] = Revenue[year-1] * (1 + growth_yoy_pct[year])
Gross Profit[year] = Revenue[year] * gp_margin_sales_pct[year]
Cost of Revenue[year] = Gross Profit[year] - Revenue[year]  (negative)
```

### 6.2 S&M Expenses (`sm.py`)

**Data Keys:**
| Key | Display Name |
|---|---|
| `salariesWagesAndBenefits` | Salaries, Wages and Benefits |
| `repairsAndMaintenance` | Repairs and Maintenance |
| `rent` | Rent |
| `travelAndCommunication` | Travel and Communication |
| `legalCost` | Legal Cost |
| `sellingAndPromotion` | Selling and Promotion |
| `stationary` | Stationary |
| `insurance` | Insurance |
| `other` | Other |
| `totalSellingMarketingExpenses` | Total Selling & Marketing Expenses |

**Analytics (5 sections):**
| Key | Display Name | Description |
|---|---|---|
| `smPctOfRevenue` | S&M as % of Revenue | Total S&M / Revenue per year |
| `smAnnualGrowth` | S&M annual growth % | YoY growth of total S&M |
| `pctOfRevenue` | Per-item % of Revenue | Each line item as % of revenue, keyed by item |
| `annualGrowth` | Per-item Annual Growth | Each line item YoY growth %, keyed by item |
| `commonSize` | Per-item Common Size | Each line item as % of total S&M, keyed by item |

**Per-item analytics structure:**
```json
{
  "pctOfRevenue": {
    "salariesWagesAndBenefits": { "param_name": "...", "2019": 0.05, "2024": 0.04, ... },
    "repairsAndMaintenance": { "param_name": "...", "2019": 0.01, "2024": 0.01, ... }
  },
  "annualGrowth": {
    "salariesWagesAndBenefits": { "param_name": "...", "2020": 0.03, "2024": 0.03, ... }
  },
  "commonSize": {
    "salariesWagesAndBenefits": { "param_name": "...", "2019": 0.45, "2024": 0.40, ... }
  }
}
```

**Logic:** Each line item uses one of two drivers:
- **YoY Growth:** `Value[year] = Value[year-1] * (1 + rate)`
- **% of Revenue:** `Value[year] = -(Revenue[year] * pct)` (for travelAndCommunication)

### 6.3 G&A Expenses (`ga.py`)

**Data Keys:**
| Key | Display Name |
|---|---|
| `salariesWagesAndBenefits` | Salaries, Wages and Benefits |
| `managementRecharge` | Management Recharge |
| `professionalFees` | Professional Fees |
| `travel` | Travel |
| `stationary` | Stationary |
| `impairmentOnTradeReceivables` | Impairment on Trade Receivables |
| `other` | Other |
| `totalGeneralAdminExpenses` | Total General & Administrative Expenses |

**Analytics (5 sections):** Same structure as S&M:
| Key | Display Name |
|---|---|
| `gaPctOfRevenue` | G&A as % of Revenue |
| `gaAnnualGrowth` | G&A annual growth % |
| `pctOfRevenue` | Per-item % of Revenue |
| `annualGrowth` | Per-item Annual Growth |
| `commonSize` | Per-item Common Size |

**Logic:** All line items use **YoY Growth**: `Value[year] = Value[year-1] * (1 + rate)`

### 6.4 Fixed Assets (`fa.py`)

**Data Keys:**
| Key | Display Name |
|---|---|
| `PropertyAndEquipment` | Opening Balance - NBV |
| `additions` | Additions (CapEx) |
| `depreciation` | Depreciation |
| `closingNBV` | Closing Balance - NBV |

**Analytics:** None

**Logic:**
```
Additions[year] = Opening[year] * capex_pct_of_opening_balance
Depreciation[year] = -(blended_depr_rate * (Opening[year] + Additions[year] * 6/12))
Closing[year] = Opening[year] + Additions[year] + Depreciation[year]
Opening[year+1] = Closing[year]
```

### 6.5 Working Capital (`wc.py`)

**Data Keys:**
| Key | Display Name |
|---|---|
| `tradeReceivables` | Trade Receivables |
| `dueFromRelatedParties` | Due from Related Parties |
| `inventories` | Inventories |
| `prepayments` | Prepayments |
| `tradePayables` | Trade Payables |
| `accruedExpenses` | Accrued Expenses |
| `dueToRelatedParties` | Due to Related Parties |
| `zakatPayable` | Zakat Payable |
| `operatingWorkingCapital` | Operating Working Capital |
| `changeInWorkingCapital` | Change in Working Capital |

**Analytics (6 keys):**
| Key | Display Name |
|---|---|
| `tradeReceivablesDays` | Trade Receivables (Days Sales) |
| `dueFromRelatedPartiesDays` | Due from Related Parties (Days Sales) |
| `inventoriesDays` | Inventories (Days COGS) |
| `prepaymentsDays` | Prepayments (Days COGS) |
| `tradePayablesDays` | Trade Payables (Days COGS) |
| `accruedExpensesDays` | Accrued Expenses (Days COGS) |

**Logic:**
- **Days of Sales items:** `Balance = (Days / 365) * Revenue`
- **Days of COGS items:** `Balance = (|Days| / 365) * |COGS|` (with sign)
- **Fixed items:** Hold constant
- **OWC** = Sum of all WC items
- **Change in WC** = Previous OWC - Current OWC

### 6.6 Debt (`debt.py`)

**Data Keys:**
| Key | Display Name |
|---|---|
| `openingBalance` | Opening Balance |
| `loanProceeds` | Loan Proceeds |
| `repayments` | Repayments |
| `closingBalance` | Closing Balance |
| `financeCosts` | Finance Costs |
| `currentPortion` | Current Portion (Short-term) |
| `nonCurrentPortion` | Non-Current Portion (Long-term) |

**Analytics:**
| Key | Display Name |
|---|---|
| `financingRate` | Financing Rate % |

**Logic:**
```
Closing = Opening + Proceeds - Repayments
Finance Costs = -(Opening * financing_rate)
```

### 6.7 EOSP (`eosp.py`)

**Data Keys:**
| Key | Display Name |
|---|---|
| `totalSalaries` | Total Salaries |
| `eosi` | EOSI |
| `terminationBenefits` | Employee Termination Benefits |

**Analytics:** None

**Logic:**
```
Total Salaries = |S&M salaries| + |G&A salaries|
EOSI = Total Salaries * eosb_pct
Termination Benefits[year] = Benefits[year-1] + EOSI[year]
```

### 6.8 IS-CON (`is_con.py`)

**Data Keys:**
| Key | Display Name |
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
| `otherIncomeLoss` | Other income/(loss) |
| `EBITDA` | EBITDA |
| `depreciationAmortization` | Depreciation and amortization |
| `financeCosts` | Finance costs |
| `zakat` | Zakat |
| `netIncomeLoss` | Net income/(loss) |

**Analytics (9 keys):**
| Key | Display Name |
|---|---|
| `salesGrowthYoY` | Sales annual growth % |
| `smGrowthYoY` | S&M annual growth % |
| `gaGrowthYoY` | G&A annual growth % |
| `smPctOfRevenue` | S&M as % of revenue |
| `gaPctOfRevenue` | G&A as % of revenue |
| `grossProfitMargin` | Gross profit margin % |
| `operatingProfitMargin` | Operating profit % |
| `EBITDAMargin` | EBITDA % |
| `netIncomeMargin` | Net income % |

**Logic:**
```
Operating Profit = Gross Profit + S&M total + G&A total
EBITDA = Operating Profit + equity_income + fair_value + other_income
EBT = EBITDA + Depreciation + Finance Costs
Zakat = -(|EBT| * zakat_rate) if EBT > 0 else 0
Net Income = EBT + Zakat
```

### 6.9 Equity (`equity.py`)

**Data Keys:**
| Key | Display Name |
|---|---|
| `shareCapital` | Share Capital |
| `statutoryReserve` | Statutory Reserve |
| `statutoryReserveTransfer` | Transfer to Statutory Reserve |
| `retainedEarnings` | Retained Earnings |
| `dividends` | Dividends |
| `partnersCurrentAccounts` | Partners Current Accounts |
| `totalEquity` | Total Shareholders' Equity |

**Analytics:**
| Key | Display Name |
|---|---|
| `dividendPayoutRatio` | Dividend Payout Ratio |

**Logic:**
```
Share Capital: held flat
Statutory Reserve Transfer = min(NI * 10%, cap - current_reserve)
Retained Earnings = Previous + Net Income - Transfer - Dividends
Total Equity = Share Capital + Statutory Reserve + Retained Earnings
```

### 6.10 Cash Flow (`cf.py`)

**Data Keys:**
| Key | Display Name |
|---|---|
| `netIncome` | Net Income |
| `depreciationAmortization` | Depreciation & Amortization |
| `changeInWorkingCapital` | Change in Working Capital |
| `changeInEOSB` | Change in EOSB |
| `cashFlowFromOperations` | Cash Flow from Operating Activities (CFO) |
| `capex` | Capital Expenditure |
| `cashFlowFromInvesting` | Cash Flow from Investing Activities (CFI) |
| `netDebtMovement` | Net Debt Movement |
| `dividendsPaid` | Dividends Paid |
| `cashFlowFromFinancing` | Cash Flow from Financing Activities (CFF) |
| `netChangeInCash` | Net Change in Cash |
| `openingCash` | Opening Cash Balance |
| `closingCash` | Closing Cash Balance |

**Analytics:**
| Key | Display Name |
|---|---|
| `freeCashFlow` | Free Cash Flow (FCF) |

**Logic:**
```
CFO = Net Income + |Depreciation| + Change in WC + Change in EOSB
CFI = -|Additions|
CFF = Net Debt Movement + Dividends
Net Change = CFO + CFI + CFF
Closing Cash = Opening Cash + Net Change
```

### 6.11 Balance Sheet (`bs.py`)

**Data Keys:**
| Key | Display Name | Section |
|---|---|---|
| `cashAndCashEquivalents` | Cash and Cash Equivalents | Current Assets |
| `tradeReceivables` | Trade Receivables | Current Assets |
| `dueFromRelatedParties` | Due from Related Parties | Current Assets |
| `inventories` | Inventories | Current Assets |
| `prepayments` | Prepayments and Other Current Assets | Current Assets |
| `totalCurrentAssets` | Total Current Assets | Current Assets |
| `propertyAndEquipment` | Property and Equipment | Non-Current Assets |
| `totalNonCurrentAssets` | Total Non-Current Assets | Non-Current Assets |
| `totalAssets` | Total Assets | |
| `tradePayables` | Trade Payables | Current Liabilities |
| `accruedExpenses` | Accrued Expenses and Other Current Liabilities | Current Liabilities |
| `dueToRelatedParties` | Due to Related Parties | Current Liabilities |
| `zakatPayable` | Zakat Payable | Current Liabilities |
| `shortTermBorrowings` | Short-term Borrowings | Current Liabilities |
| `totalCurrentLiabilities` | Total Current Liabilities | Current Liabilities |
| `longTermBorrowings` | Long-term Borrowings | Non-Current Liabilities |
| `employeeTerminationBenefits` | Employee Termination Benefits | Non-Current Liabilities |
| `totalNonCurrentLiabilities` | Total Non-Current Liabilities | Non-Current Liabilities |
| `totalLiabilities` | Total Liabilities | |
| `shareCapital` | Share Capital | Equity |
| `statutoryReserve` | Statutory Reserve | Equity |
| `retainedEarnings` | Retained Earnings | Equity |
| `totalEquity` | Total Shareholders' Equity | Equity |
| `totalLiabilitiesAndEquity` | Total Liabilities and Equity | |
| `balanceCheck` | Balance Check (must be 0) | Validation |

**Analytics:**
| Key | Display Name |
|---|---|
| `currentRatio` | Current Ratio |
| `leverageRatio` | Leverage Ratio (Assets / Equity) |
| `roa` | Return on Assets (ROA) |
| `roe` | Return on Equity (ROE) |

---

## 7. Default Assumptions Generator

**File:** `app/engine/defaults_generator.py`

### Purpose

When a new client is onboarded and has historical data but no assumptions yet, this module auto-generates sensible default assumptions by analyzing historical financial patterns.

### Class: `DefaultsGenerator`

```python
async def generate(self, client_id: str, repo: FinancialDataRepository, num_forecast_years: int = 5) -> Assumptions
```

### What It Derives

| Assumption | Method | Source |
|---|---|---|
| Revenue YoY growth | Average of last 3 years' YoY growth | IS-CON `revenue` |
| GP margin | Average of last 3 years' GP/Revenue ratio | IS-CON `grossProfit`/`revenue` |
| S&M per-item growth rates | Average YoY growth per line item | S&M historical |
| S&M travel % of sales | Average ratio to revenue | S&M `travelAndCommunication` |
| G&A per-item growth rates | Average YoY growth per line item | G&A historical |
| WC days (6 items) | Average (balance/base) * 365 | WC items, IS-CON revenue/COGS |
| Due to RP fixed amount | Last year's value | WC `dueToRelatedParties` |
| Capex % of opening | Average additions/opening ratio | FA `additions`/`PropertyAndEquipment` |
| Depreciation blended rate | Average depreciation/opening ratio | FA `depreciation`/`PropertyAndEquipment` |
| Financing rate | Average finance costs/opening balance | DEBT `financeCosts`/`openingBalance` |
| Annual repayment | Last year's current portion | DEBT `currentPortion` |
| Zakat rate | Average zakat/EBT ratio | IS-CON `zakat`/computed EBT |
| Other income growth | Average YoY growth | IS-CON `otherIncomeLoss` |

All averages use the **last 3 historical years** by default.

### API Endpoint

```
POST /engine/generate-defaults/{client_id}?save=false
```

- `save=false` (default): Returns generated assumptions without persisting
- `save=true`: Also saves to Firestore as the client's current assumptions

---

## 8. API Endpoints Reference

### Financial Engine
| Method | Path | Purpose |
|---|---|---|
| POST | `/engine/assumptions/{client_id}` | Save full assumptions |
| GET | `/engine/assumptions/{client_id}` | Get stored assumptions |
| PATCH | `/engine/assumptions/{client_id}` | Partial update + auto-recalculate |
| POST | `/engine/recalculate/{client_id}` | Full model recalculation |
| GET | `/engine/results/{client_id}/{module}` | Get single module results |
| GET | `/engine/results/{client_id}` | Get all module results |
| POST | `/engine/generate-defaults/{client_id}` | Auto-generate assumptions from historical data |
| GET | `/engine/historical/{client_id}/{module}` | Get historical data for one module |
| GET | `/engine/historical/{client_id}` | Get all historical data |

### PDF Extraction (existing)
| Method | Path | Purpose |
|---|---|---|
| POST | `/split-pdf-to-images` | Convert PDF pages to base64 images |
| POST | `/extract-tables` | Extract financial tables (streaming) |
| POST | `/fix-table` | Fix incorrectly extracted table |

### Historical Agent (existing)
| Method | Path | Purpose |
|---|---|---|
| POST | `/agents/historical/generate` | Trigger Lv3 historical generation |
| GET | `/agents/historical/codes` | List valid document codes |
| POST | `/agents/historical/codes` | Add new document code mapping |

### Users (existing)
| Method | Path | Purpose |
|---|---|---|
| POST | `/users/create` | Register user |
| GET | `/users/login/{email}/{password}` | Login |

---

## 9. File Structure (Active Codebase)

```
AdvisorsME-API/
├── main.py                              # FastAPI entry point, route registration
├── requirements.txt                     # Python dependencies
├── app/
│   ├── Sidiqqi/firebase.json            # Firebase credentials
│   ├── engine/                          # Financial Calculation Engine
│   │   ├── models.py                    # Pydantic models (Assumptions, ModuleOutput)
│   │   ├── firestore_repo.py            # Centralized Firestore CRUD
│   │   ├── orchestrator.py              # 5-step cascade controller
│   │   ├── routes.py                    # API endpoint registration
│   │   ├── defaults_generator.py        # Auto-generate assumptions from historical data
│   │   └── calculators/                 # One file per financial module
│   │       ├── base.py                  # Abstract base with shared utilities
│   │       ├── revenue.py               # Revenue & GP
│   │       ├── sm.py                    # Selling & Marketing expenses
│   │       ├── ga.py                    # General & Admin expenses
│   │       ├── fa.py                    # Fixed Assets schedule
│   │       ├── wc.py                    # Working Capital
│   │       ├── debt.py                  # Debt financing
│   │       ├── eosp.py                  # End-of-Service Provision
│   │       ├── is_con.py                # Income Statement consolidation
│   │       ├── equity.py                # Shareholders' equity
│   │       ├── cf.py                    # Cash Flow Statement
│   │       └── bs.py                    # Balance Sheet
│   ├── api/
│   │   ├── AgentixPdf.py               # PDF extraction API
│   │   ├── AgenticAdvisor.py            # Financial data retrieval API
│   │   ├── Users.py                     # User auth API
│   │   ├── helper/
│   │   │   ├── firebase_service.py      # Firebase singleton
│   │   │   ├── APIAiHelper.py           # Legacy calculation helpers
│   │   │   ├── AIHelper.py              # Gemini AI integration
│   │   │   └── ExportManager.py         # Excel export
│   │   └── models/Models.py             # Pydantic models (User, FixedTable)
│   ├── agents/historical_generation/    # AI agent for historical data extraction
│   │   ├── agent.py, tools.py, routes.py, config.py
│   ├── prompts/PdfPrompts.py            # AI prompts for PDF extraction
│   └── Utils/                           # Legacy utilities
│       ├── CalculationHelper.py
│       ├── FirestoreUtlis.py
│       └── test_data.py, scratches.py
└── Old/                                 # Archived legacy files
```

---

## 10. End-to-End Workflow

### Complete Client Onboarding Flow

```
1. CREATE USER
   POST /users/create → client_id

2. UPLOAD & EXTRACT PDF
   POST /split-pdf-to-images → page images
   POST /extract-tables → raw financial tables saved to statements/{client_id}

3. GENERATE HISTORICAL DATA
   POST /agents/historical/generate { client_id, document_code: "S&M" }
   POST /agents/historical/generate { client_id, document_code: "G&A" }
   POST /agents/historical/generate { client_id, document_code: "FA" }
   POST /agents/historical/generate { client_id, document_code: "WC" }
   POST /agents/historical/generate { client_id, document_code: "DEBT" }
   → AI maps raw tables to structured Lv3 historical data in calculations/

4. AUTO-GENERATE DEFAULT ASSUMPTIONS (NEW)
   POST /engine/generate-defaults/{client_id}?save=true
   → Analyses historical data
   → Derives revenue growth, GP margins, opex rates, WC days, etc.
   → Returns and saves complete Assumptions object

5. RUN FULL MODEL
   POST /engine/recalculate/{client_id}
   → Executes 5-step cascade
   → Merges historical data into all outputs
   → Saves all forecasting_lv1/ and forecasting_lv3/ documents

6. VIEW RESULTS (includes historical + forecast)
   GET /engine/results/{client_id} → all module data with historical + forecast years

7. VIEW HISTORICAL DATA ONLY
   GET /engine/historical/{client_id} → raw historical data from Firestore
   GET /engine/historical/{client_id}/{module} → single module historical data

8. ADJUST & ITERATE
   PATCH /engine/assumptions/{client_id} { "revenue": { "growth_yoy_pct": { "2024": 0.60 } } }
   → Auto-recalculates → Fetch updated results
```
