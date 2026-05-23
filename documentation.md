# AdvisorsME Frontend — Agent Orientation Guide

Practical map of this codebase for automated agents (Claude Code, Code Agents, review bots). Read this once, then jump directly to the files you need. Backend contract lives in `backend_docs.md` — do not duplicate that here; treat it as source-of-truth for API shapes, calculation cascade, and Firestore schema.

**Last updated:** 2026-04-20

---

## 1. What this app is

A React SPA that wraps the AdvisorsME Financial Engine (FastAPI + Firestore). Users upload PDF financial statements, the backend extracts and normalizes them into historical data, an assumptions model drives a 5-step forecast cascade, and the UI displays / edits the inputs and outputs.

**Flow in one line:** PDF upload → extract tables → generate historical Lv1/Lv3 → assumptions (defaults or edited) → recalculate → IS-CON / BS / CF / S&M / G&A / FA / WC / DEBT / equity / eosp / (valuation).

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Build | Vite 7 (`npm run dev`, `npm run build`) |
| UI | React 18 + MUI v6 (`@mui/material`, `@mui/icons-material`) |
| Theme | Custom MUI theme at `src/LinkedinAI/style/LinkedinAITheme.*` (look imports from `App.jsx`) |
| Routing | `react-router-dom` v6, `BrowserRouter` at root |
| State | React Context only — no Redux, Zustand, TanStack Query |
| Auth | Custom `AuthContext` backed by localStorage + `/users/*` backend endpoints |
| HTTP | Plain `fetch` everywhere. Base URL in `src/Siduqqi/hooks/api.jsx` (`apiUrl`) |
| Charts | `chart.js` (used in `ReportGenerator`) |
| PDF | `pdf-lib` client-side, plus backend Gemini extraction |

`apiUrl` toggles between `http://127.0.0.1:8000` (dev) and `https://advisorsme-api.onrender.com` via the `isLive` flag at the top of `src/Siduqqi/hooks/api.jsx:1`. Change that flag to switch environments.

---

## 3. Repository layout

