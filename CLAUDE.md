# AdvisorsME App — Claude Code Guide

## Project Overview

Financial modeling dashboard for advisors and consultants. Advisors upload historical financial statements; the app runs forecasting models and generates reports.

**Stack:** React 18 + Vite + MUI 6 + Emotion (frontend), FastAPI + Firestore (backend, separate repo).

## Dev Commands

```bash
npm run dev       # start Vite dev server (localhost:5173)
npm run build     # production build → dist/
npm run lint      # ESLint
npm run preview   # preview production build
```

## Architecture

### Frontend structure

```
src/
  App.jsx                        # root router + theme providers
  Siduqqi/                       # main financial modeling feature
    auth/                        # AuthContext, AuthPage, RequireAuth
    context/
      EngineContext.jsx           # engine API state (assumptions, results)
      SettingsContext.jsx         # global client_id + settings
    hooks/
      api.jsx                    # API base URL (isLive toggle)
      useEngineExport.js         # export hook
    assumptions/                 # AssumptionsPage + field components
    utils/                       # table renderers, formatters, export helpers
    dashboardConfig.js           # sidebar menu items
    FinancialModelPage.jsx        # main tabbed view
    Dashboard.jsx                # sidebar + layout shell
  LinkedinAI/                    # separate LinkedIn AI feature
```

### API base URL

`src/Siduqqi/hooks/api.jsx` — toggle `isLive` flag:
- `false` → `http://127.0.0.1:8000` (local FastAPI)
- `true` → `https://advisorsme-api.onrender.com` (production)

### State management

No Redux. Uses `useState` + React Context only:
- `SettingsContext` — `client_id`, global settings
- `EngineContext` — engine API data (assumptions, results, loading states)
- `AuthContext` — Firebase auth state

## Backend API (Engine)

All new work targets `/engine/` endpoints. Legacy `/calculation/lv*` endpoints are deprecated.

| Endpoint | Purpose |
|---|---|
| `POST/GET/PATCH /engine/assumptions/{client_id}` | Assumptions CRUD |
| `POST /engine/recalculate/{client_id}` | Full 5-step cascade recalculation |
| `GET /engine/results/{client_id}` | All module results (historical + forecast merged) |
| `GET /engine/results/{client_id}/{module}` | Single module results |
| `POST /engine/generate-defaults/{client_id}?save=false` | Auto-generate assumptions from historical data |
| `GET /engine/historical/{client_id}` | All historical data |
| `GET /engine/historical/{client_id}/{module}` | Single module historical data |

**Modules:** `IS-CON`, `BS`, `CF`, `S&M`, `G&A`, `FA`, `WC`, `DEBT`, `equity`, `eosp`

**Cascade order:** Revenue → Parallel Lv3 (S&M, G&A, FA, WC, DEBT) + EOSP → IS-CON + Equity → CF → BS

**Key design rules:**
- `PATCH assumptions` auto-triggers recalculation on the backend
- Frontend debounces assumption changes 500ms then PATCHes only the delta
- All financial computation is backend-side — never compute financial logic on the frontend
- Results include both historical and forecast years in a single response
- Use `general.reporting_date` as the boundary between ACTUAL and FORECAST columns

## UI Conventions

- **Theme:** orange primary `#FF5622`, blue sidebar — defined in `Dashboard.jsx` and `LinkedinAITheme.jsx`
- **Financial tables:** years as columns, line items as rows, negatives in parentheses, bold totals
- **Historical columns** — muted/grey background; **Forecast columns** — standard background
- **Balance sheet check** — show green checkmark if balance check row = 0, red warning otherwise
- **Assumptions workflow** — if client has no assumptions (404), offer "Generate Default Assumptions" → preview with `save=false` → user adjusts → save & recalculate
- Use `param_name` from API response as the display label for every line item — don't hardcode labels

## Error Handling

- `404` — no data / setup prompt (not an error toast)
- `422` — inline validation errors next to the relevant field
- `500` — toast notification with retry option

## Key Constraints

- **Never compute financial logic on the frontend** — all calculations go through the backend engine
- **Never hardcode year columns** — always read year keys dynamically from API responses
- **Preserve existing visual design** when changing data layer — themes, table appearance, sidebar, auth flow stay as-is
- **No backwards-compat shims** — if something is unused, delete it
