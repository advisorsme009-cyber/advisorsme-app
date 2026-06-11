# UI Build Brief — "API & Metrics" + "Report Generator"

**Audience:** Frontend team / coding agent.
**Design reference:** `/Users/agentixai/AgentixAI/SuperAgents/Design/Report Generator.png`
**Backend:** AdvisorsME Financial Engine (FastAPI). Base URL `http://127.0.0.1:8000`.
All endpoints below are live and tested. `{client_id}` example: `US-1`.

You are building/refactoring two screens. The existing "Report Generator" screen
is **renamed** to **"API and Metrics"**, and a **brand-new** "Report Generator"
screen is added for saved charts. Do not invent metric lists or analytics math —
everything comes from the endpoints described here.

---

## Screen 1 — "API and Metrics" (rename of the current Report Generator screen)

### 1.1 Rename
Rename the screen and its nav entry from "Report Generator" to **"API and Metrics"**.
The name "Report Generator" is reused by the new screen (Screen 2).

### 1.2 Metric dropdown — pick up to 3
Populate the metric dropdown from:

```
GET /engine/metrics-catalog/{client_id}
```

Response (abridged):
```json
{ "client_id": "US-1", "modules": [
  { "module": "IS-CON", "level": "lv1", "label": "Income Statement", "metrics": [
      { "key": "revenue", "label": "Revenue", "isTotal": false, "drillDown": null },
      { "key": "sellingMarketingExpenses", "label": "Selling and marketing expenses",
        "isTotal": false, "drillDown": "S&M" } ] },
  { "module": "S&M", "level": "lv3", "label": "Selling & Marketing", "metrics": [ ... ] } ] }
```

- Group the dropdown by `module` using `label` as the group header.
- Show each metric by its `label`. Selecting passes `{module, key}` to the analytics call.
- **The user must be able to select up to 3 metrics.** Enforce the max of 3.
- **The first selected metric is the PRIMARY** — everything rendered below belongs to it.
- **There is NO "Percentage" entry** — the catalog already excludes display-only,
  non-metric rows. Do not add one back. (This is requirement RG-F1.)

### 1.3 For the PRIMARY metric, fetch its analytics + drill-down in one call

```
GET /engine/metric-analytics/{client_id}/{module}/{metric}?include_drilldown=true
```

Response:
```json
{
  "client_id": "US-1", "module": "IS-CON", "metric": "sellingMarketingExpenses",
  "paramName": "Selling and marketing expenses",
  "values":   { "2022": -18362408, "2023": -12757801, ... },
  "analytics": {
    "growth":       { "2022": null, "2023": 0.305222, ... },
    "pctOfRevenue": { "2022": -0.294484, "2023": -0.234884, ... },
    "commonSize":   { "2022": -0.294484, "2023": -0.234884, ... }
  },
  "drillDown": {
    "available": true,
    "module": "S&M",
    "lines": [
      { "key": "rent", "label": "Rent", "isTotal": false,
        "values": { "2022": -5.1e6, ... },
        "analytics": { "growth": {...}, "pctOfRevenue": {...}, "commonSize": {...} } },
      ... one entry per Lv3 line ...
    ]
  }
}
```

Render, below the primary metric, in this order:

**A) Drill-down section (first).**
- If `drillDown.available === true`: render the **full Lv3 breakdown** from
  `drillDown.lines` (e.g. selecting IS-CON "Selling & Marketing" shows the full
  S&M schedule — rent, salaries, advertising, …). Each line has its own `values`
  and `analytics`. A grouped/stacked bar over the years works well (see design).
- If `drillDown.available === false` (the metric is already a Lv3 line, or has no
  deeper level): **show only the selected metric, in solid colours** (no breakdown).

**B) The three analytics charts for the selected (primary) metric.** Render all
three, each its own chart:
- **% of Revenue** → `analytics.pctOfRevenue`
- **% Growth** → `analytics.growth`
- **% Common size** → `analytics.commonSize`

> Note: for income-statement metrics, `commonSize === pctOfRevenue` by construction
> (income-statement lines are common-sized against revenue). For Lv3 lines,
> `commonSize` is the line's share of its module total — they differ. Just render
> what the API returns.

### 1.4 Negative Y-axis — flip the line (RG-F2)
Values carry their real sign: **expenses are negative**. When a series is negative,
the chart must show the **true trend direction** — a value getting *more negative*
must slope **down**, not up. Today the chart inverts/explodes for negative series;
fix the axis/scaling so the visual direction matches the real-world direction
(worsening = down). Apply to value charts and the % charts (which can also be
negative for expenses).