```
advisorsme-app/
├── backend_docs.md          Backend source of truth — API, schema, cascade
├── documentation.md         This file
├── frontend_plan.md         Historical planning doc (status may lag reality)
├── README.md
├── index.html
├── package.json             Vite scripts; type: "module"
├── eslint.config.js
├── vite.config.js
├── firebase.json            Hosting config (Firebase)
└── src/
    ├── main.jsx             Entry: mounts <App />
    ├── App.jsx              All routes live here. Provider nesting order matters.
    ├── Siduqqi/             Main product namespace — every app screen lives here
    │   ├── Dashboard.jsx    App shell: fixed AppBar + permanent left Drawer; renders children
    │   ├── dashboardConfig.js  Sidebar menu items (key/title/path/icon/show)
    │   ├── FinancialModelPage.jsx    Tabs per module, tables, export buttons
    │   ├── AssumptionsPage.jsx       Standalone assumptions editor (replaces old drawer)
    │   ├── assumptions/              Components for the assumptions editor
    │   │   ├── fieldMeta.js          Leaf-key → {label, unit, hint, step}
    │   │   ├── FieldRenderer.jsx     Recursive renderer; dispatches by node shape
    │   │   ├── LineItemRow.jsx       Dynamic S&M / G&A row with driver dropdown
    │   │   ├── SectionCard.jsx       Card wrapper for a section
    │   │   ├── NumberInput.jsx       Currency / days / number input with formatting
    │   │   └── PercentInput.jsx      Stores 0–1, displays ×100 with % suffix
    │   ├── context/
    │   │   ├── EngineContext.jsx     Assumptions / results / historical + debounced patch
    │   │   └── SettingsContext.jsx   clientId persisted to localStorage; in-memory cache
    │   ├── auth/
    │   │   ├── AuthContext.jsx       user, login/signup, localStorage-backed
    │   │   ├── AuthPage.jsx          Login screen
    │   │   ├── SignupPage.jsx
    │   │   ├── AuthSidebar.jsx
    │   │   └── RequireAuth.jsx       Route guard — wraps protected routes
    │   ├── admin/
    │   │   └── AdminPanel.jsx        Gated to admin@admin.com in AuthContext
    │   ├── hooks/
    │   │   ├── api.jsx               Exports { apiUrl }
    │   │   └── useEngineExport.js    Excel export helper (single module / all)
    │   ├── utils/
    │   │   ├── engineFormatNumber.js      engineFormatNumber, engineFormatPercent
    │   │   ├── CorporateFinancialTableView.jsx  Read-only forecast/historical table
    │   │   ├── CorporateEditableTable.jsx       Editable table (legacy flows)
    │   │   ├── CorporateTableTheme.js           Shared styling constants
    │   │   ├── FinancialTableView.jsx / TableView.jsx  Older table variants
    │   │   ├── CsvViewer.jsx / StyledHtmlTable.jsx
    │   │   ├── ExportHistoricalButton.jsx / ExportingTables.jsx / ExportHtmlString.jsx
    │   │   ├── FinantialBukets.jsx
    │   │   ├── PdfGrid.jsx / ZoomDialog.jsx
    │   │   └── ThinkingComponnet.jsx
    │   ├── Extractor.jsx                  PDF upload + extraction screen
    │   ├── ExtractorAgnticDocument.jsx
    │   ├── FinantialStatments.jsx         Statement browsing
    │   ├── FinantialStatmentsHistorical.jsx
    │   ├── FinantialNotes.jsx
    │   ├── IsConHistorical.jsx            Legacy (show: false in sidebar)
    │   ├── BSHistorical.jsx               Legacy
    │   ├── BSForecasting.jsx              Legacy
    │   ├── ForecastingCalculationLv1.jsx  Legacy wrapper
    │   ├── ForecastingCalculationLv3.jsx  Legacy wrapper
    │   ├── lv1Calculations.jsx            Legacy
    │   ├── lv3Calculations.jsx            Legacy — deeper line-item editor pattern
    │   ├── FinancialSummaryTable.jsx      Legacy unified view
    │   ├── HistoricalAIAgent.jsx          Agent-driven historical generation UI
    │   ├── ExportManager.jsx              Standalone export screen
    │   ├── ReportGenerator.jsx            Chart builder
    │   ├── MetricSelector.jsx
    │   ├── ModernDashboard.jsx
    │   └── Settings.jsx                   Edit clientId
    └── LinkedinAI/                  Theme + shared visuals (do not touch unless needed)
```

**Active vs legacy.** Pages with `show: false` in `dashboardConfig.js` are legacy and hidden from the sidebar but still routable for backward compatibility. When extending, prefer `FinancialModelPage` + `AssumptionsPage` over the `lv1/lv3*` variants.

---

## 4. Provider nesting & routing

```
<ThemeProvider theme={LinkedinAITheme}>
  <AuthProvider>              // auth/AuthContext.jsx — user, login, signup
    <SettingsProvider>        // context/SettingsContext.jsx — clientId + API cache
      <EngineProvider>        // context/EngineContext.jsx — assumptions/results/patch
        <Router>
          <Routes> ... </Routes>
        </Router>
      </EngineProvider>
    </SettingsProvider>
  </AuthProvider>
</ThemeProvider>
```

Order matters: `EngineProvider` reads `clientId` from `SettingsProvider`, so the settings provider must sit above it. All of this lives at `src/App.jsx:34-231`.

### Route convention

Every authenticated screen is wrapped three layers deep:

```jsx
<Route
  path="/foo"
  element={
    <RequireAuth>
      <Dashboard>
        <YourPage />
      </Dashboard>
    </RequireAuth>
  }
/>
```

- `RequireAuth` (`auth/RequireAuth.jsx`) redirects to `/auth` if no user.
- `Dashboard` is the app shell — fixed AppBar + permanent left Drawer, children render in the main content area with `pt: 10` to clear the AppBar.

To add a new page:
1. Create the component under `src/Siduqqi/YourPage.jsx`.
2. Import + add a `<Route>` in `App.jsx`.
3. Add an entry to `dashboardConfig.js` if it should appear in the sidebar.

### Current routes

