# Historical Agent Workflow & Integration Guide

This document outlines how the Front End codebase (React.js) and Code Agents should interact with the Historical Generator capabilities of the system.

## Overview
The Historical Agent retrieves legacy financial statement table components and parses the unstructured table into structured `Level 3` Key-Value pair history points (over various years), saving them natively in the Firebase storage layer for retrieval later.

## Base URL
All routes are mounted dynamically depending on your environment, generally `<BASE_API_URL>`.

---

## 1. Manage Dynamic Document Codes
The Historical Agent doesn't have a hardcoded list of codes anymore. They map to specific Firebase financial buckets (both Primary tables and Notes tables).

### `GET /agents/historical/codes`
Fetches all currently valid and supported document codes the Historical Agent knows how to parse.

**Response (200 OK):**
```json
{
  "valid_codes": ["S&M", "G&A", "FA", "WC", "DEBT", "IS-CON"],
  "details": {
    "S&M": "Selling & Promotion Expenses",
    "G&A": "General & Administrative Expenses",
    "IS-CON": "Statement of Comprehensive Income"
  },
  "full_mappings": {
    "S&M": {
      "full_name": "Selling & Promotion Expenses",
      "primary_bucket": "Statement of Comprehensive Income",
      "note_bucket": "Notes of Statement of Comprehensive Income"
    }
  }
}
```

### `POST /agents/historical/codes`
Allows the user/frontend to register new processing mappings for the AI. For example, adding an entire structural line object dynamically.

**Request Body:**
```json
{
  "code": "IS-CON",
  "full_name": "Statement of Comprehensive Income",
  "primary_bucket": "Statement of Comprehensive Income",
  "note_bucket": "Notes of Statement of Comprehensive Income"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Added new mapping for IS-CON"
}
```

---

## 2. Generate and Retrieve Historical Data
The main workhorse of the integration. Triggering this checks if previous configurations generated cached data in Firebase first (instantly returning it to prevent unnecessary AI costs). If it doesn't exist, it kicks off a generative task to build and save it.

### `POST /agents/historical/generate`
Generates (or retrieves) Level 3 Historical data points for a given customer and section mapping.

**Request Body:**
```json
{
  "client_id": "pwc-test-123456",
  "document_code": "S&M"
}
```

**Response (200 OK — Newly Generated):**
```json
{
  "status": "success",
  "document_code": "S&M",
  "client_id": "pwc-test-123456",
  "agent_response": "✅ Successfully saved historical Lv3 data for 'S&M' (client: pwc-test-123456).",
  "details": null
}
```

**Response (200 OK — Cached & Instant Return):**
```json
{
  "status": "success",
  "document_code": "S&M",
  "client_id": "pwc-test-123456",
  "agent_response": "Data already existed and was loaded from cache for 'S&M'.",
  "details": {
    "sellingAndPromotion": {
      "2017": 55566,
      "2018": 57241,
      "2019": 0,
      "base_kpi": "YoY%",
      "param_name": "Selling and promotion"
    }
  }
}
```

---

## Front-End React Component State Schema Recommendations

The Frontend architecture orchestrating the Historical AI Data Pipeline needs a few robust interactive layers.

### **1. Mapping Management View (Admin / Configuration Panel)**
Users should be able to view and associate new financial statements to AI buckets so the agent knows where to fetch specific contexts.

**Required State Schema:**
```javascript
const [documentCodes, setDocumentCodes] = useState([]);
/* 
  Schema: Array<{
    code: string,
    fullName: string,
    primaryBucket: string,
    noteBucket: string
  }>
*/

const [newMappingForm, setNewMappingForm] = useState({
  code: '',
  full_name: '',
  primary_bucket: '',
  note_bucket: ''
});
```
* **UI Structure**: A list or datagrid showing current mappings. A distinct CTA / Modal popup bound to `newMappingForm` taking strings, allowing users to map arbitrary internal tags to comprehensive Firebase buckets, saving to `POST /agents/historical/codes`.

### **2. Generation Dashboard View**
The core generation pane, where users kick off generation and view the status or resulting matrix.

**Required State Schema:**
```javascript
// Selecting context context
const [selectedClientId, setSelectedClientId] = useState("");
const [selectedDocumentCode, setSelectedDocumentCode] = useState("");

// Request lifecycle state
const [isGenerating, setIsGenerating] = useState(false);
const [generationStatus, setGenerationStatus] = useState(null); // 'success' | 'error' | null
const [agentLogs, setAgentLogs] = useState(""); 

// Cached Result Context
const [historicalDataMatrix, setHistoricalDataMatrix] = useState(null);
/*
  Schema: Record<string, {
     base_kpi: string,
     param_name: string,
     [year_keys]: number
  }>
*/
```
* **UI Structure**:
    1. **Selectors**: Dropdowns for Client Pipeline and Valid Document Codes (fetched from `GET /agents/historical/codes`).
    2. **Trigger Action**: A `Run Agent` Primary Button. Show a loading overlay (`isGenerating`) since AI tasks take an unpredictable number of loops.
    3. **Results Output Table**: 
       * Because the `historicalDataMatrix` format is highly variable dynamic JSON, iterating `Object.keys()` over the payload details is required.
       * Render a dynamic Data Table where columns are determined by filtering map keys for digits (e.g. `2017`, `2018`) alongside `param_name`.
