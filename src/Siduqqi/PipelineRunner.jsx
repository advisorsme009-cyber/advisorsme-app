import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ThemeProvider,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Stop as StopIcon,
  CheckCircleOutline as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  ErrorOutline as ErrorIcon,
  WarningAmber as WarningIcon,
  HourglassTop as ActiveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PictureAsPdf as PdfIcon,
} from "@mui/icons-material";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { useSettings } from "./context/SettingsContext";
import { useEngine } from "./context/EngineContext";
import { usePipeline } from "./hooks/usePipeline";

const STAGES = [
  { id: "pdf_extraction", label: "PDF Extraction", range: [0, 35] },
  { id: "lv1_generation", label: "Historical (Lv1)", range: [35, 55] },
  { id: "lv3_generation", label: "Detailed (Lv3)", range: [55, 80] },
  { id: "validation", label: "Validation", range: [80, 85] },
  { id: "engine", label: "Financial Model", range: [85, 100] },
];

const STATUS_META = {
  pending: { color: "#9E9E9E", Icon: PendingIcon, label: "Pending" },
  active: { color: "#1976D2", Icon: ActiveIcon, label: "Running" },
  completed: { color: "#2E7D32", Icon: CheckIcon, label: "Done" },
  warning: { color: "#ED6C02", Icon: WarningIcon, label: "Warning" },
  error: { color: "#D32F2F", Icon: ErrorIcon, label: "Error" },
  skipped: { color: "#2E7D32", Icon: CheckIcon, label: "Skipped" },
};

const DPI_OPTIONS = [
  { value: 100, label: "100 (fastest)" },
  { value: 150, label: "150 (default)" },
  { value: 200, label: "200 (dense tables)" },
  { value: 250, label: "250 (max quality)" },
];

function deriveStageStatus(stageId, events, terminalEvent) {
  const stageEvents = events.filter((e) => e.stage === stageId);
  if (!stageEvents.length) {
    if (terminalEvent?.status === "error") return "pending";
    return "pending";
  }
  const last = stageEvents[stageEvents.length - 1];
  const isFinishedForStage =
    last.type === "stage_complete" ||
    (terminalEvent && terminalEvent.stage === stageId);
  if (isFinishedForStage) {
    if (last.status === "error") return "error";
    if (last.status === "skipped") return "skipped";
    if (stageEvents.some((e) => e.status === "warning")) return "warning";
    return "completed";
  }
  return "active";
}

function lastStepForStage(stageId, events) {
  const filtered = events.filter((e) => e.stage === stageId);
  return filtered.length ? filtered[filtered.length - 1].step : "";
}

function StageRow({ stage, status, step, isLast }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={2}
        sx={{ py: 1.25, px: 1 }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            bgcolor: `${meta.color}1A`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ color: meta.color, fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle2" sx={{ color: "text.primary" }}>
              {stage.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stage.range[0]}–{stage.range[1]}%
            </Typography>
          </Stack>
          {step && (
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              title={step}
            >
              {step}
            </Typography>
          )}
        </Box>
        <Chip
          size="small"
          label={meta.label}
          sx={{
            bgcolor: `${meta.color}1A`,
            color: meta.color,
            fontWeight: 600,
          }}
        />
      </Stack>
      {!isLast && <Divider />}
    </Box>
  );
}

