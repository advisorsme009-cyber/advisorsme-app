# Prompt — Wire the AdvisorsME UI Client to the new Valuation Sheets (BV, Comps, VM)

> Paste this whole document into a Claude Code session running inside the **AdvisorsME UI client repo** (the React/Next frontend). The engine repo is a separate API on `http://127.0.0.1:8000` (or wherever the user runs it — read `NEXT_PUBLIC_API_BASE` / `VITE_API_BASE` env). All shapes, endpoints, and layout intent below are pulled from the real running engine (US-1 reference client) on 2026-05-26.

---

## 1. Mission

The engine recently replaced its single `valuation` module with **three first-class modules** — `BV`, `Comps`, `VM`. The UI currently has no view for any of them (or has a stale single-tab view bound to the deleted `/engine/results/{id}/valuation` endpoint, which now 404s).

Build three new module views — Business Valuation, Comparable Companies, Valuation Methodology — that:

1. Fetch from the engine's three new endpoints.
2. Render layouts that **mirror the human Excel workbook `NSC Financial Model MI.xlsx`** so a CFO can place the UI and the Excel side-by-side and see the same numbers in the same positions.
3. Expose the underlying assumptions for inline editing (discount rate, terminal growth, comps industries / multiples / liquidity discounts, VM weights), with a "Recalculate" action that calls the engine.
4. Plug into the existing module-sidebar / tab navigation alongside `IS-CON`, `BS`, `CF`, `S&M`, `G&A`, `WC`, `FA`, `DEBT`, `equity`, `eosp`.
5. **Delete or hard-redirect** any old `valuation` view — the legacy module is gone and its endpoint returns 404.

This is **read-mostly** for the data tables and **lightweight CRUD** for the assumption forms. Do not invent new analytics; render exactly what the engine emits.

---

## 2. Engine endpoints you will consume

