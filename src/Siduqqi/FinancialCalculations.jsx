import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Divider,
  Snackbar,
  Alert,
  Chip,
  Stack,
  Icon,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { styled } from "@mui/system";
import { apiUrl } from "./hooks/api";
import ExportCsvTableButton from "./utils/ExportHtmlString";

const StyledTableContainer = styled("div")({
  "&, & *, & *::before, & *::after": {
    color: "#000 !important",
  },
  "& table": {
    borderCollapse: "collapse",
    width: "100%",
    marginBottom: "1rem",
    fontSize: "0.9em",
  },
  "& th, & td": {
    border: "1px solid #e2e8f0",
    padding: "10px",
    textAlign: "left",
  },
  "& tr:nth-of-type(even)": {
    backgroundColor: "#f7fafc",
  },
});

/** ---------- Number helpers (format UI, store numeric) ---------- */
const formatNumber = (val) => {
  if (val === null || val === undefined || val === "") return "";
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return n.toLocaleString("en-US");
};
const parseNumberOrNull = (val) => {
  if (val === "" || val === null || val === undefined) return null;
  const s = String(val).replace(/,/g, "");
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
};

/** Deep clone util */
const deepClone = (obj) => JSON.parse(JSON.stringify(obj || {}));

/** Shallow compare via JSON for simplicity here */
const isEqualJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Friendly titles for keys (fallback to param_name if provided) */
const labelize = (key, node) =>
  node?.param_name ||
  {
    revenue: "Revenue",
    costOfRevenue: "Cost of revenue",
    sellingMarketingExpenses: "Selling and marketing expenses",
    generalAdminExpenses: "General and administrative expenses",
    depreciationAmortization: "Depreciation and amortization",
    equityIncome: "Share of income from equity accounted investment",
    fairValueLoss: "Fair value loss on investments",
    financeCosts: "Finance costs",
    zakat: "Zakat",
  }[key] ||
  key;

/** Sort year-like keys ascending */
const sortYearKeys = (obj) =>
  Object.keys(obj || {})
    .filter((k) => /^\d{4}$/.test(k))
    .sort((a, b) => Number(a) - Number(b));

