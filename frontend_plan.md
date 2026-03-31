# Frontend Agent Specification: AdvisorsME Financial Dashboard

**Target Agent:** Lead AI Coder (Claude) — autonomous frontend rebuild
**Backend:** FastAPI at `{BASE_URL}` (default `http://localhost:8000`)
**Date:** 2026-03-30

---

## 1. System Context

You are rebuilding a financial modeling UI that connects to a backend calculation engine. The engine computes Income Statement, Balance Sheet, and Cash Flow Statement forecasts based on assumptions the user configures. Your UI must:

1. Let users **view** historical + forecasted financial data across all modules (ACTUAL + FORECAST columns side by side)
2. Let users **edit assumptions** that drive the forecasts
3. **Trigger recalculation** when assumptions change and reflect updated results
4. **Auto-generate default assumptions** for new clients from their historical data
5. Present data in **professional financial table format** (years as columns, line items as rows, with historical years visually distinguished from forecast years)

The backend does ALL computation. The frontend is a read/write layer over the API.

---

## 2. API Contract

### Base URL
```
{BASE_URL} = http://localhost:8000
```

### 2.1 Assumptions CRUD

#### Save Full Assumptions
```
POST /engine/assumptions/{client_id}
Content-Type: application/json
Body: <Assumptions JSON — see Section 3>
Response: { "status": "success", "message": "..." }
```

#### Get Current Assumptions
```
GET /engine/assumptions/{client_id}
Response: <Full Assumptions JSON>
404 if none saved yet
```

#### Partial Update + Auto-Recalculate
```
PATCH /engine/assumptions/{client_id}
Content-Type: application/json
Body: <Partial Assumptions — only changed fields>
Response: {
  "status": "success",
  "message": "Assumptions updated and model recalculated",
  "modules_computed": ["revenue", "S&M", "G&A", "FA", "WC", "DEBT", "eosp", "is_con", "equity", "CF", "BS"]
}
```

**This is the primary endpoint for UI-driven changes.** When a user changes any assumption input, PATCH the delta and the backend recalculates everything.

### 2.2 Full Recalculation

```
POST /engine/recalculate/{client_id}
Content-Type: application/json
Body: <Optional full Assumptions JSON. If omitted, uses stored assumptions.>
Response: {
  "status": "success",
  "client_id": "...",
  "modules_computed": [...],
  "summary": {
    "is_con": { "module": "IS-CON", "level": "lv1", "analytics": {...} },
    "BS": { "module": "BS", "level": "lv1", "analytics": {...} },
    ...
  }
}
```

### 2.3 Fetch Results

#### Single Module
```
GET /engine/results/{client_id}/{module}
module: IS-CON | BS | CF | S&M | G&A | FA | WC | DEBT | equity | eosp
Response: {
  "client_id": "...",
  "module": "IS-CON",
  "data": {
    "revenue": {
      "param_name": "Revenue",
      "2019": 28000000,
      "2020": 31500000,
      "2021": 35000000,
      "2022": 38000000,
      "2023": 40067175,
      "2024": 61222574.24,
      "2025": 69426278.15,
      "2026": 73591855.04,
      "2027": 78007366.34,
      "2028": 82687808.32
    },
    "costOfRevenue": { "param_name": "Cost of revenue", "2019": -21000000, ..., "2028": -62015856 },
    ...
  }
}
```

**IMPORTANT:** Results now include BOTH historical years (e.g., 2019-2023) AND forecast years (e.g., 2024-2028) in a single response. The UI must render both.

#### All Modules
```
GET /engine/results/{client_id}
Response: {
  "client_id": "...",
  "modules": ["IS-CON", "BS", "CF", "S&M", ...],
  "data": { "IS-CON": {...}, "BS": {...}, "CF": {...}, ... }
}
```

### 2.4 Auto-Generate Default Assumptions (NEW)

```
POST /engine/generate-defaults/{client_id}?save=false
Response: {
  "status": "success",
  "client_id": "...",
  "saved": false,
  "assumptions": { <Full Assumptions JSON> }
}
```