Base URL: configurable via env (default `http://127.0.0.1:8000`).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/engine/results/{client_id}` | Index — confirms `lv3` contains `BV`, `Comps`, `VM` |
| `GET` | `/engine/results/{client_id}/BV` | Business Valuation data (DCF + sensitivity + multiples) |
| `GET` | `/engine/results/{client_id}/Comps` | Comparable Companies data (4 scenario blocks + industry averages) |
| `GET` | `/engine/results/{client_id}/VM` | Valuation Methodology data (football field + weighted summary) |
| `GET` | `/engine/assumptions/{client_id}` | Full assumptions blob — `valuation.bv`, `valuation.comps`, `valuation.vm` live under the `valuation` key |
| `POST` | `/engine/assumptions/{client_id}` | Replace assumptions (whole object body) |
| `POST` | `/engine/recalculate/{client_id}` | Re-run the cascade with stored assumptions (no overwrite) — call after editing assumptions |
| `POST` | `/engine/auto-setup/{client_id}` | One-click: generate defaults + recalculate. **Never call this for clients `pwc-test-123456` or `ESCO-1`** (hand-tuned). Show an Auto-Setup button only on whitelisted clients. |
| `GET` | `/engine/export/{client_id}` | Excel export — includes `Business Valuation`, `Comparable Companies`, `Valuation Methodology` sheets |

All responses are `application/json`. Module endpoints return the shape `{ "client_id": "...", "module": "BV", "data": { ... } }` — bind the table to `data`.

Module names are **case-sensitive in the URL path**: `/BV`, `/Comps`, `/VM` (the route also accepts lowercase as a fallback for these three, but standardize on the canonical case).

---

## 3. Shared shape conventions

Every module's `data` object is a flat dict whose keys fall into three categories:

| Key prefix / shape | Meaning |
|---|---|
| `"_sectionXxx"` | Section divider. Value is `{ "is_header": true, "param_name": "<HEADER LABEL>" }`. **Render as a bold full-width row** with no per-year values — never as a data row. |
| `"<camelCaseKey>"` with `{ "param_name": "Row Label", "2025": 1.0, "2026": ..., ... }` | A per-year row. Year keys are 4-digit strings. `param_name` is the row label. Some rows are intentionally sparse (e.g. `discountRate` only carries the valuation-year column). |
| Special nested shapes | `sensitivity` (BV), the four `globalFy1/globalFy2/emergingFy1/emergingFy2` blocks (Comps), and the `*Range` / `weighted*` / `fairValueEstimate` keys (VM) need custom renderers — see §4–§6. |

**Key order matters.** The engine returns keys in the exact display order expected by the Excel. Use `Object.entries()` / `Object.keys()` directly — do not alphabetize. If you must transform, preserve order.

**Sign convention:** Values are already in the correct sign for display. `netDebt` in Comps is intentionally negative (subtractive). Do not re-sign.

---

## 4. View: Business Valuation (`/BV`)

### Sample payload (real, from US-1)

```json
{
  "_sectionDCF":          { "is_header": true, "param_name": "DCF VALUATION" },
  "freeCashFlow":         { "param_name": "Free Cash flows (FCF)", "2026": 6401187.20, "2027": 5351786.94, "2028": 7041498.67, "2029": 8468481.89, "2030": 9686132.11 },
  "presentValueFactor":   { "param_name": "Present value factor", "2025": 1.0, "2026": 0.892857, "2027": 0.797194, "2028": 0.711780, "2029": 0.635518, "2030": 0.567427 },
  "presentValueFcf":      { "param_name": "Present value of FCF", "2025": 0.0, "2026": 5715345.71, "2027": 4266411.78, "2028": 5011999.67, "2029": 5381873.34, "2030": 5496171.49 },

  "_sectionAssumptions":  { "is_header": true, "param_name": "DCF ASSUMPTIONS" },
  "discountRate":         { "param_name": "Discount Rate",        "2025": 0.12 },
  "growthRate":           { "param_name": "Terminal Growth rate", "2025": 0.02 },

  "_sectionTerminal":     { "is_header": true, "param_name": "TERMINAL VALUE" },
  "fcfNextPeriod":        { "param_name": "FCF (t+1)",                       "2025": 9879854.75 },
  "terminalValue":        { "param_name": "Terminal value",                  "2025": 98798547.52 },
  "terminalPvFactor":     { "param_name": "Present value factor",            "2025": 0.567427 },
  "presentValueTerminal": { "param_name": "Present Value of Terminal FCFF",  "2025": 56060949.17 },

  "_sectionSummary":      { "is_header": true, "param_name": "FAIR MARKET VALUE OF 100% EQUITY" },
  "sumPvFcf":             { "param_name": "Sum of PV of FCFF",     "2030": 25900000 },
  "pvTerminalRounded":    { "param_name": "PV of Terminal FCFF",   "2030": 56100000 },
  "equityValue":          { "param_name": "Valuation",             "2030": 82000000 },

  "_sectionSensitivity":  { "is_header": true, "param_name": "SENSITIVITY ANALYSIS" },
  "sensitivity": {
    "param_name": "Equity Value @ (disc, growth)",
    "discount_rates": [0.10, 0.12, 0.14],
    "growth_rates":   [0.015, 0.02, 0.025],
    "matrix": {
      "0.1":  { "0.015":  99100000, "0.02": 104000000, "0.025": 109500000 },
      "0.12": { "0.015":  79000000, "0.02":  82000000, "0.025":  85200000 },
      "0.14": { "0.015":  65300000, "0.02":  67300000, "0.025":  69300000 }
    }
  },

  "_sectionMultiples":    { "is_header": true, "param_name": "Valuation Multiples" },
  "evEbitda":             { "param_name": "EV/EBITDA", "2022": 19.96, "2023": 13.42, "2024": 14.35, "2025": 52.00, "2026": 11.96, "2027": 8.50, "2028": 6.85, "2029": 5.88, "2030": 5.24 },
  "peRatio":              { "param_name": "P/E",       "2022": -46.79, "2023": 81.15, "2024": 528.92, "2025": 76.05, "2026": 20.44, "2027": 13.36, "2028": 10.36, "2029": 8.70, "2030": 7.65 },
  "evSales":              { "param_name": "EV/Sales",  "2022": 1.32, "2023": 1.51, "2024": 1.66, "2025": 1.92, "2026": 1.86, "2027": 1.81, "2028": 1.76, "2029": 1.71, "2030": 1.66 }
}
```

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Business Valuation — <client name>                  [Edit assumptions] │
├─────────────────────────────────────────────────────────────────────────┤
│  DCF VALUATION                                                          │
│  ────────────────────────────────────────────────────────────────────   │
│  Parameter            │ 2025  │ 2026   │ 2027   │ 2028   │ 2029  │ 2030│
│  Free Cash flows      │       │ 6.40M  │ 5.35M  │ 7.04M  │ 8.47M │ 9.69M
│  Present value factor │ 1.000 │ 0.8929 │ 0.7972 │ 0.7118 │ 0.6355│ 0.5674
│  Present value of FCF │ 0     │ 5.72M  │ 4.27M  │ 5.01M  │ 5.38M │ 5.50M
│                                                                         │
│  DCF ASSUMPTIONS                                                        │
│  Discount Rate            12.00%                                        │
│  Terminal Growth rate      2.00%                                        │
│                                                                         │
│  TERMINAL VALUE                                                         │
│  FCF (t+1)                                  9,879,855                   │
│  Terminal value                            98,798,548                   │
│  Present value factor                          0.5674                   │
│  Present Value of Terminal FCFF            56,060,949                   │
│                                                                         │
│  FAIR MARKET VALUE OF 100% EQUITY                                       │
│  Sum of PV of FCFF                         25,900,000                   │
│  PV of Terminal FCFF                       56,100,000                   │
│  Valuation                                 82,000,000  ← bold, big      │
│                                                                         │
│  SENSITIVITY ANALYSIS                                                   │
│  ┌─────────────┬──────────┬──────────┬──────────┐                       │
│  │             │ g=1.5%   │ g=2.0%   │ g=2.5%   │                       │
│  ├─────────────┼──────────┼──────────┼──────────┤                       │
│  │ dr = 10.0%  │ 99.1M    │ 104.0M   │ 109.5M   │                       │
│  │ dr = 12.0%* │ 79.0M    │ 82.0M*   │ 85.2M    │  ← center cell        │
│  │ dr = 14.0%  │ 65.3M    │ 67.3M    │ 69.3M    │     bold + highlight  │
│  └─────────────┴──────────┴──────────┴──────────┘                       │
│  * = base assumption                                                    │
│                                                                         │
│  Valuation Multiples (historical + forecast)                            │
│  Multiple │ 2022  │ 2023 │ 2024  │ 2025  │ 2026 │ ... │ 2030            │
│  EV/EBITDA│ 19.96x│ 13.42x│ 14.35x│ 52.00x│ 11.96x│ ... │ 5.24x         │
│  P/E      │ -46.79x│ 81.15x│ 528.9x│ 76.05x│ 20.44x│ ... │ 7.65x        │
│  EV/Sales │ 1.32x │ 1.51x│ 1.66x │ 1.92x │ 1.86x│ ... │ 1.66x           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Formatting rules

- Monetary values: `#,##0` (thousands separator, no decimals). Optional toggle to display in millions (`÷ 1e6` with `M` suffix).
- Rates (`discountRate`, `growthRate`, sensitivity axes): `0.00%`.
- PV factors (`presentValueFactor`, `terminalPvFactor`): `0.0000` (4 decimals).
- Multiples (`evEbitda`, `peRatio`, `evSales`): `0.00x` or `0.0000` — these are ratios, not currency.
- Historical year columns get a **green** header tint; forecast year columns get **orange** (match the existing IS-CON / BS / CF table convention).
- `equityValue` row in the summary block: bold, ≥18pt font.
- Sensitivity matrix center cell (row = base discount rate, col = base growth rate): bold + highlight. It will exactly equal `equityValue[lastForecastYear]` — surface that equality as a tooltip ("base-case scenario").

