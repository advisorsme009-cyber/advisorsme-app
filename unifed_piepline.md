# Unified Pipeline — Client Integration Instructions

**For:** Claude Code Agent responsible for building the React.js client  
**API Base URL:** `http://localhost:8000` (dev) — replace with production URL when deployed  
**Endpoint:** `POST /process-pipeline`

---

## What This Endpoint Does

One request drives the complete financial model pipeline from raw PDF uploads to a fully computed engine output:

```
PDF files uploaded
       │
       ▼
Stage 0 (0–35%)  — PDF Extraction
  Each PDF is rendered page-by-page → Gemini AI extracts financial tables → saved to Firestore
  SKIPPED automatically if statements already exist for this client (force=false)
       │
       ▼
Stage 1 (35–55%) — Lv1 Historical Generation
  AI reads saved statements and extracts consolidated statements:
  Income Statement (IS-CON) · Balance Sheet (BS) · Cash Flow (CF)
       │
       ▼
Stage 2 (55–80%) — Lv3 Historical Generation
  AI extracts detailed schedules:
  Selling & Marketing (S&M) · G&A · Fixed Assets (FA) · Working Capital (WC) · Debt (DEBT)
       │
       ▼
Stage 3 (80–85%) — Validation
  Mathematical cross-checks across all extracted data · Data quality score computed (0–100)
       │
       ▼
Stage 4 (85–100%) — Financial Model Engine
  Auto-generates default assumptions from historical data
  Runs full 5-year financial model forecast
  All results written to Firestore
       │
       ▼
"complete" event — Firestore fully populated, model ready
```

The response is a **streaming HTTP response** (`text/event-stream`). Each line is a Server-Sent Event that the frontend reads incrementally as it arrives. The full pipeline takes **5–15 minutes** depending on the number of PDF pages and Gemini API latency.

---

## Request Format

```
POST /process-pipeline
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | string | ✓ | Unique client identifier, e.g. `"acme-corp-001"` |
| `years` | string (JSON array) | ✓ | Integer years matching file order, e.g. `"[2024, 2023]"` |
| `force` | boolean string | — | `"true"` to re-run PDF extraction even if data exists. Default: `"false"` |
| `dpi` | integer string | — | PDF render resolution. Default: `"150"` (fast + accurate). Use `"200"` for dense tables |
| `files` | File[] | ✓ | One or more PDF financial statement files |

**Critical:** `years` must be a JSON array string with exactly one integer per uploaded file, in the same order as the files. The year is the financial year the PDF covers (e.g. annual report for FY2024).

---

## SSE Event Reference

Every event arrives as a single line in the HTTP response body:

```
data: {JSON object}\n\n
```

### Event Object Shape

```typescript
interface PipelineEvent {
  // What kind of event this is
  type: "stage_start" | "progress" | "stage_complete" | "error" | "complete";

  // Which pipeline stage emitted this event
  stage: "pdf_extraction" | "lv1_generation" | "lv3_generation" | "validation" | "engine";

  // Human-readable stage label (use for UI headers)
  stageName: string;

  // Description of the current operation (use for status text)
  step: string;

  // Overall pipeline progress 0–100
  progress: number;

  // Progress within the current stage 0–100
  stageProgress: number;

  // Current status
  status: "running" | "completed" | "warning" | "error" | "skipped";

  // ISO 8601 timestamp
  timestamp: string;