| Path | File | Status |
|---|---|---|
| `/` | `Dashboard` (no child → tiles view) | active |
| `/PdfExtractor` | `Extractor.jsx` | active |
| `/statements` | `FinantialStatments.jsx` | active |
| `/historical` | `FinantialStatmentsHistorical.jsx` | active |
| `/HistoricalAIAgent` | `HistoricalAIAgent.jsx` | active |
| `/FinancialModel` | `FinancialModelPage.jsx` | **primary** |
| `/assumptions` | `AssumptionsPage.jsx` | **primary** |
| `/FinancialNotes` | `FinantialNotes.jsx` | active |
| `/ExportManager` | `ExportManager.jsx` | active |
| `/ReportGenerator` | `ReportGenerator.jsx` | active |
| `/settings` | `Settings.jsx` | active |
| `/auth`, `/signup` | `auth/AuthPage.jsx`, `auth/SignupPage.jsx` | public |
| `/IsConHistorical`, `/BSHistorical`, `/BSForecasting`, `/ForecastingCalculationLv1`, `/ForecastingCalculationLv3`, `/FinancialSummary`, `/advisors/lv3Calculations/:client_id/:doc` | various | **legacy** — hidden from sidebar |

---

## 5. State model (the contexts)

### 5.1 `SettingsContext` — `src/Siduqqi/context/SettingsContext.jsx`

```
clientId            string — current active client (required for all engine calls)
setClientId         setter; persists to localStorage key "advisorsme_client_id"
getCachedData       (key, clientId) → value | null
setCachedData       (key, clientId, value)
clearCache          ()
```

The cache is in-memory only (no persistence). Keys used: `"engine_assumptions"`, `"engine_results"`, `"engine_historical"`.

### 5.2 `AuthContext` — `src/Siduqqi/auth/AuthContext.jsx`

```
user                { client_id, email, username } | null
isAdmin             user?.email === "admin@admin.com"
login / signup      POST /users/login/{email}/{password} / /users/create
logout              clears state + localStorage
```

Session persists in localStorage under `advisorsme_auth_v1`. `login` sets `clientId` via `SettingsContext` for convenience.

### 5.3 `EngineContext` — `src/Siduqqi/context/EngineContext.jsx` (**critical**)

The heart of the app. Exposes:

| Key | Kind | Description |
|---|---|---|
| `assumptions` | state | Current assumptions object (backend `GET /engine/assumptions/{id}`) |
| `results` | state | All module outputs keyed by module (`"IS-CON"`, `"BS"`, `"CF"`, `"S&M"`, `"G&A"`, `"FA"`, `"WC"`, `"DEBT"`, `"equity"`, `"eosp"`, `"valuation"`). See backend_docs.md §5 |
| `historical` | state | Raw historical data |
| `loading` | bool | Results loading |
| `assumptionsLoading` | bool | Assumptions loading |
| `patching` | bool | Debounced patch in flight — show a spinner |
| `generatingDefaults` | bool | `/generate-defaults` in flight |
| `error` | string \| null | Last error message |
| `loadAssumptions(cId)` | fn | Fetch assumptions |
| `loadAllResults(cId)` | fn | Fetch all module results |
| `loadHistorical(cId)` | fn | Fetch historical |
| `recalculate()` | fn | `POST /engine/recalculate` + refetch results |
| `saveFullAssumptions(data)` | fn | `POST /engine/assumptions` (does NOT auto-recalc — caller must follow with `recalculate()`) |
| `generateDefaults(save)` | fn | `POST /engine/generate-defaults?save=…` — returns generated assumptions without saving when `save=false` |
| `queuePatch(path, value)` | fn | **Primary edit entry point.** Dot-path (`"revenue.growth_yoy_pct.2024"`), 500ms debounce, deep-merges into `pendingDelta`, PATCHes, refetches results |
| `flushPatch()` | fn | Force-flush pending delta immediately |
| `classifyLineItem(module, item, driver)` | fn | PATCH `/engine/assumptions/{id}/classify-item` for S&M / G&A driver overrides |
| `setError(msg)` | fn | Manually set/clear error |

### 5.4 The queuePatch flow (memorize this)