### Edge cases

- `freeCashFlow` and `presentValueFcf` are intentionally **empty / zero in the valuation-year column** (2025 in the sample). Render blank, not `0`, to avoid visual noise. `presentValueFactor` at the valuation year is exactly `1.0` — render normally.
- The `_sectionSummary` block (`sumPvFcf`, `pvTerminalRounded`, `equityValue`) carries **only the last forecast year** key. Show it as a single-value summary box, not a wide table row.
- `peRatio` can be negative if `netIncomeLoss` is negative in early historical years. Don't try to hide it.

---

## 5. View: Comparable Companies (`/Comps`)

### Sample payload (abridged, from US-1)

```json
{
  "_sectionGlobalFy1": { "is_header": true, "param_name": "Global Markets — EBITDA Multiple FY+1" },
  "globalFy1": {
    "param_name": "Global FY+1",
    "ebitda":          { "label": "EBITDA",                "year": "2026", "value": 6854619.34 },
    "multiple":        { "label": "EV/EBITDA multiple",    "year": "2026", "value": 9.1 },
    "evEstimateGross": { "label": "Enterprise value est.", "year": "2026", "value": 62377035.99 },
    "pvFactor":        { "label": "Present value factor",  "year": "2026", "value": 0.892857 },
    "evEstimate":      { "label": "Enterprise value (PV)", "year": "2026", "value": 55693773.23 },
    "netDebt":         { "label": "Less: Net debt",        "year": "2026", "value": -12867783.00 },
    "equityEstimate":  { "label": "Equity value est.",     "year": "2026", "value": 42825990.23 }
  },
  "_sectionGlobalFy2":  { "is_header": true, "param_name": "Global Markets — EBITDA Multiple FY+2" },
  "globalFy2":          { /* same shape, year=2027, multiple=9.1, equityEstimate=57,097,143 */ },
  "_sectionEmergingFy1":{ "is_header": true, "param_name": "Emerging Markets — EBITDA Multiple FY+1" },
  "emergingFy1":        { /* same shape, year=2026, multiple=10.3, equityEstimate=50,170,000 */ },
  "_sectionEmergingFy2":{ "is_header": true, "param_name": "Emerging Markets — EBITDA Multiple FY+2" },
  "emergingFy2":        { /* same shape, year=2027, multiple=10.3 */ },

  "globalAverage":             { "param_name": "EBITDA multiple (average) — Global",   "value": 13.0 },
  "emergingAverage":           { "param_name": "EBITDA multiple (average) — Emerging", "value": 12.9 },
  "liquidityDiscountGlobal":   { "param_name": "Discount for lack of liquidity — Global",   "value": 0.30 },
  "liquidityDiscountEmerging": { "param_name": "Discount for lack of liquidity — Emerging", "value": 0.20 },
  "appliedMultipleGlobal":     { "param_name": "EBITDA multiple applied — Global",     "value": 9.1 },
  "appliedMultipleEmerging":   { "param_name": "EBITDA multiple applied — Emerging",   "value": 10.3 },

  "industry_chemical_specialty":         { "param_name": "Chemical (Specialty)",        "global": 12.5, "emerging": 11.3 },
  "industry_electrical_equipment":       { "param_name": "Electrical Equipment",        "global": 15.5, "emerging": 16.8 },
  "industry_healthcare_support_services":{ "param_name": "Healthcare Support Services", "global": 11.1, "emerging": 10.6 },

  "sourceNote": { "param_name": "Source: Damodaran (Jan 2024 data)" }
}
```

