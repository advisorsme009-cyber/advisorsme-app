import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Stack,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Divider,
  Snackbar,
} from "@mui/material";
import {
  AutoFixHighOutlined,
  FileDownloadOutlined,
  RefreshOutlined,
  CheckCircleOutlined,
  WarningAmberOutlined,
  UndoOutlined,
  SaveOutlined,
  EditOutlined,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useEngine } from "./context/EngineContext";
import { useSettings } from "./context/SettingsContext";
import SectionCard from "./assumptions/SectionCard";
import FieldRenderer from "./assumptions/FieldRenderer";
import { getFieldLabel } from "./assumptions/fieldMeta";
import { engineFormatNumber, engineFormatPercent } from "./utils/engineFormatNumber";

// Sections shown on the page, in order. Each maps to a top-level key in the
// assumptions object. `opex` is split into two child sections so we can pass
// the right module hint to LineItemRow.
const SECTIONS = [
  {
    id: "general",
    title: "General & FX Rates",
    description: "Reporting year, currency, and foreign exchange rates.",
    keys: ["general", "rates"],
  },
  {
    id: "revenue",
    title: "Revenue & Margins",
    description: "Top-line growth and gross profit margin per forecast year.",
    keys: ["revenue", "margins"],
  },
  {
    id: "sm_expenses",
    title: "Selling & Marketing Expenses",
    description: "Line-item drivers for S&M. Each row has its own growth driver.",
    path: "opex.sm_expenses",
    moduleHint: "S&M",
  },
  {
    id: "ga_expenses",
    title: "General & Administrative Expenses",
    description: "Line-item drivers for G&A.",
    path: "opex.ga_expenses",
    moduleHint: "G&A",
  },
  {
    id: "working_capital",
    title: "Working Capital",
    description: "Days-of-sales / days-of-COGS assumptions driving current assets and liabilities.",
    keys: ["working_capital"],
  },
  {
    id: "capex",
    title: "CapEx & Depreciation",
    description: "Capital expenditure as % of opening PP&E; depreciation rates per asset class.",
    keys: ["capex", "depreciation_rates"],
  },
  {
    id: "debt",
    title: "Debt",
    description: "Financing rate, repayments, and new borrowings.",
    keys: ["debt"],
  },
  {
    id: "other",
    title: "Other",
    description: "Zakat, EOSB, dividends, statutory reserve.",
    keys: ["other"],
  },
  {
    id: "valuation",
    title: "Valuation",
    description: "DCF and comparable-companies inputs (optional).",
    keys: ["valuation"],
    conditional: true,
  },
];

// Pull the last year key out of a per-year dict (or return null)
function lastYearValue(obj) {
  if (!obj || typeof obj !== "object") return null;
  const years = Object.keys(obj).filter((k) => /^\d{4}$/.test(k)).sort();
  if (years.length === 0) return null;
  return obj[years[years.length - 1]];
}

// KPI card
function KpiCard({ label, value, suffix, isLoading, severity }) {
  const color =
    severity === "error" ? "#c62828" : severity === "ok" ? "#2e7d32" : "#0A1E37";
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        flex: "1 1 160px",
        minWidth: 160,
        borderRadius: 2,
        position: "relative",
        opacity: isLoading ? 0.55 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}
      >
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, color, mt: 0.5 }}>
        {value}
        {suffix && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
            {suffix}
          </Typography>
        )}
      </Typography>
      {isLoading && (
        <CircularProgress
          size={14}
          sx={{ position: "absolute", top: 10, right: 10, color: "#1F559B" }}
        />
      )}
    </Paper>
  );
}