```
User edits field
  └── queuePatch("revenue.growth_yoy_pct.2024", 0.08)
        ├── deepMerge into pendingDelta  (accumulates multiple edits)
        ├── setAssumptions(deepMerge(prev, delta))  ← optimistic UI update
        └── debounceTimer (500ms)
              └── flushPatch()
                    ├── PATCH /engine/assumptions/{clientId}   ← backend auto-recalcs
                    ├── loadAllResults(clientId)               ← refresh all module outputs
                    └── GET /engine/assumptions/{clientId}     ← re-sync assumptions
```

The backend recalculates **on every PATCH**. You do not need to call `recalculate()` manually after edits — only after a full replace via `saveFullAssumptions()`, or to force a recompute (e.g. after a generate-defaults apply).

---

## 6. The assumptions data model

**Backend schema**: see `backend_docs.md` §6 (`LineItemAssumption` shape, `base_kpi`, gap detection).

**Top-level keys observed in the wild:**

```
{
  general:           { reporting_date, currency }
  rates:             { fx_usd_sar, fx_gbp_sar, fx_eur_sar }
  revenue:           { growth_yoy_pct: { "2024": 0.1, ... } }
  margins:           { gp_margin_sales_pct: { "2024": 0.32, ... } }
  opex: {
    sm_expenses:     { [itemKey]: LineItemAssumption, ... }
    ga_expenses:     { [itemKey]: LineItemAssumption, ... }
  }
  working_capital:   { trade_receivables_days_sales, ..., due_to_related_parties_fixed_amount }
  capex:             { capex_pct_of_opening_balance: { "2024": 0.05, ... } }
  depreciation_rates:{ vehicles, furniture_and_fixtures, office_equipment, computers, leasehold_improvement }
  other:             { zakat_rate, other_income_annual_growth_pct, eosb_pct, dividend_payout_ratio, statutory_reserve_pct, statutory_reserve_cap_pct }
  debt:              { financing_rate, annual_repayment, new_borrowings }
  valuation:         { ... }    // optional — only present when explicitly set
}
```

**Three node shapes the UI must handle:**

| Shape | How to detect | Example |
|---|---|---|
| Scalar | Not an object | `0.05`, `"SAR"`, `2024` |
| Per-year dict | Every key matches `/^\d{4}$/` | `{ "2024": 0.1, "2025": 0.08 }` |
| `LineItemAssumption` | Has `driver` or `rate` key | `{ driver: "yoy_growth", rate: 0.06, base_value: null }` |

Anything else is a plain nested object — recurse.

The **dynamic** bits are `opex.sm_expenses` and `opex.ga_expenses`. Line item keys come from AI extraction (camelCase, e.g. `salariesWagesAndBenefits`) and vary per client. The `classify-item` endpoint lets you flip an item's `driver` between `"yoy_growth" | "pct_of_revenue" | "fixed"`.

---

## 7. The `/assumptions` editor

`AssumptionsPage.jsx` is the primary surface for editing. Design notes an agent should respect:

- **Every edit** goes through `queuePatch()` (or `classifyLineItem()` for driver changes). Never POST the full assumptions object from a field change.
- **Field metadata** is a single table in `assumptions/fieldMeta.js` keyed by leaf key. If you add a new backend assumption field:
  1. Add an entry to `FIELD_META` (label, unit, optional hint/step).
  2. The renderer will pick the right input automatically.
- **`unit` values** supported: `"percent"` (stored 0–1, displayed ×100 with `%`), `"currency"` (SAR prefix, thousands separators), `"days"` (`days` suffix), `"year"` (integer), `"text"`, `"number"`.
- **Recursive renderer** in `FieldRenderer.jsx` dispatches on node shape. Order of checks matters: LineItem → per-year dict → scalar → plain nested object (recurse).
- **KPI strip** at the top reads from `results` — drives the "my edit caused a recalc" feedback. Values used: `results["IS-CON"].revenue|EBITDA|netIncomeLoss`, `results["CF"].freeCashFlows`, `results["BS"].totalAssets - totalLiabilitiesAndEquity`.
- **Generate-defaults flow**: `generateDefaults(false)` → store in local `previewDefaults` state → user edits → `saveFullAssumptions(preview)` + `recalculate()`. Preview edits DO NOT call `queuePatch` — they mutate local state only until applied.