Query params:
- `save=true`: Also persists the generated assumptions to Firestore
- `save=false` (default): Returns assumptions without saving — useful for preview

**When to call:** When a client has historical data but no assumptions yet. The UI should offer a "Generate Default Assumptions" button that calls this endpoint, shows the generated values for review, and lets the user save/edit before running the model.

### 2.5 Historical Data (NEW)

#### Single Module Historical
```
GET /engine/historical/{client_id}/{module}
module: IS-CON | BS | CF | S&M | G&A | FA | WC | DEBT
Response: {
  "client_id": "...",
  "module": "S&M",
  "data": {
    "salariesWagesAndBenefits": { "param_name": "...", "2019": -500000, "2020": -520000, ... },
    ...
  }
}
```

#### All Historical
```
GET /engine/historical/{client_id}
Response: {
  "client_id": "...",
  "modules": ["IS-CON", "BS", "S&M", "G&A", "FA", "WC", "DEBT"],
  "data": { "IS-CON": {...}, "BS": {...}, ... }
}
```

### 2.6 Existing Endpoints (Keep Working)

| Endpoint | Purpose |
|---|---|
| `POST /extract-tables` | PDF extraction (streaming) |
| `POST /split-pdf-to-images` | PDF page to base64 images |
| `POST /users/create` | User registration |
| `GET /users/login/{email}/{password}` | User login |
| `POST /agents/historical/generate` | Trigger historical data agent |

---

## 3. Assumptions JSON Schema

This is the exact shape the backend expects. The UI must be able to render editable inputs for each field and send changes via PATCH.

```json
{
  "general": {
    "reporting_date": 2023,
    "currency": "SAR"
  },
  "rates": {
    "fx_usd_sar": 3.75,
    "fx_gbp_sar": 5.0,
    "fx_eur_sar": 4.0
  },
  "revenue": {
    "growth_yoy_pct": {
      "2024": 0.527,
      "2025": 0.134,
      "2026": 0.060,
      "2027": 0.060,
      "2028": 0.060
    }
  },
  "margins": {
    "gp_margin_sales_pct": {
      "2024": 0.25,
      "2025": 0.25,
      "2026": 0.25,
      "2027": 0.25,
      "2028": 0.25
    }
  },
  "opex": {
    "sm_expenses": {
      "target_sales_pct": { "2024": 0.1806, "2025": 0.1655 },
      "salaries_yoy_growth": 0.03,
      "repairs_maintenance_yoy_growth": 0.05,
      "rent_yoy_growth": 0.05,
      "travel_communication_sales_pct": 0.01,
      "legal_cost_yoy_growth": 0.0,
      "selling_promotion_yoy_growth": 0.0,
      "stationary_yoy_growth": 0.0,
      "insurance_yoy_growth": 0.0,
      "other_yoy_growth": 0.05
    },
    "ga_expenses": {
      "target_yoy_growth_pct": { "2024": -0.1331, "2025": 0.03 },
      "salaries_yoy_growth": 0.03,
      "management_recharge_yoy_growth": 0.03,
      "professional_fees_yoy_growth": 0.03,
      "travel_yoy_growth": 0.03,
      "stationary_yoy_growth": 0.03,
      "impairment_trade_receivables_yoy_growth": 0.0,
      "other_yoy_growth": 0.03
    }
  },
  "working_capital": {
    "trade_receivables_days_sales": 164.06,
    "due_from_related_parties_days_sales": 0.0,
    "inventories_days_cogs": 90,
    "prepayments_days_cogs": 91,
    "trade_payables_days_cogs": -120,
    "accrued_expenses_days_cogs": -180,
    "due_to_related_parties_fixed_amount": -294.69,
    "zakat_payable_fixed": null
  },
  "capex": {
    "capex_pct_of_opening_balance": 0.12
  },
  "depreciation_rates": {
    "vehicles": 0.20,
    "furniture_and_fixtures": 0.10,
    "office_equipment": 0.10,
    "computers": 0.10,
    "leasehold_improvement": 0.05,
    "blended_rate": null
  },
  "other": {
    "zakat_rate": 0.02577,
    "other_income_annual_growth_pct": 0.05,
    "eosb_pct": 0.04167,
    "dividend_payout_ratio": 0.0,
    "statutory_reserve_pct": 0.10,
    "statutory_reserve_cap_pct": 0.50
  },
  "debt": {
    "financing_rate": null,
    "annual_repayment": null,
    "new_borrowings": null
  }
}
```