export default function AssumptionsPage() {
  const navigate = useNavigate();
  const { clientId } = useSettings();
  const {
    assumptions,
    results,
    loading,
    error,
    assumptionsLoading,
    patching,
    generatingDefaults,
    generateDefaults,
    saveFullAssumptions,
    recalculate,
    setError,
  } = useEngine();

  const [localAssumptions, setLocalAssumptions] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  // Sync local state from committed assumptions when not dirty.
  // Edits stay local until the user presses Save.
  useEffect(() => {
    if (!isDirty && assumptions) {
      setLocalAssumptions(JSON.parse(JSON.stringify(assumptions)));
    }
  }, [assumptions, isDirty]);

  // Reset local state and dirty flag when the active client changes.
  useEffect(() => {
    setIsDirty(false);
    setLocalAssumptions(assumptions ? JSON.parse(JSON.stringify(assumptions)) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const data = localAssumptions;

  // Compute KPIs from results
  const kpis = useMemo(() => {
    if (!results) return null;
    const is = results["IS-CON"];
    const bs = results["BS"];
    const cf = results["CF"];
    const revenueRow = is?.revenue;
    const ebitdaRow = is?.EBITDA;
    const niRow = is?.netIncomeLoss;
    const fcfRow = cf?.freeCashFlows;
    const totalAssets = bs?.totalAssets;
    const totalLE = bs?.totalLiabilitiesAndEquity;

    const revenue = lastYearValue(revenueRow);
    const ebitda = lastYearValue(ebitdaRow);
    const ebitdaMargin = revenue && ebitda ? ebitda / revenue : null;
    const netIncome = lastYearValue(niRow);
    const fcf = lastYearValue(fcfRow);
    const assets = lastYearValue(totalAssets);
    const le = lastYearValue(totalLE);
    const balanceCheck = assets !== null && le !== null ? assets - le : null;

    return { revenue, ebitdaMargin, netIncome, fcf, balanceCheck };
  }, [results]);

  const handleFieldChange = (path, value) => {
    // Skip intermediate typing
    if (value === "-" || value === "." || value === "-.") return;

    setLocalAssumptions((prev) => {
      const base = prev ? JSON.parse(JSON.stringify(prev)) : {};
      const parts = path.split(".");
      let cursor = base;
      for (let i = 0; i < parts.length - 1; i++) {
        if (cursor[parts[i]] === null || cursor[parts[i]] === undefined) {
          cursor[parts[i]] = {};
        }
        cursor = cursor[parts[i]];
      }
      cursor[parts[parts.length - 1]] = value;
      return base;
    });
    setIsDirty(true);
  };

  const handleGenerateDefaults = async () => {
    const generated = await generateDefaults(false);
    if (generated) {
      setLocalAssumptions(generated);
      setIsDirty(true);
      setSnackbar({
        open: true,
        message: "Defaults generated — review and press Save to apply.",
      });
    }
  };

  const handleSaveAndRecalculate = async () => {
    if (!localAssumptions || !isDirty) return;
    setSaving(true);
    try {
      await saveFullAssumptions(localAssumptions);
      await recalculate();
      setIsDirty(false);
      setSnackbar({ open: true, message: "Assumptions saved and model recalculated." });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setLocalAssumptions(assumptions ? JSON.parse(JSON.stringify(assumptions)) : null);
    setIsDirty(false);
    setSnackbar({ open: true, message: "Changes discarded." });
  };

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assumptions-${clientId || "unknown"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Empty/guard states
  if (!clientId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          Please set a Client ID in Settings to edit assumptions.
        </Alert>
      </Box>
    );
  }

  const visibleSections = SECTIONS.filter((s) => {
    if (!s.conditional) return true;
    return data && s.keys && s.keys.some((k) => data[k] !== undefined && data[k] !== null);
  });

  const balanceIsOk =
    kpis?.balanceCheck !== null &&
    kpis?.balanceCheck !== undefined &&
    Math.abs(kpis.balanceCheck) < 1;

  return (
    <Container maxWidth="xl" sx={{ pb: 6 }}>
      {/* Sticky header strip */}
      <Paper
        elevation={0}
        sx={{
          position: "sticky",
          top: 64, // below the AppBar
          zIndex: 10,
          background: "linear-gradient(to right, #ffffff 0%, #f5f9ff 100%)",
          borderBottom: "1px solid #e0e0e0",
          mx: -3,
          px: 3,
          py: 2,
          mb: 3,
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#1F559B" }}>
                Assumptions
              </Typography>
              <Chip label={clientId} size="small" variant="outlined" />
              {isDirty && (
                <Chip
                  size="small"
                  icon={<EditOutlined sx={{ fontSize: 14 }} />}
                  label="Unsaved changes"
                  color="warning"
                  variant="outlined"
                />
              )}
              {(saving || patching) && (
                <Chip
                  size="small"
                  icon={<CircularProgress size={12} />}
                  label={saving ? "Saving" : "Recalculating"}
                  color="warning"
                  variant="outlined"
                />
              )}
              {!isDirty && !saving && !patching && !loading && results && (
                <Chip
                  size="small"
                  icon={<CheckCircleOutlined sx={{ fontSize: 14 }} />}
                  label="In sync"
                  color="success"
                  variant="outlined"
                />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Edit any value below, then press <strong>Save &amp; Recalculate</strong> to apply changes to the model.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshOutlined />}
              onClick={() => navigate("/FinancialModel")}
            >
              Back to Model
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadOutlined />}
              onClick={handleExportJson}
              disabled={!data}
            >
              Export JSON
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={
                generatingDefaults ? <CircularProgress size={14} /> : <AutoFixHighOutlined />
              }
              onClick={handleGenerateDefaults}
              disabled={generatingDefaults || saving}
            >
              {generatingDefaults ? "Generating..." : "Generate Defaults"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<UndoOutlined />}
              onClick={handleDiscard}
              disabled={!isDirty || saving}
            >
              Discard
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlined />}
              onClick={handleSaveAndRecalculate}
              disabled={!isDirty || saving || patching || loading}
              sx={{ backgroundColor: "#1F559B" }}
            >
              {saving ? "Saving..." : "Save & Recalculate"}
            </Button>
          </Stack>
        </Stack>

        {/* KPI strip */}
        {kpis && (
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <KpiCard
              label="Revenue (latest)"
              value={engineFormatNumber(kpis.revenue)}
              suffix="SAR"
              isLoading={loading || patching}
            />
            <KpiCard
              label="EBITDA Margin"
              value={engineFormatPercent(kpis.ebitdaMargin)}
              isLoading={loading || patching}
            />
            <KpiCard
              label="Net Income"
              value={engineFormatNumber(kpis.netIncome)}
              suffix="SAR"
              isLoading={loading || patching}
            />
            <KpiCard
              label="Free Cash Flow"
              value={engineFormatNumber(kpis.fcf)}
              suffix="SAR"
              isLoading={loading || patching}
            />
            <KpiCard
              label="Balance Check"
              value={
                kpis.balanceCheck === null
                  ? "—"
                  : balanceIsOk
                  ? "0"
                  : engineFormatNumber(kpis.balanceCheck)
              }
              suffix={balanceIsOk ? "✓" : null}
              isLoading={loading || patching}
              severity={
                kpis.balanceCheck === null ? null : balanceIsOk ? "ok" : "error"
              }
            />
          </Stack>
        )}
      </Paper>

      {/* Unsaved-changes reminder */}
      {isDirty && (
        <Alert severity="warning" icon={<EditOutlined />} sx={{ mb: 3 }}>
          You have unsaved changes. Press <strong>Save &amp; Recalculate</strong> to apply them, or <strong>Discard</strong> to revert.
        </Alert>
      )}

      {/* Global error */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          onClose={() => setError(null)}
          icon={<WarningAmberOutlined />}
        >
          {error}
        </Alert>
      )}

      {/* No assumptions yet */}
      {!data && !assumptionsLoading && !generatingDefaults && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            No assumptions configured yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Generate defaults from historical data to get started. You can edit them before saving.
          </Typography>
          <Button
            variant="contained"
            startIcon={
              generatingDefaults ? <CircularProgress size={16} /> : <AutoFixHighOutlined />
            }
            onClick={handleGenerateDefaults}
            disabled={generatingDefaults}
            sx={{ backgroundColor: "#1F559B" }}
          >
            {generatingDefaults ? "Generating..." : "Generate Default Assumptions"}
          </Button>
        </Paper>
      )}

      {/* Loading */}
      {assumptionsLoading && !data && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Sections — two-column layout */}
      {data && (
        <Grid container spacing={3}>
          {/* Section nav */}
          <Grid item xs={12} md={3}>
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 2,
                position: { md: "sticky" },
                top: { md: 260 },
              }}
            >
              <List dense>
                {visibleSections.map((s, idx) => (
                  <React.Fragment key={s.id}>
                    {idx > 0 && <Divider component="li" />}
                    <ListItemButton
                      selected={activeSection === s.id}
                      onClick={() => {
                        setActiveSection(s.id);
                        const el = document.getElementById(s.id);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      sx={{
                        "&.Mui-selected": {
                          borderLeft: "3px solid #1F559B",
                          backgroundColor: "rgba(31, 85, 155, 0.08)",
                        },
                      }}
                    >
                      <ListItemText
                        primary={s.title}
                        primaryTypographyProps={{
                          fontSize: 13,
                          fontWeight: activeSection === s.id ? 700 : 500,
                        }}
                      />
                    </ListItemButton>
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          </Grid>

          {/* Section content */}
          <Grid item xs={12} md={9}>
            <Stack spacing={3}>
              {visibleSections.map((s) => {
                // Single-path section (sm_expenses, ga_expenses)
                if (s.path) {
                  const parts = s.path.split(".");
                  let node = data;
                  for (const p of parts) {
                    node = node?.[p];
                  }
                  return (
                    <SectionCard
                      key={s.id}
                      id={s.id}
                      title={s.title}
                      description={s.description}
                      data={node}
                      basePath={s.path}
                      onFieldChange={handleFieldChange}
                      moduleHint={s.moduleHint}
                    />
                  );
                }

                // Multi-key section (e.g. general + rates) — one SectionCard wrapping all keys
                // To keep things simple, merge their data into a single object under a synthetic path.
                // We render each key in turn inside a single card.
                return (
                  <Paper
                    key={s.id}
                    id={s.id}
                    variant="outlined"
                    sx={{ borderRadius: 2, p: 3, scrollMarginTop: 96 }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#0A1E37", mb: 0.5 }}>
                      {s.title}
                    </Typography>
                    {s.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {s.description}
                      </Typography>
                    )}
                    <Stack spacing={3} sx={{ mt: 2 }}>
                      {s.keys.map((k) => {
                        const sub = data[k];
                        if (sub === undefined || sub === null) {
                          return (
                            <Alert
                              key={k}
                              severity="info"
                              variant="outlined"
                              sx={{ py: 0.5 }}
                            >
                              {getFieldLabel(k)} not configured.
                            </Alert>
                          );
                        }
                        return (
                          <Box key={k}>
                            {s.keys.length > 1 && (
                              <Typography
                                variant="subtitle2"
                                sx={{ fontWeight: 700, color: "#1F559B", mb: 1.5 }}
                              >
                                {getFieldLabel(k)}
                              </Typography>
                            )}
                            <FieldRenderer
                              value={sub}
                              path={k}
                              parentKey={k}
                              onFieldChange={handleFieldChange}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Grid>
        </Grid>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: "" })}
        message={snackbar.message}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Container>
  );
}
