import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Snackbar,
} from "@mui/material";
import {
  TuneOutlined,
  RefreshOutlined,
  AutoFixHighOutlined,
  FileDownloadOutlined,
} from "@mui/icons-material";
import { useEngine } from "./context/EngineContext";
import { useSettings } from "./context/SettingsContext";
import useEngineExport from "./hooks/useEngineExport";
import CorporateFinancialTableView from "./utils/CorporateFinancialTableView";
import { engineFormatNumber, engineFormatPercent } from "./utils/engineFormatNumber";

const MODULES = [
  { key: "IS-CON", label: "Income Statement" },
  { key: "BS", label: "Balance Sheet" },
  { key: "CF", label: "Cash Flow" },
  { key: "S&M", label: "Sales & Marketing" },
  { key: "G&A", label: "General & Admin" },
  { key: "FA", label: "Fixed Assets" },
  { key: "WC", label: "Working Capital" },
  { key: "DEBT", label: "Debt" },
  { key: "equity", label: "Equity" },
  { key: "eosp", label: "EOSP" },
];

// Row keys that should render bold (totals/subtotals)
const BOLD_ROW_KEYS = {
  "IS-CON": [
    "grossProfit",
    "totalExpenses",
    "operatingProfit",
    "EBITDA",
    "netIncomeLoss",
  ],
  BS: [
    "totalCurrentAssets",
    "totalNonCurrentAssets",
    "totalAssets",
    "totalCurrentLiabilities",
    "totalNonCurrentLiabilities",
    "totalLiabilities",
    "totalEquity",
    "totalLiabilitiesAndEquity",
  ],
  CF: [
    "cashFlowFromOperations",
    "cashFlowFromInvesting",
    "cashFlowFromFinancing",
    "netChangeInCash",
    "closingCash",
  ],
  "S&M": ["totalSellingMarketingExpenses"],
  "G&A": ["totalGeneralAdminExpenses"],
  FA: ["closingNBV"],
  WC: ["operatingWorkingCapital", "changeInWorkingCapital"],
  DEBT: ["closingBalance"],
  equity: ["totalEquity"],
  eosp: ["terminationBenefits"],
};

// Analytics config per module — which keys to show and how to format
const MODULE_ANALYTICS = {
  "IS-CON": {
    title: "Key Indicators",
    format: "percent",
    keys: [
      { key: "salesGrowthYoY", label: "Sales annual growth" },
      { key: "smGrowthYoY", label: "S&M annual growth" },
      { key: "gaGrowthYoY", label: "G&A annual growth" },
      { key: "smPctOfRevenue", label: "S&M as % of revenue" },
      { key: "gaPctOfRevenue", label: "G&A as % of revenue" },
      { key: "grossProfitMargin", label: "Gross profit margin" },
      { key: "operatingProfitMargin", label: "Operating profit margin" },
      { key: "EBITDAMargin", label: "EBITDA margin" },
      { key: "netIncomeMargin", label: "Net income margin" },
    ],
  },
  BS: {
    title: "Key Ratios",
    format: "mixed",
    keys: [
      { key: "currentRatio", label: "Current Ratio", format: "ratio" },
      { key: "leverageRatio", label: "Leverage Ratio", format: "ratio" },
      { key: "roa", label: "Return on Assets (ROA)", format: "percent" },
      { key: "roe", label: "Return on Equity (ROE)", format: "percent" },
    ],
  },
  CF: {
    title: "Key Indicators",
    format: "currency",
    keys: [
      { key: "freeCashFlow", label: "Free Cash Flow (FCF)", format: "currency" },
    ],
  },
  WC: {
    title: "Key Indicators (Days)",
    format: "days",
    keys: [
      { key: "tradeReceivablesDays", label: "Trade Receivables (Days Sales)" },
      { key: "dueFromRelatedPartiesDays", label: "Due from Related Parties (Days Sales)" },
      { key: "inventoriesDays", label: "Inventories (Days COGS)" },
      { key: "prepaymentsDays", label: "Prepayments (Days COGS)" },
      { key: "tradePayablesDays", label: "Trade Payables (Days COGS)" },
      { key: "accruedExpensesDays", label: "Accrued Expenses (Days COGS)" },
    ],
  },
  DEBT: {
    title: "Key Indicators",
    format: "percent",
    keys: [
      { key: "financingRate", label: "Financing Rate" },
    ],
  },
  equity: {
    title: "Key Indicators",
    format: "percent",
    keys: [
      { key: "dividendPayoutRatio", label: "Dividend Payout Ratio" },
    ],
  },
};

