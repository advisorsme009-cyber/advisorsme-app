import React, { useState, useEffect, useMemo } from "react";
import {
  Drawer,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  IconButton,
  Stack,
  Divider,
  Chip,
  CircularProgress,
  Button,
  Alert,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  AutoFixHighOutlined,
  SaveOutlined,
} from "@mui/icons-material";
import { useEngine } from "./context/EngineContext";

const DRAWER_WIDTH = 480;

// Human-readable labels for assumption keys
const FIELD_LABELS = {
  // General
  reporting_date: "Reporting Date (Year)",
  currency: "Currency",
  // Rates
  fx_usd_sar: "USD / SAR",
  fx_gbp_sar: "GBP / SAR",
  fx_eur_sar: "EUR / SAR",
  // Revenue
  growth_yoy_pct: "Revenue Growth (YoY %)",
  // Margins
  gp_margin_sales_pct: "Gross Profit Margin (% of Sales)",
  // S&M
  target_sales_pct: "Target (% of Sales)",
  salaries_yoy_growth: "Salaries (YoY Growth)",
  repairs_maintenance_yoy_growth: "Repairs & Maintenance (YoY Growth)",
  rent_yoy_growth: "Rent (YoY Growth)",
  travel_communication_sales_pct: "Travel & Communication (% of Sales)",
  other_yoy_growth: "Other (YoY Growth)",
  // G&A
  target_yoy_growth_pct: "Target (YoY Growth %)",
  management_recharge_yoy_growth: "Management Recharge (YoY Growth)",
  professional_fees_yoy_growth: "Professional Fees (YoY Growth)",
  travel_yoy_growth: "Travel (YoY Growth)",
  stationary_yoy_growth: "Stationery (YoY Growth)",
  // Working Capital
  trade_receivables_days_sales: "Trade Receivables (Days of Sales)",
  due_from_related_parties_days_sales: "Due from Related Parties (Days)",
  inventories_days_cogs: "Inventories (Days of COGS)",
  prepayments_days_cogs: "Prepayments (Days of COGS)",
  trade_payables_days_cogs: "Trade Payables (Days of COGS)",
  accrued_expenses_days_cogs: "Accrued Expenses (Days of COGS)",
  due_to_related_parties_fixed_amount: "Due to Related Parties (Fixed)",
  // CapEx
  capex_pct_of_opening_balance: "CapEx (% of Opening Balance)",
  // Depreciation
  vehicles: "Vehicles",
  furniture_and_fixtures: "Furniture & Fixtures",
  office_equipment: "Office Equipment",
  computers: "Computers",
  leasehold_improvement: "Leasehold Improvement",
  // Other
  zakat_rate: "Zakat Rate",
  other_income_annual_growth_pct: "Other Income Growth (%)",
  eosb_pct: "EOSB (%)",
  dividend_payout_ratio: "Dividend Payout Ratio",
  statutory_reserve_pct: "Statutory Reserve (%)",
  statutory_reserve_cap_pct: "Statutory Reserve Cap (%)",
  // Debt
  financing_rate: "Financing Rate",
  annual_repayment: "Annual Repayment",
  new_borrowings: "New Borrowings",
};

// Sections definition matching the assumptions JSON structure
const SECTIONS = [
  { key: "general", label: "General", nested: false },
  { key: "rates", label: "FX Rates", nested: false },
  { key: "revenue", label: "Revenue", nested: false },
  { key: "margins", label: "Margins", nested: false },
  {
    key: "opex",
    label: "Operating Expenses",
    nested: true,
    children: [
      { key: "sm_expenses", label: "Selling & Marketing" },
      { key: "ga_expenses", label: "General & Administrative" },
    ],
  },
  { key: "working_capital", label: "Working Capital", nested: false },
  { key: "capex", label: "Capital Expenditure", nested: false },
  { key: "depreciation_rates", label: "Depreciation Rates", nested: false },
  { key: "other", label: "Other", nested: false },
  { key: "debt", label: "Debt", nested: false },
];

function getLabel(key) {
  return FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPerYearDict(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).every((k) => /^\d{4}$/.test(k));
}

// Formats display value for the text field
function displayValue(val) {
  if (val === null || val === undefined) return "";
  return String(val);
}

// Parse input back to number or null
function parseInput(str) {
  if (str === "" || str === null || str === undefined) return null;
  // Allow intermediate typing states
  if (str === "-" || str === "." || str === "-.") return str;
  const num = Number(str);
  return isNaN(num) ? str : num;
}

// Per-year row of inputs
function PerYearFields({ path, values, onFieldChange }) {
  if (!values || typeof values !== "object") return null;
  const years = Object.keys(values)
    .filter((k) => /^\d{4}$/.test(k))
    .sort();

  return (
    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
      {years.map((year) => (
        <TextField
          key={year}
          label={year}
          size="small"
          value={displayValue(values[year])}
          onChange={(e) => onFieldChange(`${path}.${year}`, parseInput(e.target.value))}
          sx={{ flex: 1, minWidth: 70 }}
          inputProps={{ style: { fontSize: 13, textAlign: "center" } }}
        />
      ))}
    </Stack>
  );
}

// Single flat field input
function FlatField({ path, value, label, onFieldChange }) {
  return (
    <TextField
      label={label}
      size="small"
      fullWidth
      value={displayValue(value)}
      onChange={(e) => onFieldChange(path, parseInput(e.target.value))}
      sx={{ mt: 0.5 }}
      inputProps={{ style: { fontSize: 13 } }}
    />
  );
}