### Assumption Value Types

Values can be either:
- **Flat rate** (single number applies to all years): `"salaries_yoy_growth": 0.03`
- **Per-year dict** (different value each year): `"growth_yoy_pct": {"2024": 0.527, "2025": 0.134}`

The UI should:
- Render **flat rates** as a single input field with a label
- Render **per-year dicts** as a row of inputs, one per forecast year
- Allow toggling between flat/per-year modes for applicable fields

---

## 4. Data Response Format

### 4.1 Line Item Data

All module results follow the same structure. **Data now includes both historical and forecast years:**

```json
{
  "lineItemKey": {
    "param_name": "Human-readable label",
    "2019": 28000000,
    "2020": 31500000,
    "2021": 35000000,
    "2022": 38000000,
    "2023": 40067175,
    "2024": 61222574.24,
    "2025": 69426278.15,
    "2026": 73591855.04,
    "2027": 78007366.34,
    "2028": 82687808.32
  }
}
```

- Keys like `"revenue"`, `"costOfRevenue"`, `"grossProfit"` are camelCase identifiers
- `"param_name"` is always present — use it as the row label in tables
- Year keys are string digits: `"2019"`, `"2020"`, ..., `"2028"`
- Numeric values: positive = income/asset, negative = expense/liability
- `null` values are possible — render as `—`

### 4.2 Determining Historical vs Forecast Years

The `reporting_date` in assumptions (e.g., `2023`) is the boundary:
- Years <= `reporting_date` are **ACTUAL** (historical)
- Years > `reporting_date` are **FORECAST**

To extract all year keys from a data row:
```javascript
const years = Object.keys(row).filter(k => /^\d{4}$/.test(k)).sort()
const historicalYears = years.filter(y => parseInt(y) <= reportingDate)
const forecastYears = years.filter(y => parseInt(y) > reportingDate)
```

### 4.3 Analytics Data

Some modules include `_analytics` in their persisted Firestore data, but when fetched via the API, analytics come as a separate field in the `ModuleOutput`. The analytics structure varies by module — see Section 6 for details.

Analytics data follows the same year-keyed format:
```json
{
  "salesGrowthYoY": {
    "param_name": "Sales annual growth %",
    "2020": 0.125,
    "2021": 0.111,
    "2024": 0.527,
    "2025": 0.134
  }
}
```

---

## 5. UI Architecture

### 5.1 Page Structure

```
/dashboard/{client_id}
  ├── Assumptions Panel (sidebar or modal)
  ├── Tab: Income Statement (IS-CON)
  ├── Tab: Balance Sheet (BS)
  ├── Tab: Cash Flow Statement (CF)
  ├── Tab: S&M Detail
  ├── Tab: G&A Detail
  ├── Tab: Fixed Assets
  ├── Tab: Working Capital
  ├── Tab: Debt
  ├── Tab: Equity
  └── Tab: EOSP
```

### 5.2 Financial Table Component

Every tab renders a **financial data table** with both historical and forecast columns:

| | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | 2027 | 2028 |
|---|---|---|---|---|---|---|---|---|---|---|
| | ACTUAL | ACTUAL | ACTUAL | ACTUAL | ACTUAL | FORECAST | FORECAST | FORECAST | FORECAST | FORECAST |
| Revenue | 28,000,000 | 31,500,000 | 35,000,000 | 38,000,000 | 40,067,175 | 61,222,574 | 69,426,278 | 73,591,855 | 78,007,366 | 82,687,808 |
| Cost of revenue | (21,000,000) | ... | ... | ... | ... | (45,916,931) | ... | ... | ... | (62,015,856) |
| **Gross profit** | **7,000,000** | ... | ... | ... | ... | **15,305,644** | ... | ... | ... | **20,671,952** |