const FinancialStatementsCalculations = () => {
  const [clientId, setClientId] = useState("pwc-test-123456");
  const [htmlContent, setHtmlContent] = useState(null);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Editable copy of extracted_params
  const [editableParams, setEditableParams] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, type: "success", msg: "" });

  const fetchPLData = async () => {
    setHtmlContent(null);
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${apiUrl}/calculation/PL/fetch/${clientId}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        }
      );
      if (!response.ok)
        throw new Error(`API call failed with status: ${response.status}`);

      const result = await response.json();
      if (result && result.calculations_table_html) {
        setHtmlContent(result.calculations_table_html);
        setData(result);
      } else {
        throw new Error("No 'calculations_table_html' found in the response.");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Failed to fetch data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /** Load editableParams whenever data changes */
  useEffect(() => {
    if (data?.extracted_params) {
      setEditableParams(deepClone(data.extracted_params));
    } else {
      setEditableParams(null);
    }
  }, [data]);

  /** Original extracted_params for change detection */
  const originalParams = useMemo(() => data?.extracted_params || null, [data]);

  const hasChanges = useMemo(() => {
    if (!editableParams && !originalParams) return false;
    return !isEqualJSON(editableParams, originalParams);
  }, [editableParams, originalParams]);

  /** Handle per-year value change */
  const handleYearChange = (bucketKey, metricKey, year, uiValue) => {
    setEditableParams((prev) => {
      const next = deepClone(prev);
      const parsed = parseNumberOrNull(uiValue);
      // Ensure path exists
      if (!next[bucketKey]) next[bucketKey] = {};
      if (!next[bucketKey][metricKey]) next[bucketKey][metricKey] = {};
      next[bucketKey][metricKey][year] = parsed;
      return next;
    });
  };

  /** PUT update */
  const handleUpdate = async () => {
    if (!editableParams) return;
    setIsSaving(true);
    try {
      const resp = await fetch(`${apiUrl}/calculations/${clientId}`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ extracted_params: editableParams }),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(`Update failed (${resp.status}): ${t || "no details"}`);
      }

      // Success snackbar
      setSnack({ open: true, type: "success", msg: "Updated successfully." });

      // 👇 Call fetch again to reload the latest data
      await fetchPLData();
    } catch (e) {
      console.error(e);
      setSnack({
        open: true,
        type: "error",
        msg: e.message || "Update failed.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  /** Renders all buckets (e.g., "IS-CON") */
  const renderEditableBlocks = () => {
    if (!editableParams) return null;

    return Object.entries(editableParams).map(([bucketKey, metricsObj]) => {
      return (
        <Paper
          key={bucketKey}
          elevation={0}
          sx={{ p: 2, borderRadius: 3, border: "1px solid #eee", mb: 3 }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="h6" color="black">
              Editable Parameters
            </Typography>
            <Chip
              label={<Typography color="black">{bucketKey}</Typography>}
              size="small"
            />
          </Stack>
          <Typography variant="body2" sx={{ color: "#555", mb: 2 }}>
            Update values below; to update the calculations
          </Typography>

          {Object.entries(metricsObj).map(([metricKey, metricNode]) => {
            const years = sortYearKeys(metricNode);
            const title = labelize(metricKey, metricNode);

            return (
              <Accordion
                key={metricKey}
                disableGutters
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  boxShadow: "none",
                  border: "1px solid #eee",
                }}
              >
                <AccordionSummary
                  expandIcon={
                    <Icon sx={{ color: "black" }}>expand_more_icon</Icon>
                  }
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ color: "primary.main", fontWeight: 600 }}>
                      {title}
                    </Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={
                        <Typography color="black">{`${years.length} yrs`}</Typography>
                      }
                      sx={{ color: "#000", borderColor: "#ccc" }}
                    />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {years.length === 0 && (
                      <Grid item xs={12}>
                        <Typography
                          color="red"
                          variant="body2"
                          sx={{ color: "#777" }}
                        >
                          No year values found for this metric.
                        </Typography>
                      </Grid>
                    )}
                    {years.map((year) => (
                      <Grid key={year} item xs={12} sm={6} md={4} lg={3}>
                        <TextField
                          fullWidth
                          label={year}
                          value={formatNumber(metricNode[year])}
                          onChange={(e) => {
                            // Live accept any typed chars; we’ll parse when storing
                            const raw = e.target.value;
                            // Let user type freely; store parsed immediately to keep source of truth numeric/null
                            handleYearChange(bucketKey, metricKey, year, raw);
                          }}
                          onBlur={(e) => {
                            // Normalize formatting on blur
                            const parsed = parseNumberOrNull(e.target.value);
                            handleYearChange(
                              bucketKey,
                              metricKey,
                              year,
                              parsed ?? ""
                            );
                          }}
                          placeholder="e.g., 12,345,678"
                          inputProps={{
                            inputMode: "numeric",
                            pattern: "^-?[\\d,]*$",
                          }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Paper>
      );
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        minHeight: "100vh",
        backgroundColor: "#f0f2f5",
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{ p: 4, borderRadius: 2, width: "100%", maxWidth: 1400 }}
      >
        <Typography
          color="black"
          variant="h4"
          component="h1"
          gutterBottom
          align="center"
        >
          P&L Statement
        </Typography>

        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
          <TextField
            sx={{ flex: 1, minWidth: 280 }}
            label="Enter Client ID"
            variant="outlined"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
          <Button
            variant="contained"
            onClick={fetchPLData}
            disabled={isLoading || clientId.length === 0}
            sx={{ minWidth: 140 }}
          >
            {isLoading ? (
              <CircularProgress size={22} color="inherit" />
            ) : (
              "Fetch P&L"
            )}
          </Button>
        </Box>

        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Typography color="error" align="center" sx={{ mt: 4 }}>
            {error}
          </Typography>
        )}

        {/* Export button */}
        {htmlContent && data?.calculations_table && (
          <Box sx={{ my: 2, display: "flex", justifyContent: "end" }}>
            <ExportCsvTableButton csvString={data.calculations_table} />
          </Box>
        )}

        {/* Render the HTML table */}
        {htmlContent && (
          <Paper
            sx={{ mt: 2, p: 2, borderRadius: 3, border: "1px solid #eee" }}
          >
            <StyledTableContainer>
              <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
            </StyledTableContainer>
          </Paper>
        )}

        {/* Editable extracted params */}
        {editableParams && (
          <>
            <Divider sx={{ my: 3 }} />
            {renderEditableBlocks()}

            {/* Action bar */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
                mt: 2,
                position: "sticky",
                bottom: 0,
                background:
                  "linear-gradient(180deg, rgba(240,242,245,0) 0%, rgba(240,242,245,1) 40%)",
                py: 2,
              }}
            >
              <Button
                variant="outlined"
                disabled={!hasChanges || isSaving}
                onClick={() => setEditableParams(deepClone(originalParams))}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                disabled={!hasChanges || isSaving}
                onClick={handleUpdate}
                sx={{ minWidth: 140 }}
              >
                {isSaving ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  "Update"
                )}
              </Button>
            </Box>
          </>
        )}
      </Paper>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.type}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FinancialStatementsCalculations;