// Renders all fields within a section object
function SectionFields({ sectionData, basePath, onFieldChange }) {
  if (!sectionData || typeof sectionData !== "object") return null;

  return (
    <Stack spacing={2}>
      {Object.entries(sectionData).map(([fieldKey, fieldValue]) => {
        const path = `${basePath}.${fieldKey}`;
        const label = getLabel(fieldKey);

        if (isPerYearDict(fieldValue)) {
          return (
            <Box key={fieldKey}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {label}
              </Typography>
              <PerYearFields path={path} values={fieldValue} onFieldChange={onFieldChange} />
            </Box>
          );
        }

        if (fieldValue !== null && typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
          // Nested object that isn't per-year — skip (handled by nested sections)
          return null;
        }

        return (
          <FlatField
            key={fieldKey}
            path={path}
            value={fieldValue}
            label={label}
            onFieldChange={onFieldChange}
          />
        );
      })}
    </Stack>
  );
}

export default function AssumptionsDrawer({ open, onClose }) {
  const {
    assumptions,
    assumptionsLoading,
    patching,
    generatingDefaults,
    queuePatch,
    generateDefaults,
    saveFullAssumptions,
    recalculate,
  } = useEngine();

  // Local copy for responsive editing
  const [localAssumptions, setLocalAssumptions] = useState(null);
  // Preview state for generated defaults (before saving)
  const [previewDefaults, setPreviewDefaults] = useState(null);

  // Sync local state when assumptions from context change (initial load or after patch)
  useEffect(() => {
    if (assumptions) {
      setLocalAssumptions(assumptions);
      setPreviewDefaults(null);
    }
  }, [assumptions]);

  const handleFieldChange = (path, value) => {
    // Update local state immediately
    setLocalAssumptions((prev) => {
      if (!prev) return prev;
      const parts = path.split(".");
      const next = JSON.parse(JSON.stringify(prev));
      let cursor = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cursor[parts[i]]) cursor[parts[i]] = {};
        cursor = cursor[parts[i]];
      }
      cursor[parts[parts.length - 1]] = value;
      return next;
    });

    // If we're in preview mode, also update the preview
    if (previewDefaults) {
      setPreviewDefaults((prev) => {
        if (!prev) return prev;
        const parts = path.split(".");
        const next = JSON.parse(JSON.stringify(prev));
        let cursor = next;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cursor[parts[i]]) cursor[parts[i]] = {};
          cursor = cursor[parts[i]];
        }
        cursor[parts[parts.length - 1]] = value;
        return next;
      });
      return;
    }

    // Don't send intermediate typing states to backend
    if (value === "-" || value === "." || value === "-.") return;

    // Queue the PATCH (debounced in EngineContext)
    queuePatch(path, value);
  };

  const handleGenerateDefaults = async () => {
    const generated = await generateDefaults(false);
    if (generated) {
      setPreviewDefaults(generated);
      setLocalAssumptions(generated);
    }
  };

  const handleSaveAndCalculate = async () => {
    if (!previewDefaults && !localAssumptions) return;
    const dataToSave = previewDefaults || localAssumptions;
    await saveFullAssumptions(dataToSave);
    setPreviewDefaults(null);
    await recalculate();
  };

  const data = localAssumptions;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          maxWidth: "90vw",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          background: "linear-gradient(to right, #0A1E37, #1F559B)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Assumptions
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {previewDefaults ? "Review generated defaults" : "Edit values to auto-recalculate"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {patching && <CircularProgress size={20} sx={{ color: "white" }} />}
          <IconButton onClick={onClose} sx={{ color: "white" }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      {/* Preview banner */}
      {previewDefaults && (
        <Alert
          severity="info"
          sx={{ borderRadius: 0 }}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<SaveOutlined />}
              onClick={handleSaveAndCalculate}
            >
              Save & Calculate
            </Button>
          }
        >
          Previewing generated defaults. Edit values, then save.
        </Alert>
      )}

      {/* Content */}
      <Box sx={{ overflow: "auto", flex: 1 }}>
        {assumptionsLoading && !data ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : !data ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              No assumptions loaded for this client.
            </Typography>
            <Button
              variant="contained"
              startIcon={generatingDefaults ? <CircularProgress size={16} /> : <AutoFixHighOutlined />}
              onClick={handleGenerateDefaults}
              disabled={generatingDefaults}
              sx={{ backgroundColor: "#1F559B" }}
            >
              {generatingDefaults ? "Generating..." : "Generate Default Assumptions"}
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              Analyzes historical data to derive sensible defaults
            </Typography>
          </Box>
        ) : (
          SECTIONS.map((section) => {
            if (section.nested && section.children) {
              return (
                <Accordion key={section.key} disableGutters defaultExpanded={false}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontWeight: 600 }}>{section.label}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    {section.children.map((child) => (
                      <Accordion key={child.key} disableGutters defaultExpanded={false} sx={{ boxShadow: "none" }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ pl: 3 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {child.label}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 3, pb: 2 }}>
                          <SectionFields
                            sectionData={data?.[section.key]?.[child.key]}
                            basePath={`${section.key}.${child.key}`}
                            onFieldChange={handleFieldChange}
                          />
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </AccordionDetails>
                </Accordion>
              );
            }

            return (
              <Accordion key={section.key} disableGutters defaultExpanded={section.key === "revenue"}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ fontWeight: 600 }}>{section.label}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, pb: 2 }}>
                  <SectionFields
                    sectionData={data?.[section.key]}
                    basePath={section.key}
                    onFieldChange={handleFieldChange}
                  />
                </AccordionDetails>
              </Accordion>
            );
          })
        )}
      </Box>
    </Drawer>
  );
}