### Layout — 2×2 scenario grid + averages table + source note

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Comparable Companies — <client name>             [Edit assumptions]    │
├──────────────────────────────────┬──────────────────────────────────────┤
│  Global Markets — EBITDA FY+1    │  Emerging Markets — EBITDA FY+1      │
│  ──────────────────────────────  │  ──────────────────────────────────  │
│  EBITDA                  2026    │  EBITDA                    2026      │
│  ...                             │  ...                                 │
│  Equity value est.    42.83M ◀   │  Equity value est.      50.17M ◀     │
│         (bold)                   │         (bold)                       │
├──────────────────────────────────┼──────────────────────────────────────┤
│  Global Markets — EBITDA FY+2    │  Emerging Markets — EBITDA FY+2      │
│  ──────────────────────────────  │  ──────────────────────────────────  │
│  ...                             │  ...                                 │
│  Equity value est.    57.10M ◀   │  Equity value est.      66.32M ◀     │
└──────────────────────────────────┴──────────────────────────────────────┘

EBITDA MULTIPLES — INDUSTRY AVERAGES
┌──────────────────────────────┬────────┬──────────────────────────────┬────────┐
│ Industry                     │ Global │ Industry                     │ Emerg. │
├──────────────────────────────┼────────┼──────────────────────────────┼────────┤
│ Chemical (Specialty)         │  12.5  │ Chemical (Specialty)         │  11.3  │
│ Electrical Equipment         │  15.5  │ Electrical Equipment         │  16.8  │
│ Healthcare Support Services  │  11.1  │ Healthcare Support Services  │  10.6  │
│ EBITDA multiple (average)    │  13.0  │ EBITDA multiple (average)    │  12.9  │
│ Discount for lack of liquid. │ 30.0%  │ Discount for lack of liquid. │ 20.0%  │
│ EBITDA multiple applied      │   9.1  │ EBITDA multiple applied      │  10.3  │
└──────────────────────────────┴────────┴──────────────────────────────┴────────┘