  // Present on stage_complete and complete events (see below)
  detail?: object;
}
```

### Stage Progress Ranges

| Stage | `stage` value | `progress` range | Notes |
|-------|--------------|-----------------|-------|
| PDF Extraction | `"pdf_extraction"` | 0 → 35% | Skipped if `force=false` and data exists |
| Lv1 Generation | `"lv1_generation"` | 35 → 55% | IS-CON, BS, CF |
| Lv3 Generation | `"lv3_generation"` | 55 → 80% | S&M, G&A, FA, WC, DEBT |
| Validation | `"validation"` | 80 → 85% | |
| Engine | `"engine"` | 85 → 100% | |

### Event Type Lifecycle

```
stage_start     → one per stage (use to render stage card / expand section)
progress        → many per stage (update step text and progress bar)
stage_complete  → one per stage (mark stage done, show summary)
complete        → exactly one, always the last event (pipeline finished)
```

### `stage_complete` Detail Payloads

**`pdf_extraction`**
```json
{
  "pdf_pages_processed": 42,
  "skipped": false
}
```
When skipped (`force=false`, data exists):
```json
{
  "pdf_pages_processed": 0,
  "skipped": true
}
```

**`lv1_generation`**
```json
{
  "results": {
    "IS-CON": "success",
    "BS": "success",
    "CF": "success"
  }
}
```

**`lv3_generation`**
```json
{
  "results": {
    "S&M": "success",
    "G&A": "success",
    "FA": "success",
    "WC": "success",
    "DEBT": "success"
  }
}
```

**`validation`**
```json
{
  "warnings_count": 2,
  "critical_count": 0,
  "data_quality_score": 88,
  "warnings": [
    {
      "check": "S&M Lv3 total vs IS-CON",
      "severity": "warning",
      "year": "2023",
      "expected": 4200000,
      "actual": 3950000,
      "pct_diff": 5.9
    }
  ]
}
```

### Final `"complete"` Event Detail

This is always the last event. Check `status` to determine success vs failure.

**Success:**
```json
{
  "type": "complete",
  "stage": "engine",
  "stageName": "Financial Model",
  "step": "Pipeline complete — 11 modules computed",
  "progress": 100,
  "stageProgress": 100,
  "status": "completed",
  "timestamp": "2026-01-01T10:00:00.000Z",
  "detail": {
    "modules_computed": ["IS-CON", "BS", "CF", "S&M", "G&A", "FA", "WC", "DEBT", "equity", "eosp", "valuation"],
    "lv1_results": { "IS-CON": "success", "BS": "success", "CF": "success" },
    "lv3_results": { "S&M": "success", "G&A": "success", "FA": "success", "WC": "success", "DEBT": "success" },
    "validation_warnings": [...],
    "data_quality_score": 95,
    "pdf_pages_processed": 42
  }
}
```

**Partial failure (engine crashed, earlier stages may have succeeded):**
```json
{
  "type": "complete",
  "stage": "engine",
  "status": "error",
  "detail": {
    "error": "DefaultsGenerator failed: no IS-CON data found",
    "lv1_results": { "IS-CON": "error: No Income Statement tables found", ... },
    "lv3_results": { ... },
    "pdf_pages_processed": 0
  }
}
```

**Warnings during extraction (pipeline continued):**
- Individual stages emit `status: "warning"` on `progress` events when a sub-step fails
- The pipeline always continues to the next stage regardless of per-step failures
- Only Stage 4 engine failure stops with `status: "error"` in the terminal event

---

## React.js Integration

### Minimal Working Hook

```typescript
// usePipeline.ts
import { useState, useCallback } from 'react';

export interface PipelineEvent {
  type: string;
  stage: string;
  stageName: string;
  step: string;
  progress: number;
  stageProgress: number;
  status: string;
  timestamp: string;
  detail?: Record<string, any>;
}

export interface PipelineState {
  running: boolean;
  progress: number;
  currentStage: string;
  currentStep: string;
  events: PipelineEvent[];
  result: PipelineEvent | null;  // the final "complete" event
  error: string | null;
}