**Rendering Rules:**
- Numbers formatted with thousand separators
- Negative numbers in parentheses: `(45,916,931)` not `-45916931`
- Bold totals/subtotals (rows with "total" or "profit" or "EBITDA" in param_name)
- Currency from assumptions `general.currency` (default SAR)
- `null` values render as `—`
- **Visual distinction between ACTUAL and FORECAST columns** — use different background color, a vertical separator line, or column header labels
- Historical columns should have a slightly muted/grey background
- Forecast columns should have the standard/white background

### 5.3 Assumptions Editor

Group assumptions into collapsible sections matching the JSON structure:
1. **General** — Reporting date, currency
2. **Rates** — FX rates
3. **Revenue** — YoY growth rates (per-year inputs)
4. **Margins** — GP margin (per-year inputs)
5. **S&M Expenses** — Mix of flat rates and per-year
6. **G&A Expenses** — Mix of flat rates and per-year
7. **Working Capital** — Days metrics
8. **CapEx & Depreciation** — Rates
9. **Other** — Zakat, EOSB, dividends, statutory reserve
10. **Debt** — Financing rate, repayments, new borrowings

**On change:** Debounce 500ms, then PATCH the changed section to `/engine/assumptions/{client_id}`. On response, refetch all module results and update tables.

### 5.4 Default Assumptions Workflow (NEW)

When a client has no assumptions yet:

```
1. Show "No assumptions found" state
2. Offer "Generate Default Assumptions" button
3. On click: POST /engine/generate-defaults/{client_id}?save=false
4. Show generated assumptions in the editor for review
5. User can adjust values
6. User clicks "Save & Calculate"
7. POST /engine/assumptions/{client_id} with the final values
8. POST /engine/recalculate/{client_id}
9. Fetch and display all results
```

### 5.5 Recalculation Flow

```
User edits assumption input
  → debounce 500ms
  → PATCH /engine/assumptions/{client_id} with delta
  → show loading spinner on affected tables
  → on success: GET /engine/results/{client_id} to refresh all data
  → update all tables (historical columns don't change, forecast columns update)
```

For initial load or manual full refresh:
```
POST /engine/recalculate/{client_id}
  → on success: GET /engine/results/{client_id}
```

---

## 6. Module Display Specifications

### 6.1 Income Statement (IS-CON)
Fetch: `GET /engine/results/{client_id}/IS-CON`

**Data table** — display order:
1. Revenue
2. Cost of revenue
3. **Gross profit** (bold)
4. Selling and marketing expenses
5. General and administrative expenses
6. Total expenses
7. **Operating profit** (bold)
8. Share of income from equity accounted investment
9. Fair value loss on investments
10. Other income/(loss)
11. **EBITDA** (bold)
12. Depreciation and amortization
13. Finance costs
14. Zakat
15. **Net income/(loss)** (bold, highlighted)

**Analytics section** — render below the main table as a "Key Indicators" panel:
| Analytics Key | Display Name | Format |
|---|---|---|
| `salesGrowthYoY` | Sales annual growth | % |
| `smGrowthYoY` | S&M annual growth | % |
| `gaGrowthYoY` | G&A annual growth | % |
| `smPctOfRevenue` | S&M as % of revenue | % |
| `gaPctOfRevenue` | G&A as % of revenue | % |
| `grossProfitMargin` | Gross profit margin | % |
| `operatingProfitMargin` | Operating profit margin | % |
| `EBITDAMargin` | EBITDA margin | % |
| `netIncomeMargin` | Net income margin | % |

All analytics include both historical and forecast year values.

### 6.2 Balance Sheet (BS)
Fetch: `GET /engine/results/{client_id}/BS`