### 1.5 Remove commentary from this screen (RG-F7)
Delete the commentary panel/box from the API & Metrics screen entirely. Commentary
now lives per-chart on Screen 2.

### 1.6 "Add to Report Generator" button (RG-F8)
Next to **each metric/chart**, add an **"Add to Report Generator"** button. On click:
1. **Prompt the user to confirm** ("Add this chart to the Report Generator?").
2. On confirm, POST the chart:

```
POST /report-generator/{client_id}/charts
Content-Type: application/json

{
  "module": "IS-CON",
  "metric": "sellingMarketingExpenses",
  "chartType": "pctOfRevenue",          // which view was pinned: value | growth | pctOfRevenue | commonSize | drilldown
  "title": "S&M — % of Revenue",
  "series": { ... the data you charted ... }   // snapshot so the saved chart re-renders as-is
}
```

The server returns the saved chart with a generated `id`, `createdAt`, and an empty
`commentary`. Store `series` (a snapshot) so the Report Generator screen can
re-render without recomputing; the engine may recalculate later.

---

## Screen 2 — "Report Generator" (NEW screen)

A new screen that lists every chart the user pinned, each with its own commentary,
exportable to PDF.

### 2.1 List saved charts
```
GET /report-generator/{client_id}/charts
```
```json
{ "client_id": "US-1", "count": 2, "charts": [
  { "id": "f728bd20…", "module": "IS-CON", "metric": "sellingMarketingExpenses",
    "chartType": "pctOfRevenue", "title": "S&M — % of Revenue",
    "series": {…}, "commentary": "", "createdAt": "…", "updatedAt": "…" } ] }
```
Render each as a card: the chart (from `series`/`chartType`) + a **Commentary**
text area below it (see design — commentary is **per chart**, not one shared box).

### 2.2 Per-chart commentary (RG-F9)
Each card has its own Commentary input. On save/blur:
```
PATCH /report-generator/{client_id}/charts/{chart_id}
{ "commentary": "S&M is trending down as a share of revenue." }
```

Allow removing a card:
```
DELETE /report-generator/{client_id}/charts/{chart_id}
```

### 2.3 Export to PDF (RG-F10)
Add an **Export to PDF** action that renders **each saved chart together with its
commentary** into a PDF. Do this **client-side** (e.g. `html2canvas` + `jsPDF`, or
the print stylesheet) — the charts already render in the browser and the backend
has no PDF dependency. One chart + its commentary per block; multiple per page is
fine.

---

## Endpoint quick-reference

| Method | Path | Use |
|---|---|---|
| GET | `/engine/metrics-catalog/{client_id}` | Dropdown source (no "Percentage") |
| GET | `/engine/drilldown-map` | Static Lv1→Lv3 map (optional; analytics already returns the target) |
| GET | `/engine/metric-analytics/{client_id}/{module}/{metric}?include_drilldown=true` | Primary metric: 3 analytic series + full Lv3 breakdown |
| GET | `/engine/results/{client_id}/{module}` | Raw module rows if you need them directly |
| POST | `/report-generator/{client_id}/charts` | Save a pinned chart |
| GET | `/report-generator/{client_id}/charts` | List saved charts |
| PATCH | `/report-generator/{client_id}/charts/{chart_id}` | Save commentary |
| DELETE | `/report-generator/{client_id}/charts/{chart_id}` | Remove a chart |

Notes:
- URL-encode `&` in module names: `S&M` → `S%26M`, `G&A` → `G%26A`.
- All analytics values are decimals (`0.25` = 25%); format as `%` in the UI.
- Years are string keys (`"2024"`). Sort numerically before charting.
- `growth` first year is `null` (no prior year) — skip/blank it.

## Checklist (requirement IDs)
- [ ] RG-F1 dropdown from catalog, no "Percentage"
- [ ] RG-F2 negative-axis line flips to true direction
- [ ] RG-F3 screen renamed to "API and Metrics"
- [ ] RG-F4 up to 3 metrics, first is primary
- [ ] RG-F5 drill-down (full Lv3 if available; single solid line if not)
- [ ] RG-F6 three charts (% of revenue / % growth / % common size)
- [ ] RG-F7 commentary removed from API & Metrics screen
- [ ] RG-F8 "Add to Report Generator" + confirm + POST
- [ ] RG-F9 new Report Generator screen: saved charts + per-chart commentary
- [ ] RG-F10 export charts + commentary to PDF (client-side)