Source: Damodaran (Jan 2024 data)   ← italic, small, bottom of view
```

### Per-block row order (do not reorder)

`ebitda → multiple → evEstimateGross → pvFactor → evEstimate → netDebt → equityEstimate`. Bold the `equityEstimate` row. Show the per-row `year` next to the label or in a year-column header.

### Formatting rules

- All monetary cells: `#,##0` (or M-toggle to taste).
- `multiple`, `appliedMultipleX`, `globalAverage`, `emergingAverage`, industry rows: `0.0` (1 decimal).
- `pvFactor`: `0.0000`.
- `liquidityDiscountX`: `0.0%`.
- `netDebt` is **negative** by construction — render with minus sign, do not absolute-value.
- `industry_<slug>` rows are dynamic; iterate over every key starting with `industry_`.

### Cross-check the user can rely on

For each block, `evEstimate ≈ evEstimateGross * pvFactor` and `equityEstimate ≈ evEstimate + netDebt` (within 1 SAR). And `appliedMultipleX = round(average * (1 - liquidityDiscountX), 1)`. Surface a tiny ✓ next to the equity-estimate row to indicate the computation reconciles — purely a UX confidence signal.

---

## 6. View: Valuation Methodology (`/VM`)

### Sample payload (full, from US-1 — note: values are in **SAR Millions**)

```json
{
  "_sectionFootball": { "is_header": true, "param_name": "VALUATION RANGES (SAR Millions)" },
  "dcfRange":               { "param_name": "DCF (Sum-of-the-parts)",    "lower": 69.30, "lowerLabel": "Lower Bound",     "upper": 99.10, "upperLabel": "Upper Bound",     "comment": "10.0%–14.0% | g=2.0%" },
  "ebitdaMultipleFy1Range": { "param_name": "EBITDA multiple (FY+1)",    "lower": 42.83, "lowerLabel": "Global Markets",  "upper": 50.17, "upperLabel": "Emerging Markets","comment": "EBITDA | 2026" },
  "ebitdaMultipleFy2Range": { "param_name": "EBITDA multiple (FY+2)",    "lower": 57.10, "lowerLabel": "Global Markets",  "upper": 66.32, "upperLabel": "Emerging Markets","comment": "EBITDA | 2027" },
  "revenueMultipleRange":   { "param_name": "Revenue multiple",          "lower": 21.35, "lowerLabel": "0.5x",            "upper": 42.70, "upperLabel": "1.0x",            "comment": "Revenue | 2025" },
  "bookValueRange":         { "param_name": "Book value (net assets)",   "lower": 30.70, "lowerLabel": "Book Value",      "upper": 30.70, "upperLabel": "Book Value",      "comment": "Net assets value (equity) | 2025" },

  "_sectionWeighted": { "is_header": true, "param_name": "WEIGHTED AVERAGE FAIR VALUE (SAR Millions)" },
  "weightedDcf":         { "param_name": "DCF",                   "value": 82.00, "weight": 0.60, "contribution": 49.20 },
  "weightedEbitdaFy1":   { "param_name": "EBITDA multiple FY+1",  "value": 46.50, "weight": 0.15, "contribution":  6.97 },
  "weightedEbitdaFy2":   { "param_name": "EBITDA multiple FY+2",  "value": 61.71, "weight": 0.15, "contribution":  9.26 },
  "weightedBookValue":   { "param_name": "Book value",            "value": 30.70, "weight": 0.10, "contribution":  3.07 },
  "fairValueEstimate":   { "param_name": "Overall fair value estimate", "value": 68.50, "weight_total": 1.0 }
}
```