---

## 8. Module tables (`/FinancialModel`)

`FinancialModelPage.jsx` is a tab per module. Table rendering delegates to `utils/CorporateFinancialTableView.jsx`. Key constants at the top of the file:

- `MODULES` — list of tabs (order defines tab order).
- `BOLD_ROW_KEYS` — per-module list of row keys to render bold (totals / subtotals).
- `PER_ITEM_ANALYTICS` — which modules use `PerItemAnalyticsSection` (S&M, G&A) vs `AnalyticsSection`.

Section headers (`is_header: true`, no year values) come from the backend — the table view detects and renders them as divider rows.

To add the valuation tab: append to `MODULES`, add bold keys if applicable, and confirm the backend is returning `results["valuation"]` (only when `assumptions.valuation` is set).

---

## 9. HTTP & backend

- Base URL: `src/Siduqqi/hooks/api.jsx`. Flip `isLive` to switch dev/prod.
- Every engine call encodes the `clientId` with `encodeURIComponent`.
- No interceptors / global error handler — each call checks `res.ok` and surfaces via `setError`.
- **Endpoint reference**: see `backend_docs.md` §7. Do not re-derive endpoint shapes; read the backend docs.

Excel export uses `useEngineExport` (`hooks/useEngineExport.js`). It handles `StreamingResponse` blobs and Content-Disposition filenames.

---

## 10. Styling

- MUI `sx` prop throughout. No CSS modules, no styled-components, no Tailwind.
- Brand colors observed: `#0A1E37` (dark navy), `#1F559B` (primary blue), `#12325B` (mid), gradient `linear-gradient(to right, #0A1E37, #1F559B)` for headers.
- Chips/buttons use `size="small"` as the default across the product. Follow this when adding new controls.
- Typography sizes are mostly default MUI — override with `fontSize: 13` for dense table/input contexts (common pattern).
- Number formatting: always use `engineFormatNumber` / `engineFormatPercent` from `utils/engineFormatNumber.js` for display. Never `toLocaleString` inline.

---

## 11. Running locally

```
npm install
npm run dev         # Vite dev on :5173
npm run build       # Production build to /dist
npm run lint        # ESLint
npm run preview     # Serve /dist
```

Backend must be running at `http://127.0.0.1:8000` (or flip `isLive` to hit Render). If the backend is down, the UI shows generic error alerts — check the Network tab, there is no retry logic.

**Test client** per `backend_docs.md:227`: `pwc-test-123456`. Set it in `/settings` to get a fully populated model.

---

## 12. Known gotchas

1. **The `opex` node.** A client's `sm_expenses` / `ga_expenses` contain dynamic keys. Anything that iterates statically over these two objects will miss or crash on new line items. Use the recursive renderer pattern from `FieldRenderer.jsx`.
2. **Per-year rates inside LineItemAssumption.** Rare but possible — `LineItemRow.jsx` handles this by expanding `rate` into a row of inputs if `isPerYearDict(rate)`.
3. **Synthetic gap items.** Names matching `/^other[A-Z].*Expenses$/` (e.g. `otherSMExpenses`, `otherGAExpenses`) are synthetic gap items created by the defaults generator; they typically have a non-null `base_value`. UI badges them as "synthetic gap".
4. **`saveFullAssumptions` does NOT recalculate.** Unlike PATCH, POST only saves. Always follow with `recalculate()`. The generate-defaults → apply flow in `AssumptionsPage.jsx` does this correctly — copy that pattern.
5. **Intermediate typing states.** `queuePatch` is called on every keystroke. The page filters out `"-"`, `"."`, `"-."` before queueing so the backend never sees garbage. Preserve this behavior when adding new inputs — `NumberInput`/`PercentInput` already handle it.
6. **Cache invalidation.** `SettingsContext` has no TTL. If a user edits assumptions in one browser tab, another tab may show stale results until they hit Refresh or re-login. Live with it unless this becomes a real problem.
7. **Legacy routes.** Pages under `IsConHistorical`, `BSHistorical`, `BSForecasting`, `ForecastingCalculationLv*`, `lv1Calculations`, `lv3Calculations`, `FinancialSummary` are deprecated. They hit the legacy `/calculation/*` backend endpoints (also deprecated — see `backend_docs.md` §10 migration map). Do not extend them; route new work through `EngineContext`.
8. **Route ordering indentation in `App.jsx`.** The file mixes 12-space and 14-space indentation across existing routes. Match the surrounding block when editing — don't reformat the whole file, it creates noisy diffs.
9. **Typos are load-bearing.** `FinantialStatments.jsx`, `FinantialBukets.jsx`, `Componnet.jsx`, `TaableViewHtml.jsx` — these spellings are used in imports. Don't "fix" them without a find-and-replace sweep.