export function usePipeline(baseUrl = '') {
  const [state, setState] = useState<PipelineState>({
    running: false,
    progress: 0,
    currentStage: '',
    currentStep: '',
    events: [],
    result: null,
    error: null,
  });

  const run = useCallback(async (params: {
    clientId: string;
    files: File[];
    years: number[];
    force?: boolean;
    dpi?: number;
  }) => {
    if (params.files.length !== params.years.length) {
      throw new Error('files and years arrays must be the same length');
    }

    setState(s => ({ ...s, running: true, progress: 0, events: [], result: null, error: null }));

    const fd = new FormData();
    fd.append('client_id', params.clientId);
    fd.append('years', JSON.stringify(params.years));
    fd.append('force', String(params.force ?? false));
    fd.append('dpi', String(params.dpi ?? 150));
    params.files.forEach(f => fd.append('files', f));

    try {
      const res = await fetch(`${baseUrl}/process-pipeline`, {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      if (!res.body) throw new Error('Response has no body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';  // keep the last incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: PipelineEvent = JSON.parse(line.slice(6));

            setState(s => ({
              ...s,
              progress: event.progress,
              currentStage: event.stageName,
              currentStep: event.step,
              events: [...s.events, event],
              result: event.type === 'complete' ? event : s.result,
              running: event.type !== 'complete',
            }));
          } catch {
            console.warn('Failed to parse SSE line:', line);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState(s => ({ ...s, running: false, error: message }));
    }
  }, [baseUrl]);

  return { state, run };
}
```

### Progress Component

```tsx
// PipelineProgress.tsx
import React from 'react';
import { usePipeline, PipelineEvent } from './usePipeline';

const STAGES = [
  { id: 'pdf_extraction',  label: 'PDF Extraction',           range: [0,  35] },
  { id: 'lv1_generation',  label: 'Historical Analysis (Lv1)', range: [35, 55] },
  { id: 'lv3_generation',  label: 'Detailed Analysis (Lv3)',   range: [55, 80] },
  { id: 'validation',      label: 'Data Validation',           range: [80, 85] },
  { id: 'engine',          label: 'Financial Model',           range: [85, 100] },
];

interface Props {
  clientId: string;
}

export function PipelineProgress({ clientId }: Props) {
  const { state, run } = usePipeline();

  const [files, setFiles] = React.useState<File[]>([]);
  const [years, setYears] = React.useState<string>('');  // comma-separated

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedYears = years.split(',').map(y => parseInt(y.trim(), 10));
    await run({ clientId, files, years: parsedYears });
  }

  function stageStatus(stageId: string): 'pending' | 'active' | 'completed' | 'warning' | 'error' {
    const stageEvents = state.events.filter(e => e.stage === stageId);
    if (!stageEvents.length) return 'pending';
    const last = stageEvents[stageEvents.length - 1];
    if (last.type === 'stage_complete' || (last.type === 'complete' && stageId === 'engine')) {
      if (last.status === 'error') return 'error';
      if (last.status === 'skipped') return 'completed';
      return stageEvents.some(e => e.status === 'warning') ? 'warning' : 'completed';
    }
    return 'active';
  }

  function lastStepForStage(stageId: string): string {
    const events = state.events.filter(e => e.stage === stageId);
    return events.length ? events[events.length - 1].step : '';
  }

  return (
    <div>
      {/* Upload form */}
      {!state.running && !state.result && (
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={e => setFiles(Array.from(e.target.files ?? []))}
          />
          <input
            type="text"
            placeholder="Years (e.g. 2024, 2023)"
            value={years}
            onChange={e => setYears(e.target.value)}
          />
          <button type="submit" disabled={!files.length || !years}>
            Run Pipeline
          </button>
        </form>
      )}

      {/* Overall progress bar */}
      {(state.running || state.result) && (
        <div>
          <div style={{ background: '#eee', borderRadius: 4, height: 8 }}>
            <div style={{
              background: state.result?.status === 'error' ? '#e53e3e' : '#38a169',
              width: `${state.progress}%`,
              height: '100%',
              borderRadius: 4,
              transition: 'width 0.3s',
            }} />
          </div>
          <p>{state.progress}% — {state.currentStep}</p>
        </div>
      )}

      {/* Stage breakdown */}
      {(state.running || state.result) && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {STAGES.map(stage => {
            const status = stageStatus(stage.id);
            const icon = {
              pending: '○',
              active: '◉',
              completed: '✓',
              warning: '⚠',
              error: '✗',
            }[status];
            const color = {
              pending: '#aaa',
              active: '#3182ce',
              completed: '#38a169',
              warning: '#d69e2e',
              error: '#e53e3e',
            }[status];

            return (
              <li key={stage.id} style={{ marginBottom: 8 }}>
                <span style={{ color, marginRight: 8 }}>{icon}</span>
                <strong>{stage.label}</strong>
                {status === 'active' && (
                  <span style={{ marginLeft: 8, color: '#666', fontSize: 13 }}>
                    {lastStepForStage(stage.id)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Final result */}
      {state.result && state.result.status === 'completed' && (
        <div style={{ background: '#f0fff4', border: '1px solid #38a169', padding: 16, borderRadius: 8 }}>
          <h3>Pipeline Complete</h3>
          <p>Data quality score: <strong>{state.result.detail?.data_quality_score}/100</strong></p>
          <p>Modules computed: {state.result.detail?.modules_computed?.join(', ')}</p>
          {state.result.detail?.validation_warnings?.length > 0 && (
            <details>
              <summary>{state.result.detail.validation_warnings.length} validation warning(s)</summary>
              <pre style={{ fontSize: 12 }}>
                {JSON.stringify(state.result.detail.validation_warnings, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {state.error && (
        <div style={{ background: '#fff5f5', border: '1px solid #e53e3e', padding: 16, borderRadius: 8 }}>
          <strong>Error:</strong> {state.error}
        </div>
      )}
    </div>
  );
}
```

---

## Validation Warnings — How to Present Them

Warnings arrive in the `stage_complete` event for `"validation"` and also in the final `"complete"` event detail. They are advisory — a warning does not mean the pipeline failed.

| `severity` | Meaning | Recommended UI treatment |
|-----------|---------|--------------------------|
| `"warning"` | Minor discrepancy (< 15%) | Yellow badge, collapsible |
| `"critical"` | Large discrepancy or BS imbalance | Red badge, expanded by default |

The `data_quality_score` is `max(0, 100 - criticals×20 - warnings×3)`. A score ≥ 80 is acceptable for most use cases.

---

## Error Handling Rules

| Scenario | What the API does | What the client should do |
|----------|------------------|--------------------------|
| `len(years) ≠ len(files)` | `HTTP 400` before stream starts | Show form validation error |
| Invalid `years` JSON | `HTTP 400` before stream starts | Show "years must be a JSON array" |
| PDF extraction page fails | `progress` event with `status: "warning"` | Show warning badge on Stage 0 |
| Lv1/Lv3 module fails | `progress` event with `status: "warning"` | Show warning badge on that stage |
| Stage 0–3 fully fails | Emits warning, continues to next stage | Keep progress moving |
| Stage 4 engine crashes | `complete` event with `status: "error"` | Show full error message |
| Network disconnect mid-stream | Stream terminates | Show "Connection lost — please retry" |
| Long silence (> 3 min) | Normal — Gemini AI calls can be slow | Show spinner / "AI is working…" |

---

## Re-Running the Pipeline

**Scenario: update financial data (new PDFs):**
```js
fd.append('force', 'true');  // re-extracts PDFs even if statements exist
```

**Scenario: re-run model only (PDFs already extracted):**
```js
fd.append('force', 'false'); // Stage 0 skips instantly, picks up at Lv1
```

**Scenario: add a new year to an existing client:**
- Upload only the new year's PDF
- Set `years=[2025]` (just the new year)
- `force=false` — existing years are untouched, new year is appended

---

## CORS

If the React app is served from a different origin than the API, the API must have CORS configured. Check `main.py` for `CORSMiddleware`. If CORS is not configured, add it:

```python
# In main.py, before route registration:
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Important for streaming:** The `fetch` call does NOT need special headers. Streaming works natively with `fetch` + `ReadableStream`. Do NOT use `EventSource` for this endpoint — it is a POST request and `EventSource` only supports GET.

---

## Data Available After Pipeline Completes

Once the `"complete"` event arrives with `status: "completed"`, these engine endpoints are ready:

| Endpoint | Returns |
|----------|---------|
| `GET /engine/results/{client_id}/IS-CON` | Income statement (historical + 5-year forecast) |
| `GET /engine/results/{client_id}/BS` | Balance sheet (historical + 5-year forecast) |
| `GET /engine/results/{client_id}/CF` | Cash flow statement (historical + 5-year forecast) |
| `GET /engine/results/{client_id}/equity` | Equity movements |
| `GET /engine/results/{client_id}/eosp` | End-of-service projections |
| `GET /engine/results/{client_id}/valuation` | DCF + comps valuation |
| `GET /engine/results/{client_id}` | All modules in one call |
| `GET /engine/export/{client_id}` | Full Excel workbook download |
| `GET /engine/validate/{client_id}` | BS balance check + data quality score |

All results include both historical years and 5 forecast years. Year keys are 4-digit strings (`"2022"`, `"2023"`, ...).

---

## Sequence Diagram

```
React Client                          API Server
     │                                     │
     │  POST /process-pipeline             │
     │  (multipart: files + years)         │
     ├────────────────────────────────────►│
     │                                     │ Stage 0: check statements exist
     │  data: {stage_start, pdf, 0%}       │
     │◄────────────────────────────────────┤
     │  data: {stage_complete, skipped}    │  (skipped if data exists)
     │◄────────────────────────────────────┤
     │                                     │ Stage 1: call Gemini for IS-CON
     │  data: {progress, lv1, 35%}         │
     │◄────────────────────────────────────┤
     │  data: {progress, lv1, 41%}  ✓     │  IS-CON done
     │◄────────────────────────────────────┤
     │  data: {progress, lv1, 48%}  ✓     │  BS done
     │◄────────────────────────────────────┤
     │  data: {progress, lv1, 55%}  ✓     │  CF done
     │◄────────────────────────────────────┤
     │  data: {stage_complete, lv1, 55%}   │
     │◄────────────────────────────────────┤
     │                                     │ Stage 2: Lv3 agents (5×)
     │  data: {progress, lv3, 55–80%}      │
     │◄────────────────────────────────────┤
     │  data: {stage_complete, lv3, 80%}   │
     │◄────────────────────────────────────┤
     │                                     │ Stage 3: Validation
     │  data: {stage_complete, val, 85%}   │
     │◄────────────────────────────────────┤
     │                                     │ Stage 4: Engine
     │  data: {progress, engine, 90%}      │
     │◄────────────────────────────────────┤
     │  data: {complete, engine, 100%}     │  ← final event
     │◄────────────────────────────────────┤
     │                                     │
     │  [stream ends]                      │
     │                                     │
     │  GET /engine/results/{id}/IS-CON    │  fetch results for display
     ├────────────────────────────────────►│
     │  { data: { revenue: {...}, ... } }  │
     │◄────────────────────────────────────┤
```

---

## Quick Reference

```bash
# Minimal curl smoke test
curl -X POST http://localhost:8000/process-pipeline \
  -F "client_id=my-client-001" \
  -F "years=[2024]" \
  -F "force=false" \
  -F "files=@annual_report_2024.pdf" \
  --no-buffer

# Force re-extraction (replaces existing statement data)
curl -X POST http://localhost:8000/process-pipeline \
  -F "client_id=my-client-001" \
  -F "years=[2024,2023]" \
  -F "force=true" \
  -F "files=@report_2024.pdf" \
  -F "files=@report_2023.pdf" \
  --no-buffer

# After pipeline completes — fetch results
curl http://localhost:8000/engine/results/my-client-001/IS-CON

# Download Excel workbook
curl -O http://localhost:8000/engine/export/my-client-001
```

---

## Source Files (for reference)

| File | Role |
|------|------|
| `app/api/pipeline.py` | Endpoint implementation, all helper functions |
| `app/api/AgentixPdf.py` | Registers pipeline routes via `register_pipeline_routes(app, db)` |
| `app/agents/historical_generation/routes.py` | `_generate_*_historical` and `_validate_historical` functions |
| `app/agents/historical_generation/agent.py` | `run_historical_agent(client_id, code, force)` |
| `app/engine/defaults_generator.py` | `DefaultsGenerator.generate(client_id, repo)` |
| `app/engine/orchestrator.py` | `FinancialModelOrchestrator.run_full_model(client_id, assumptions)` |
| `app/engine/firestore_repo.py` | All Firestore read/write operations |
| `app/core/documents/backend_docs.md` | Full engine API reference |