// Per-item analytics panels for S&M and G&A
const PER_ITEM_ANALYTICS = {
  "S&M": {
    summaryKeys: [
      { key: "smPctOfRevenue", label: "S&M as % of Revenue" },
      { key: "smAnnualGrowth", label: "S&M Annual Growth" },
    ],
    panels: [
      { key: "pctOfRevenue", label: "% of Revenue" },
      { key: "annualGrowth", label: "Annual Growth" },
      { key: "commonSize", label: "Common Size" },
    ],
  },
  "G&A": {
    summaryKeys: [
      { key: "gaPctOfRevenue", label: "G&A as % of Revenue" },
      { key: "gaAnnualGrowth", label: "G&A Annual Growth" },
    ],
    panels: [
      { key: "pctOfRevenue", label: "% of Revenue" },
      { key: "annualGrowth", label: "Annual Growth" },
      { key: "commonSize", label: "Common Size" },
    ],
  },
};

function formatAnalyticsValue(value, format) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (isNaN(n)) return "—";
  if (format === "percent") return engineFormatPercent(n);
  if (format === "ratio") return `${n.toFixed(2)}x`;
  if (format === "days") return n.toFixed(1);
  if (format === "currency") return engineFormatNumber(n);
  return engineFormatPercent(n);
}

// Render simple analytics table (IS-CON, BS, CF, WC, DEBT, equity)
function AnalyticsSection({ analytics, moduleKey, forecastStartYear }) {
  const config = MODULE_ANALYTICS[moduleKey];
  if (!config || !analytics) return null;

  // Build a data object suitable for CorporateFinancialTableView
  const tableData = {};
  for (const { key, label, format: itemFormat } of config.keys) {
    const metric = analytics[key];
    if (!metric) continue;
    // Use the param_name from the metric or our label
    tableData[key] = { ...metric, param_name: metric.param_name || label };
  }

  if (Object.keys(tableData).length === 0) return null;

  const defaultFormat = config.format || "percent";

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: "#1F559B" }}>
        {config.title}
      </Typography>
      <CorporateFinancialTableView
        data={tableData}
        title={config.title}
        formatNumber={(num) => {
          // Determine format from the config keys
          const keyEntry = config.keys.find((k) => k.format);
          const fmt = keyEntry?.format || defaultFormat;
          return formatAnalyticsValue(num, fmt);
        }}
        forecastStartYear={forecastStartYear}
      />
    </Box>
  );
}

// Per-item analytics for S&M / G&A
function PerItemAnalyticsSection({ analytics, moduleKey, forecastStartYear }) {
  const config = PER_ITEM_ANALYTICS[moduleKey];
  if (!config || !analytics) return null;

  return (
    <Box sx={{ mt: 3 }}>
      {/* Summary indicators */}
      {(() => {
        const summaryData = {};
        for (const { key, label } of config.summaryKeys) {
          if (analytics[key]) {
            summaryData[key] = { ...analytics[key], param_name: analytics[key].param_name || label };
          }
        }
        if (Object.keys(summaryData).length === 0) return null;
        return (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: "#1F559B" }}>
              Key Indicators
            </Typography>
            <CorporateFinancialTableView
              data={summaryData}
              title="Key Indicators"
              formatNumber={(num) => formatAnalyticsValue(num, "percent")}
              forecastStartYear={forecastStartYear}
            />
          </Box>
        );
      })()}

      {/* Per-item panels */}
      {config.panels.map(({ key, label }) => {
        const panelData = analytics[key];
        if (!panelData || typeof panelData !== "object") return null;
        return (
          <Box key={key} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: "#1F559B" }}>
              {label}
            </Typography>
            <CorporateFinancialTableView
              data={panelData}
              title={label}
              formatNumber={(num) => formatAnalyticsValue(num, "percent")}
              forecastStartYear={forecastStartYear}
            />
          </Box>
        );
      })}
    </Box>
  );
}