### Layout — football field + weighted summary box

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Valuation Methodology — <client name>             [Edit assumptions]    │
├──────────────────────────────────────────────────────────────────────────┤
│  VALUATION RANGES (SAR Millions) — Football Field                        │
│                                                                          │
│   DCF (Sum-of-the-parts)        ├──────────────────────┤   69.3 — 99.1   │
│   EBITDA multiple (FY+1)            ├─────────┤            42.8 — 50.2   │
│   EBITDA multiple (FY+2)                  ├─────────┤      57.1 — 66.3   │
│   Revenue multiple              ├────────────────────────┤  21.4 — 42.7  │
│   Book value (net assets)              │ 30.7 (point)                    │
│                                  0      30      60      90      120 SAR M │
│                                                                          │
│   (bar chart — horizontal floating bars per method, labelled with        │
│   lower/upper values and lower/upper labels; comment as tooltip)         │
├──────────────────────────────────────────────────────────────────────────┤
│  WEIGHTED AVERAGE FAIR VALUE (SAR Millions)                              │
│  ┌────────────────────────────┬──────────┬─────────┬──────────────────┐  │
│  │ Method                     │  SAR MM  │ Weight  │  Contribution    │  │
│  ├────────────────────────────┼──────────┼─────────┼──────────────────┤  │
│  │ DCF                        │   82.00  │  60.0%  │     49.20        │  │
│  │ EBITDA multiple FY+1       │   46.50  │  15.0%  │      6.97        │  │
│  │ EBITDA multiple FY+2       │   61.71  │  15.0%  │      9.26        │  │
│  │ Book value                 │   30.70  │  10.0%  │      3.07        │  │
│  ├────────────────────────────┼──────────┼─────────┼──────────────────┤  │
│  │ OVERALL FAIR VALUE ESTIMATE│          │ 100.0%  │   68.50  ★       │  │
│  └────────────────────────────┴──────────┴─────────┴──────────────────┘  │
│  ★ Final estimate is FLOOR(Σ contributions / 0.5) × 0.5 (Excel parity).  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Formatting rules

- All numeric values in this view are **already in SAR Millions** — do not divide again. Display with 1–2 decimals (`0.0` or `0.00`) and a "SAR MM" suffix where space allows.
- Weight column: `0.0%` (1 decimal).
- Final `fairValueEstimate.value` is bolded, ≥20pt, with a thick top border above its row. Place a `weight_total: 1.0` indicator next to it.
- Revenue-multiple range is **shown but unweighted** by default — that matches the Excel and is intentional. Render its row in the football field but NOT in the weighted-summary table. Optionally add a "ⓘ Not included in weighted average" caption.
- `bookValueRange.lower === bookValueRange.upper` — render as a single point on the bar chart (small diamond), not a bar.

### Football-field chart implementation hint

- Compute axis max as `ceil(max(all upper values) / 10) * 10` for a clean SAR-MM gridline.
- Use a horizontal-bar chart library (Recharts / Chart.js / Tremor — match what the rest of the UI already uses). Each method = one bar with `xStart=lower`, `xEnd=upper`. Show the method name on the y-axis and the lower–upper text to the right of each bar.
- Highlight the `fairValueEstimate.value` as a vertical reference line across the whole chart in a distinct accent color — this is the single most important number on the page.

---

## 7. Assumption editing (all three modules)

Single side-panel / modal that GETs and PATCHes the whole `assumptions` blob, but exposes only the `valuation.*` keys:

### Real `valuation` payload (from US-1 — use as the canonical shape)

```json
{
  "bv": {
    "discount_rate": 0.12,
    "terminal_growth_rate": 0.02,
    "sensitivity_discount_step": 0.02,
    "sensitivity_growth_step": 0.005,
    "rounding_unit": 100000
  },
  "comps": {
    "industries": [
      { "name": "Chemical (Specialty)",        "global_multiple": 12.5, "emerging_multiple": 11.3 },
      { "name": "Electrical Equipment",        "global_multiple": 15.5, "emerging_multiple": 16.8 },
      { "name": "Healthcare Support Services", "global_multiple": 11.1, "emerging_multiple": 10.6 }
    ],
    "liquidity_discount_global":   0.30,
    "liquidity_discount_emerging": 0.20,
    "forward_years_offset": [1, 2],
    "source_note": "Source: Damodaran (Jan 2024 data)"
  },
  "vm": {
    "weights": { "dcf": 0.60, "ebitda_fy1": 0.15, "ebitda_fy2": 0.15, "book_value": 0.10 },
    "revenue_multiple_low":  0.5,
    "revenue_multiple_high": 1.0,
    "rounding_floor": 0.5
  }
}
```

### Form sections