**Data table** — grouped sections:
- **Current Assets:** Cash, Trade Receivables, Due from RP, Inventories, Prepayments → Total Current Assets
- **Non-Current Assets:** Property and Equipment → Total Non-Current Assets
- **Total Assets** (bold)
- **Current Liabilities:** Trade Payables, Accrued Expenses, Due to RP, Zakat Payable, Short-term Borrowings → Total Current Liabilities
- **Non-Current Liabilities:** Long-term Borrowings, Employee Termination Benefits → Total Non-Current Liabilities
- **Total Liabilities** (bold)
- **Equity:** Share Capital, Statutory Reserve, Retained Earnings → Total Shareholders' Equity
- **Total Liabilities & Equity** (bold, highlighted)
- **Balance Check** — should be 0.00 for all years. Show as green checkmark if 0, red warning if non-zero.

**Analytics section:**
| Analytics Key | Display Name | Format |
|---|---|---|
| `currentRatio` | Current Ratio | x (ratio) |
| `leverageRatio` | Leverage Ratio (Assets / Equity) | x (ratio) |
| `roa` | Return on Assets (ROA) | % |
| `roe` | Return on Equity (ROE) | % |

### 6.3 Cash Flow Statement (CF)
Fetch: `GET /engine/results/{client_id}/CF`

**Data table** — grouped sections:
- **Operating Activities:** Net Income, D&A, Change in WC, Change in EOSB → **CFO** (bold)
- **Investing Activities:** Capital Expenditure → **CFI** (bold)
- **Financing Activities:** Net Debt Movement, Dividends Paid → **CFF** (bold)
- **Net Change in Cash** (bold)
- Opening Cash Balance
- **Closing Cash Balance** (bold, highlighted)

**Analytics section:**
| Analytics Key | Display Name | Format |
|---|---|---|
| `freeCashFlow` | Free Cash Flow (FCF) | Currency |

### 6.4 S&M Detail
Fetch: `GET /engine/results/{client_id}/S&M`

**Data table** — all S&M line items:
1. Salaries, Wages and Benefits
2. Repairs and Maintenance
3. Rent
4. Travel and Communication
5. Legal Cost
6. Selling and Promotion
7. Stationary
8. Insurance
9. Other
10. **Total Selling & Marketing Expenses** (bold)

**Analytics section** — render as 5 sub-panels below the data table:

**Panel 1: Key Indicators**
| Key | Display |
|---|---|
| `smPctOfRevenue` | S&M as % of Revenue |
| `smAnnualGrowth` | S&M Annual Growth |

**Panel 2: % of Revenue** (per-item breakdown)
Render `analytics.pctOfRevenue` — each line item as a row, showing what % of revenue it represents per year.

**Panel 3: Annual Growth** (per-item breakdown)
Render `analytics.annualGrowth` — each line item's YoY growth rate per year.

**Panel 4: Common Size** (per-item breakdown)
Render `analytics.commonSize` — each line item as a % of Total S&M per year.

Each panel is a table with the same year columns as the main data table (historical + forecast).

### 6.5 G&A Detail
Fetch: `GET /engine/results/{client_id}/G&A`

Same structure as S&M:

**Data table** — all G&A line items:
1. Salaries, Wages and Benefits
2. Management Recharge
3. Professional Fees
4. Travel
5. Stationary
6. Impairment on Trade Receivables
7. Other
8. **Total General & Administrative Expenses** (bold)

**Analytics section** — 5 sub-panels (same as S&M):
1. Key Indicators (`gaPctOfRevenue`, `gaAnnualGrowth`)
2. % of Revenue (`pctOfRevenue`)
3. Annual Growth (`annualGrowth`)
4. Common Size (`commonSize`)

### 6.6 Fixed Assets
Fetch: `GET /engine/results/{client_id}/FA`

**Data table:**
1. Opening Balance - NBV
2. Additions (CapEx)
3. Depreciation
4. Closing Balance - NBV

No analytics section.

### 6.7 Working Capital
Fetch: `GET /engine/results/{client_id}/WC`

**Data table:**
1. Trade Receivables
2. Due from Related Parties
3. Inventories
4. Prepayments
5. Trade Payables
6. Accrued Expenses
7. Due to Related Parties
8. Zakat Payable
9. **Operating Working Capital** (bold)
10. **Change in Working Capital** (bold)