function FileRow({ file, year, onYearChange, onRemove, disabled }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      sx={{
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <PdfIcon sx={{ color: "error.main" }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap title={file.name}>
          {file.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </Typography>
      </Box>
      <TextField
        label="Year"
        size="small"
        type="number"
        value={year}
        onChange={(e) => onYearChange(e.target.value)}
        disabled={disabled}
        inputProps={{ min: 1990, max: 2100, style: { width: 70 } }}
      />
      <IconButton onClick={onRemove} disabled={disabled} aria-label="remove">
        <DeleteIcon />
      </IconButton>
    </Stack>
  );
}

const PipelineRunner = () => {
  const navigate = useNavigate();
  const { clientId, setClientId, clearCache } = useSettings();
  const { loadAssumptions, loadAllResults, loadHistorical } = useEngine();
  const { state, run, cancel, reset } = usePipeline();

  const [entries, setEntries] = useState([]); // { file, year }
  const [force, setForce] = useState(false);
  const [dpi, setDpi] = useState(150);
  const [validationOpen, setValidationOpen] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleFiles = (e) => {
    const incoming = Array.from(e.target.files ?? []);
    if (!incoming.length) return;
    const currentYear = new Date().getFullYear();
    setEntries((prev) => [
      ...prev,
      ...incoming.map((file, idx) => ({
        file,
        year: String(currentYear - prev.length - idx - 1),
      })),
    ]);
    e.target.value = "";
  };

  const updateYear = (idx, value) =>
    setEntries((prev) =>
      prev.map((entry, i) => (i === idx ? { ...entry, year: value } : entry))
    );

  const removeEntry = (idx) =>
    setEntries((prev) => prev.filter((_, i) => i !== idx));

  const canRun =
    !state.running &&
    !!clientId &&
    entries.length > 0 &&
    entries.every((e) => e.year && Number.isInteger(parseInt(e.year, 10)));

  const handleRun = async () => {
    setSubmitError(null);
    try {
      await run({
        clientId,
        files: entries.map((e) => e.file),
        years: entries.map((e) => parseInt(e.year, 10)),
        force,
        dpi,
      });
    } catch (err) {
      setSubmitError(err.message || String(err));
    }
  };

  // After completion, refresh engine context and clear stale cache for this client
  useEffect(() => {
    if (state.result?.status === "completed" && clientId) {
      clearCache();
      loadAssumptions(clientId);
      loadAllResults(clientId);
      loadHistorical(clientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.result?.status]);

  const terminalEvent =
    state.result || (state.error ? { status: "error", stage: "" } : null);

  const validationEvent = useMemo(
    () =>
      state.events.find(
        (e) => e.type === "stage_complete" && e.stage === "validation"
      ),
    [state.events]
  );
  const validationDetail =
    validationEvent?.detail || state.result?.detail || null;
  const warnings = validationDetail?.warnings || [];
  const dataQualityScore =
    validationDetail?.data_quality_score ??
    state.result?.detail?.data_quality_score ??
    null;

  const isComplete = state.result?.status === "completed";
  const isFailed = state.result?.status === "error" || !!state.error;
  const showProgress = state.running || state.result || state.error;

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ p: 3, bgcolor: "grey.100", minHeight: "100vh" }}>
        <Box sx={{ maxWidth: 1100, mx: "auto" }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography variant="h4" fontWeight={700}>
              Unified Pipeline
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Upload financial statement PDFs to run the full extraction →
              historical → forecast pipeline in one shot. Takes 5–15 minutes.
            </Typography>
          </Stack>

          {/* Setup card */}
          <Card sx={{ borderRadius: 3, mb: 3 }}>
            <CardContent>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    1. Client
                  </Typography>
                  <TextField
                    fullWidth
                    label="Client ID"
                    placeholder="e.g. acme-corp-001"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={state.running}
                    size="small"
                    helperText="Used to scope all extracted data, assumptions, and results."
                  />
                </Box>

                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    2. Statements
                  </Typography>
                  <Box
                    sx={{
                      border: "2px dashed",
                      borderColor: "grey.400",
                      borderRadius: 2,
                      bgcolor: "grey.50",
                      p: 3,
                      textAlign: "center",
                      mb: 2,
                    }}
                  >
                    <input
                      id="pipeline-files"
                      type="file"
                      multiple
                      accept=".pdf"
                      onChange={handleFiles}
                      style={{ display: "none" }}
                      disabled={state.running}
                    />
                    <label htmlFor="pipeline-files">
                      <Button
                        variant="contained"
                        component="span"
                        startIcon={<CloudUploadIcon />}
                        disabled={state.running}
                      >
                        Add PDF files
                      </Button>
                    </label>
                    <Typography
                      variant="caption"
                      display="block"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      One PDF per fiscal year. Specify the year for each.
                    </Typography>
                  </Box>

                  {entries.length > 0 && (
                    <Stack spacing={1.5}>
                      {entries.map((entry, idx) => (
                        <FileRow
                          key={`${entry.file.name}-${idx}`}
                          file={entry.file}
                          year={entry.year}
                          onYearChange={(v) => updateYear(idx, v)}
                          onRemove={() => removeEntry(idx)}
                          disabled={state.running}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>

                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    3. Options
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <TextField
                      select
                      size="small"
                      label="PDF render DPI"
                      value={dpi}
                      onChange={(e) => setDpi(parseInt(e.target.value, 10))}
                      disabled={state.running}
                      sx={{ minWidth: 220 }}
                    >
                      {DPI_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Tooltip title="Re-extract PDFs even if statement data already exists for this client.">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={force}
                            onChange={(e) => setForce(e.target.checked)}
                            disabled={state.running}
                          />
                        }
                        label="Force re-extraction"
                      />
                    </Tooltip>
                  </Stack>
                </Box>

                {submitError && <Alert severity="error">{submitError}</Alert>}

                <Stack direction="row" spacing={2} justifyContent="flex-end">
                  {(state.result || state.error) && (
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={() => {
                        reset();
                        setSubmitError(null);
                      }}
                    >
                      Reset
                    </Button>
                  )}
                  {state.running ? (
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<StopIcon />}
                      onClick={cancel}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<PlayArrowIcon />}
                      onClick={handleRun}
                      disabled={!canRun}
                    >
                      Run pipeline
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* Progress card */}
          {showProgress && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2}>
                  {state.running && (
                    <CircularProgress size={28} thickness={5} />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      {isComplete
                        ? "Pipeline complete"
                        : isFailed
                        ? "Pipeline failed"
                        : `${state.currentStage || "Starting"} — ${state.progress}%`}
                    </Typography>
                    {state.currentStep && !isComplete && !isFailed && (
                      <Typography variant="body2" color="text.secondary">
                        {state.currentStep}
                      </Typography>
                    )}
                  </Box>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    color={isFailed ? "error.main" : "primary.main"}
                  >
                    {state.progress}%
                  </Typography>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, state.progress))}
                  color={isFailed ? "error" : "primary"}
                  sx={{ mt: 2, height: 8, borderRadius: 4 }}
                />

                <Paper
                  variant="outlined"
                  sx={{ mt: 3, borderRadius: 2, overflow: "hidden" }}
                >
                  {STAGES.map((stage, idx) => {
                    const status = deriveStageStatus(
                      stage.id,
                      state.events,
                      terminalEvent
                    );
                    return (
                      <StageRow
                        key={stage.id}
                        stage={stage}
                        status={status}
                        step={lastStepForStage(stage.id, state.events)}
                        isLast={idx === STAGES.length - 1}
                      />
                    );
                  })}
                </Paper>
              </CardContent>
            </Card>
          )}

          {/* Validation warnings */}
          {warnings.length > 0 && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <WarningIcon sx={{ color: "warning.main" }} />
                    <Typography variant="h6" fontWeight={700}>
                      {warnings.length} validation{" "}
                      {warnings.length === 1 ? "warning" : "warnings"}
                    </Typography>
                    {dataQualityScore !== null && (
                      <Chip
                        size="small"
                        label={`Quality: ${dataQualityScore}/100`}
                        color={
                          dataQualityScore >= 80
                            ? "success"
                            : dataQualityScore >= 60
                            ? "warning"
                            : "error"
                        }
                      />
                    )}
                  </Stack>
                  <IconButton
                    onClick={() => setValidationOpen((o) => !o)}
                    aria-label="toggle warnings"
                  >
                    {validationOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Stack>
                <Collapse in={validationOpen}>
                  <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {warnings.map((w, idx) => (
                      <Alert
                        key={idx}
                        severity={w.severity === "critical" ? "error" : "warning"}
                        variant="outlined"
                      >
                        <Typography variant="subtitle2" fontWeight={700}>
                          {w.check} {w.year ? `(${w.year})` : ""}
                        </Typography>
                        {w.expected !== undefined && w.actual !== undefined && (
                          <Typography variant="body2">
                            Expected {Number(w.expected).toLocaleString()}, got{" "}
                            {Number(w.actual).toLocaleString()}
                            {w.pct_diff !== undefined &&
                              ` (Δ ${w.pct_diff.toFixed(1)}%)`}
                          </Typography>
                        )}
                      </Alert>
                    ))}
                  </Stack>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {/* Success summary */}
          {isComplete && (
            <Card
              sx={{
                borderRadius: 3,
                mb: 3,
                borderLeft: "4px solid",
                borderLeftColor: "success.main",
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <CheckIcon
                    sx={{ color: "success.main", fontSize: 40, mt: 0.5 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      Model ready
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      All modules have been computed and saved to Firestore for{" "}
                      <strong>{clientId}</strong>.
                    </Typography>

                    <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                      {(state.result?.detail?.modules_computed || []).map((m) => (
                        <Chip
                          key={m}
                          size="small"
                          label={m}
                          sx={{ bgcolor: "primary.light", color: "primary.contrastText" }}
                        />
                      ))}
                    </Stack>

                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      sx={{ mt: 3 }}
                    >
                      <Button
                        variant="contained"
                        onClick={() => navigate("/FinancialModel")}
                      >
                        Open Financial Model
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => navigate("/assumptions")}
                      >
                        Edit Assumptions
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Failure detail */}
          {isFailed && (
            <Alert severity="error" sx={{ borderRadius: 3 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {state.result?.detail?.error ||
                  state.error ||
                  "Pipeline did not finish."}
              </Typography>
              {state.result?.detail?.lv1_results && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" fontWeight={600}>
                    Lv1 results:
                  </Typography>
                  <Box component="pre" sx={{ fontSize: 12, m: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(state.result.detail.lv1_results, null, 2)}
                  </Box>
                </Box>
              )}
            </Alert>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default PipelineRunner;