---

## 13. How to extend — common recipes

### Add a new assumption field

1. Backend adds the field under the appropriate section.
2. In `src/Siduqqi/assumptions/fieldMeta.js`, add a `FIELD_META[yourKey]` entry with `{label, unit, hint?, step?}`.
3. No renderer change needed if the field fits an existing shape (scalar / per-year / LineItem). The recursive renderer will pick it up automatically.
4. If it's a new section, add a block to `SECTIONS` in `AssumptionsPage.jsx`.

### Add a new backend module tab

1. Add `{ key, label }` to `MODULES` in `FinancialModelPage.jsx`.
2. Add bold rows to `BOLD_ROW_KEYS[key]` if applicable.
3. If the module has per-item analytics, add to `PER_ITEM_ANALYTICS`.
4. The generic table view handles the rest — backend must return the module keyed identically in `results`.

### Add a new page

1. Component under `src/Siduqqi/YourPage.jsx`.
2. Route in `App.jsx` wrapped with `<RequireAuth><Dashboard>…</Dashboard></RequireAuth>`.
3. Sidebar entry in `dashboardConfig.js` (`show: true`, pick an icon from `@mui/icons-material`).
4. If the page needs engine data, `const { assumptions, results, queuePatch } = useEngine();` — do not fetch directly.

### Call a new backend endpoint

1. Add the call inside `EngineContext.jsx` as a `useCallback` action, set `patching`/`loading` while in flight, update local state on success, call `setError(msg)` on failure.
2. Expose the action in the provider value at the bottom of the file.
3. Consumers call it via `useEngine()`. No raw `fetch` in page components.

---

## 14. Files you should read before non-trivial work

| If you're touching… | Read first |
|---|---|
| Assumptions editing / rendering | `AssumptionsPage.jsx`, `assumptions/FieldRenderer.jsx`, `assumptions/LineItemRow.jsx`, `assumptions/fieldMeta.js`, `context/EngineContext.jsx` |
| Module tables / analytics | `FinancialModelPage.jsx`, `utils/CorporateFinancialTableView.jsx`, `backend_docs.md` §5 |
| Recalc / patch flow | `context/EngineContext.jsx`, `backend_docs.md` §4 |
| Auth / route guards | `auth/AuthContext.jsx`, `auth/RequireAuth.jsx`, `App.jsx` |
| Export | `hooks/useEngineExport.js`, `ExportManager.jsx`, `backend_docs.md` §8 |
| Sidebar / shell | `Dashboard.jsx`, `dashboardConfig.js` |
| Anything backend-shaped | **Always start with `backend_docs.md`** — do not guess API shapes |

---

## 15. What NOT to do

- **Do not bypass `EngineContext`** with raw `fetch` inside page components. The debounce + cache + refresh logic only works if edits go through `queuePatch`.
- **Do not re-introduce the old `AssumptionsDrawer.jsx`** — it had a silent bug where nested objects (including the dynamic line items) were skipped. The current page renderer is the fixed replacement.
- **Do not add new routes to the legacy `/calculation/*` backend endpoints.** They are deprecated (`backend_docs.md` §10).
- **Do not hardcode per-client line item keys.** S&M / G&A line items are discovered at runtime.
- **Do not add new `show: true` sidebar items without an icon** — `Dashboard.jsx` expects each entry to have a valid `icon` component.
- **Do not reorganize `App.jsx` indentation** in incidental diffs.