**Analytics section — Key Indicators (Days):**
| Analytics Key | Display Name | Unit |
|---|---|---|
| `tradeReceivablesDays` | Trade Receivables | Days Sales |
| `dueFromRelatedPartiesDays` | Due from Related Parties | Days Sales |
| `inventoriesDays` | Inventories | Days COGS |
| `prepaymentsDays` | Prepayments | Days COGS |
| `tradePayablesDays` | Trade Payables | Days COGS |
| `accruedExpensesDays` | Accrued Expenses | Days COGS |

### 6.8 Debt
Fetch: `GET /engine/results/{client_id}/DEBT`

**Data table:**
1. Opening Balance
2. Loan Proceeds
3. Repayments
4. Closing Balance
5. Finance Costs
6. Current Portion (Short-term)
7. Non-Current Portion (Long-term)

**Analytics section:**
| Analytics Key | Display Name | Format |
|---|---|---|
| `financingRate` | Financing Rate | % |

### 6.9 Equity
Fetch: `GET /engine/results/{client_id}/equity`

**Data table:**
1. Share Capital
2. Statutory Reserve
3. Transfer to Statutory Reserve
4. Retained Earnings
5. Dividends
6. Partners Current Accounts
7. **Total Shareholders' Equity** (bold)

**Analytics section:**
| Analytics Key | Display Name | Format |
|---|---|---|
| `dividendPayoutRatio` | Dividend Payout Ratio | % |

### 6.10 EOSP
Fetch: `GET /engine/results/{client_id}/eosp`

**Data table:**
1. Total Salaries
2. EOSI
3. Employee Termination Benefits

No analytics section.

---

## 7. Error Handling

| HTTP Code | Meaning | UI Action |
|---|---|---|
| 200 | Success | Update data |
| 404 | No data/assumptions found | Show "No data" state with setup prompt |
| 422 | Invalid assumptions | Show validation errors inline on the form fields |
| 500 | Server error | Toast notification with retry button |

### Special Cases
- **No assumptions (404 on GET assumptions):** Show the "Generate Default Assumptions" workflow (Section 5.4)
- **No historical data (404 on GET historical):** Show "Upload PDF first" state
- **Balance check non-zero:** Show warning banner on BS tab

---

## 8. Client ID

The `client_id` is a string identifier (e.g., `"pwc-test-123456"`). It comes from the user session after login. Store it in app state and use it for all API calls.

```
GET /users/login/{email}/{password}
Response: { "client_id": "...", "username": "...", ... }
```

---

## 9. Tech Preferences

- Use whatever framework you determine is best (React, Vue, Svelte — your call)
- State management for assumptions and results
- Responsive layout
- Dark/light theme toggle is a nice-to-have
- No need for authentication middleware — just pass client_id from login

---

## 10. Critical Integration Rules

1. **Never compute financial logic on the frontend.** All math happens in the engine. The UI is display + input only.
2. **Always use `param_name` as the display label.** Never derive labels from the JSON keys.
3. **Preserve the sign convention.** Expenses and liabilities are negative in the data. Display with parentheses.
4. **PATCH is the primary mutation endpoint.** Full POST is for initial setup only.
5. **The years are dynamic.** Don't hardcode 2019-2028. Read year keys from the response data. Different clients may have different historical year ranges.
6. **Distinguish ACTUAL from FORECAST.** Use `general.reporting_date` as the boundary. Style historical and forecast columns differently.
7. **Debounce assumption changes.** Don't fire a PATCH on every keystroke.
8. **After PATCH completes, refetch all results.** The cascade may change values in unrelated modules.
9. **Render analytics below data tables.** Each module has specific analytics — see Section 6 for which analytics each module produces.
10. **S&M and G&A have per-item analytics.** These need nested tables: `pctOfRevenue`, `annualGrowth`, and `commonSize` each contain sub-objects keyed by line item name.
11. **Balance Check is a data row, not just analytics.** It appears in the BS data. Show it inline with appropriate visual indicator (green/red).
12. **Use the generate-defaults endpoint** for new clients without assumptions. Don't force the user to manually enter all values from scratch.