export default function FinancialModelPage() {
  const { clientId } = useSettings();
  const {
    assumptions,
    results,
    loading,
    error,
    assumptionsLoading,
    patching,
    generatingDefaults,
    recalculate,
    loadAllResults,
    loadAssumptions,
    generateDefaults,
    saveFullAssumptions,
    setError,
  } = useEngine();

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [exportSnackbar, setExportSnackbar] = useState({ open: false, message: "" });
  const { exportModule, exportAll, exporting, error: exportError, setError: setExportError } = useEngineExport();

  const handleExportModule = async () => {
    try {
      await exportModule(clientId, currentModule.key);
      setExportSnackbar({ open: true, message: `${currentModule.label} exported successfully!` });
    } catch { /* hook sets error */ }
  };

  const handleExportAll = async () => {
    try {
      await exportAll(clientId);
      setExportSnackbar({ open: true, message: "All modules exported successfully!" });
    } catch { /* hook sets error */ }
  };

  const currentModule = MODULES[activeTab];
  const moduleData = results?.[currentModule.key];
  const boldRows = BOLD_ROW_KEYS[currentModule.key] || [];

  // Determine forecast start year from assumptions
  const forecastStartYear = assumptions?.general?.reporting_date
    ? assumptions.general.reporting_date + 1
    : undefined;

  // Extract analytics — they may be under _analytics key or at the module level in results
  const moduleAnalytics = moduleData?._analytics || null;

  const handleRefresh = async () => {
    if (!clientId) return;
    await Promise.all([loadAllResults(clientId), loadAssumptions(clientId)]);
  };

  const handleGenerateDefaults = async () => {
    const generated = await generateDefaults(false);
    if (generated) {
      // Save and recalculate
      await saveFullAssumptions(generated);
      await recalculate();
    }
  };

  if (!clientId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Please set a Client ID in Settings to view the financial model.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1F559B" }}>
            Financial Model
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {clientId}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {patching && (
            <Chip
              size="small"
              label="Updating..."
              color="warning"
              variant="outlined"
              icon={<CircularProgress size={14} />}
            />
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshOutlined />}
            onClick={handleRefresh}
            disabled={loading}
            size="small"
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={
              exporting === currentModule.key ? (
                <CircularProgress size={14} />
              ) : (
                <FileDownloadOutlined />
              )
            }
            onClick={handleExportModule}
            disabled={!!exporting || !results}
            size="small"
          >
            Export {currentModule.label}
          </Button>
          <Button
            variant="outlined"
            startIcon={
              exporting === "all" ? (
                <CircularProgress size={14} />
              ) : (
                <FileDownloadOutlined />
              )
            }
            onClick={handleExportAll}
            disabled={!!exporting || !results}
            size="small"
          >
            Export All
          </Button>
          <Button
            variant="contained"
            startIcon={<TuneOutlined />}
            onClick={() => navigate("/assumptions")}
            size="small"
            sx={{ backgroundColor: "#1F559B" }}
          >
            Assumptions
          </Button>
        </Stack>
      </Stack>

      {/* Error */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* No assumptions — generate defaults workflow */}
      {!assumptions && !loading && !assumptionsLoading && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={generatingDefaults ? <CircularProgress size={14} /> : <AutoFixHighOutlined />}
              onClick={handleGenerateDefaults}
              disabled={generatingDefaults}
            >
              {generatingDefaults ? "Generating..." : "Generate Default Assumptions"}
            </Button>
          }
        >
          No assumptions found for this client. Generate defaults from historical data to get started.
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 600,
              minWidth: 100,
            },
            "& .Mui-selected": {
              color: "#1F559B",
            },
            "& .MuiTabs-indicator": {
              backgroundColor: "#1F559B",
            },
          }}
        >
          {MODULES.map((m) => (
            <Tab key={m.key} label={m.label} />
          ))}
        </Tabs>
      </Box>

      {/* Content */}
      {loading && !results ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : !results ? (
        <Alert severity="info">
          No forecast data available. Save assumptions and run a recalculation first.
          <Button size="small" sx={{ ml: 1 }} onClick={recalculate}>
            Recalculate
          </Button>
        </Alert>
      ) : moduleData ? (
        <>
          <CorporateFinancialTableView
            data={moduleData}
            title={currentModule.label}
            formatNumber={engineFormatNumber}
            boldRows={boldRows}
            forecastStartYear={forecastStartYear}
          />

          {/* Analytics — S&M and G&A get per-item panels, others get simple table */}
          {PER_ITEM_ANALYTICS[currentModule.key] ? (
            <PerItemAnalyticsSection
              analytics={moduleAnalytics}
              moduleKey={currentModule.key}
              forecastStartYear={forecastStartYear}
            />
          ) : (
            <AnalyticsSection
              analytics={moduleAnalytics}
              moduleKey={currentModule.key}
              forecastStartYear={forecastStartYear}
            />
          )}
        </>
      ) : (
        <Alert severity="warning">
          No data available for {currentModule.label}. This module may not have been
          calculated yet.
        </Alert>
      )}

      {/* Export error */}
      {exportError && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setExportError(null)}>
          Export failed: {exportError}
        </Alert>
      )}

      <Snackbar
        open={exportSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setExportSnackbar({ open: false, message: "" })}
        message={exportSnackbar.message}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