**BV** — number inputs for `discount_rate` (display as %, store as decimal), `terminal_growth_rate` (%), sensitivity steps (both %), rounding unit. Inline validation: `0 < discount_rate < 0.50`, `0 ≤ terminal_growth_rate < discount_rate` (otherwise terminal value diverges — block submit and explain why).

**Comps** — repeating row editor for `industries` (name + 2 numeric multiples, add/remove rows, min 1 row). Two number inputs for liquidity discounts (%). Optional advanced field for `forward_years_offset` (array of small ints, default `[1, 2]`).

**VM** — four number inputs for weights. **Sum-of-weights must equal `1.0 ± 1e-6`** — show a live "Sum: 1.00 ✓" / "Sum: 0.95 ✗" indicator and block submit on mismatch. Server-side `model_validator` will also reject; surface that 422 response cleanly. Plus `revenue_multiple_low/high` and `rounding_floor`.

### Save flow

```
PUT optimistic UI ─▶ POST /engine/assumptions/{id}  (whole blob, not patched)
                        │
                        ▼ 200
                    POST /engine/recalculate/{id}   (no auto-setup — preserves tuning)
                        │
                        ▼ 200
                    Re-fetch /engine/results/{id}/BV, /Comps, /VM in parallel
                        │
                        ▼
                    Refresh all three views
```

If any call 4xx/5xxs, roll back and surface the error body. The 422 from a bad VM weight sum looks like `{"detail":[{"loc":["body","valuation","vm","weights"], "msg": "VM weights must sum to 1.0"}]}`.

### Auto-Setup button

Show only for non-tuned clients (`pwc-test-123456` and `ESCO-1` must be blacklisted in the UI — call out the warning in a tooltip if the user hovers a disabled button). When pressed: `POST /engine/auto-setup/{id}` then re-fetch.

---

## 8. Navigation / routing

1. In the module sidebar (next to `IS-CON`, `BS`, `CF`, `S&M`, `G&A`, `WC`, `FA`, `DEBT`, `equity`, `eosp`), add three new entries in this order: **Business Valuation (BV)**, **Comparable Companies (Comps)**, **Valuation Methodology (VM)**.
2. Group them visually under a "Valuation" sub-header — they are conceptually one suite.
3. Routes: `/clients/:clientId/bv`, `/clients/:clientId/comps`, `/clients/:clientId/vm`.
4. **Delete the old `/clients/:clientId/valuation` route** (or 301-redirect it to `/bv`). Hitting the engine's `/engine/results/{id}/valuation` now returns **404** — any leftover UI binding will break.

---

## 9. Excel export integration

The existing "Download Excel" action (`GET /engine/export/{client_id}`) now includes three additional sheets: **Business Valuation**, **Comparable Companies**, **Valuation Methodology**. No frontend change is required to the download itself — but update any copy that lists "what's in the export" to mention the three new sheets.

---

## 10. Definition of done

- [ ] All three module views render against US-1 data and match the layouts in §4–§6.
- [ ] Sensitivity 3×3 grid renders with the base-case center cell highlighted, and that cell numerically equals `equityValue[lastForecastYear]`.
- [ ] Comps view shows the 2×2 scenario grid plus the industry-averages table plus the Damodaran source note.
- [ ] VM football-field bar chart renders, including the single-point Book Value method.
- [ ] Weighted-summary table shows `fairValueEstimate.value` bolded with a thick top border. Weight total displays `100.0%`.
- [ ] Assumption editor PATCHes `valuation.{bv,comps,vm}`, blocks invalid VM weight sums, and triggers a recalculate → refresh cycle.
- [ ] Auto-Setup button is hidden / disabled for `pwc-test-123456` and `ESCO-1`.
- [ ] Old `/valuation` route and any references to a single valuation module are deleted.
- [ ] No console errors when loading any of the three views or editing assumptions.

---

## 11. Reference

- Engine source of truth: `app/core/documents/backend_docs.md` (Sections 5.11 BV, 5.12 Comps, 5.13 VM, plus Section 7 endpoint reference).
- The human Excel the layouts mirror: `app/core/excel/human/NSC Financial Model MI.xlsx`, tabs `BV`, `Comps`, `VM`. Open in Excel with formula bar visible to see why each value lands where it does — every UI position above maps directly back to a NSC cell range.
