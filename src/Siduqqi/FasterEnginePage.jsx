import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  ThemeProvider,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Stop as StopIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  ErrorOutline as ErrorIcon,
  HourglassTop as ActiveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AutoFixHigh as AutoFixHighIcon,
} from "@mui/icons-material";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";
import { useFasterEngine } from "./hooks/useFasterEngine";

const MAX_TOTAL_BYTES = 18 * 1024 * 1024;
const MAX_FILES = 8;

const STEPS = [
  { id: "uploaded", label: "Upload PDFs" },
  { id: "analyzing", label: "Analyze with Gemini" },
  { id: "building", label: "Build Excel workbook" },
  { id: "done", label: "Ready to download" },
];

const STATUS_LABEL = {
  queued: "Queued — waiting for an available worker",
  analyzing: "Reading your financial statements (this can take a minute or two)…",
  building: "Building your Excel model…",
  done: "Model ready",
  error: "Something went wrong",
};

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function computeStepState(jobStatus) {
  // Returns { [stepId]: "done" | "active" | "pending" }
  const order = ["uploaded", "analyzing", "building", "done"];
  const statusToActive = {
    queued: "uploaded",
    analyzing: "analyzing",
    building: "building",
    done: "done",
    error: null,
  };
  const active = statusToActive[jobStatus] ?? "uploaded";
  const out = {};
  let pastActive = false;
  for (const id of order) {
    if (id === active) {
      out[id] = jobStatus === "done" ? "done" : "active";
      pastActive = true;
    } else if (!pastActive) {
      out[id] = "done";
    } else {
      out[id] = "pending";
    }
  }
  if (jobStatus === "error") {
    // Mark the step that was active as error implicitly via UI; keep prior as done.
  }
  return out;
}

function StepRow({ label, state, reducedMotion }) {
  let icon;
  let color;
  if (state === "done") {
    icon = <CheckIcon sx={{ color: "success.main", fontSize: 20 }} />;
    color = "text.primary";
  } else if (state === "active") {
    icon = reducedMotion ? (
      <ActiveIcon sx={{ color: "primary.main", fontSize: 20 }} />
    ) : (
      <CircularProgress size={16} thickness={6} />
    );
    color = "primary.main";
  } else {
    icon = <PendingIcon sx={{ color: "text.disabled", fontSize: 20 }} />;
    color = "text.secondary";
  }
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.75 }}>
      <Box sx={{ width: 24, display: "flex", justifyContent: "center" }}>{icon}</Box>
      <Typography variant="body2" sx={{ color, fontWeight: state === "active" ? 600 : 400 }}>
        {label}
      </Typography>
    </Stack>
  );
}

function FileRow({ file, onRemove, disabled }) {
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
          {formatMb(file.size)}
        </Typography>
      </Box>
      <IconButton onClick={onRemove} disabled={disabled} aria-label={`remove ${file.name}`}>
        <DeleteIcon />
      </IconButton>
    </Stack>
  );
}

export default function FasterEnginePage() {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { health, job, pollError, submit, reset, stopPolling } = useFasterEngine();

  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const fileInputRef = useRef(null);
  const originalTitleRef = useRef(typeof document !== "undefined" ? document.title : "");
  const notifiedDoneRef = useRef(false);

  const status = job?.status ?? null;
  const isWorking = status === "queued" || status === "analyzing" || status === "building";
  const isDone = status === "done";
  const isError = status === "error" || !!pollError;
  const geminiReady = health.data?.gemini_key_set === true;

  const totalBytes = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);
  const overSize = totalBytes > MAX_TOTAL_BYTES;
  const tooMany = files.length > MAX_FILES;

  // Live elapsed timer while working.
  useEffect(() => {
    if (!isWorking) return undefined;
    if (!startedAt) setStartedAt(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isWorking, startedAt]);

  useEffect(() => {
    if (!isWorking) {
      // Reset timer when leaving working state.
      if (!isDone && !isError) setStartedAt(null);
    }
  }, [isWorking, isDone, isError]);

  useEffect(() => {
    if (job && !startedAt && isWorking) setStartedAt(Date.now());
  }, [job, startedAt, isWorking]);

  const elapsedSec = startedAt ? Math.floor((now - startedAt) / 1000) : 0;

  // Tab title + notification when done.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (isDone) {
      document.title = `(✓) Model ready — Advisors M.E.`;
      if (!notifiedDoneRef.current) {
        notifiedDoneRef.current = true;
        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification("Financial model ready", {
              body: job?.company_name
                ? `${job.company_name} — click to download`
                : "Your model is ready to download.",
            });
          } catch { /* ignore */ }
        }
      }
    } else if (isWorking) {
      document.title = `(…) Building model — Advisors M.E.`;
      notifiedDoneRef.current = false;
    } else {
      document.title = originalTitleRef.current || "Advisors M.E.";
      notifiedDoneRef.current = false;
    }
    return () => {
      // no-op; final cleanup below.
    };
  }, [isDone, isWorking, job?.company_name]);

  useEffect(() => () => {
    if (typeof document !== "undefined") {
      document.title = originalTitleRef.current || "Advisors M.E.";
    }
  }, []);

  // Request notification permission once when entering working state.
  useEffect(() => {
    if (
      isWorking &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      try { Notification.requestPermission(); } catch { /* ignore */ }
    }
  }, [isWorking]);

  const addFiles = useCallback((incoming) => {
    const arr = Array.from(incoming || []);
    const rejected = arr.filter(
      (f) => !/\.pdf$/i.test(f.name) || (f.type && f.type !== "application/pdf")
    );
    const accepted = arr.filter(
      (f) => /\.pdf$/i.test(f.name) && (!f.type || f.type === "application/pdf")
    );
    if (rejected.length) {
      setToast({
        severity: "error",
        message: `Only PDF files are allowed. Skipped: ${rejected.map((f) => f.name).join(", ")}`,
      });
    }
    if (accepted.length) {
      setFiles((prev) => {
        const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
        const filtered = accepted.filter((f) => !existing.has(`${f.name}-${f.size}`));
        return [...prev, ...filtered];
      });
    }
  }, []);

  const onPick = (e) => {
    addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
  };

  const removeFile = (idx) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit =
    !isWorking &&
    !health.loading &&
    geminiReady &&
    files.length > 0 &&
    !overSize &&
    !tooMany;

  const handleSubmit = async () => {
    setSubmitError(null);
    setStartedAt(Date.now());
    try {
      await submit(files);
    } catch (err) {
      setSubmitError(err.message || String(err));
      setStartedAt(null);
    }
  };

  const handleRetry = async () => {
    setSubmitError(null);
    setShowErrorDetails(false);
    reset();
    setStartedAt(Date.now());
    try {
      await submit(files);
    } catch (err) {
      setSubmitError(err.message || String(err));
      setStartedAt(null);
    }
  };

  const handleStartOver = () => {
    reset();
    setFiles([]);
    setSubmitError(null);
    setShowErrorDetails(false);
    setStartedAt(null);
  };

  const handleCancelWatch = () => {
    stopPolling();
    setStartedAt(null);
  };

  const downloadHref = job?.download_url
    ? `${apiUrl}${job.download_url.startsWith("/") ? "" : "/"}${job.download_url}`
    : null;

  const triggerDownload = useCallback(async () => {
    if (!job?.id) return;
    const url = `${apiUrl}/engine2/download/${job.id}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = job.output_filename || "financial_model.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      setToast({
        severity: "error",
        message: err.message || "Could not download the file.",
      });
    }
  }, [job?.id, job?.output_filename]);

  const stepStates = computeStepState(status);
  const statusMessage = job?.message || (status ? STATUS_LABEL[status] : "");

  // ---------- Render ----------

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ p: 3, bgcolor: "grey.100", minHeight: "100vh" }}>
        <Box sx={{ maxWidth: 880, mx: "auto" }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <AutoFixHighIcon sx={{ color: "#FF5622" }} />
              <Typography variant="h4" fontWeight={700}>
                Faster Engine
              </Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary">
              Upload PDF financial statements and we'll generate a formula-linked Excel
              model in 1–4 minutes.
            </Typography>
          </Stack>

          {/* Health warning */}
          {!health.loading && health.error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              Can't reach the Faster Engine server ({health.error}).
            </Alert>
          )}
          {!health.loading && health.data && !geminiReady && (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              Server is missing its Gemini API key — ask an admin to set
              <code style={{ marginLeft: 6 }}>GEMINI_API_KEY</code>.
            </Alert>
          )}

          {/* State A: Upload */}
          {!job && !pollError && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Build a Financial Model
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Upload PDF financial statements and we'll generate a formula-linked
                  Excel model.
                </Typography>

                <Box
                  role="button"
                  tabIndex={0}
                  aria-label="Upload PDFs — drop files here or press Enter to browse"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  sx={{
                    border: "2px dashed",
                    borderColor: dragOver ? "primary.main" : "grey.400",
                    borderRadius: 2,
                    bgcolor: dragOver ? "primary.50" : "grey.50",
                    p: 4,
                    textAlign: "center",
                    cursor: "pointer",
                    outline: "none",
                    "&:focus-visible": {
                      borderColor: "primary.main",
                      boxShadow: "0 0 0 3px rgba(25,118,210,0.2)",
                    },
                    transition: "border-color 0.15s ease, background-color 0.15s ease",
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Drop PDFs here
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    or click to browse
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Up to 18 MB total · PDF only · 1–{MAX_FILES} files
                  </Typography>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="application/pdf,.pdf"
                    onChange={onPick}
                    style={{ display: "none" }}
                  />
                </Box>

                {files.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Selected files
                    </Typography>
                    <Stack spacing={1.5}>
                      {files.map((f, idx) => (
                        <FileRow
                          key={`${f.name}-${f.size}-${idx}`}
                          file={f}
                          onRemove={() => removeFile(idx)}
                          disabled={isWorking}
                        />
                      ))}
                    </Stack>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mt: 1.5 }}
                    >
                      <Typography
                        variant="caption"
                        color={overSize ? "error.main" : "text.secondary"}
                        fontWeight={overSize ? 700 : 400}
                      >
                        Total: {formatMb(totalBytes)} / 18.00 MB
                      </Typography>
                      {tooMany && (
                        <Typography variant="caption" color="error.main" fontWeight={700}>
                          Max {MAX_FILES} files
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}

                {submitError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {submitError}
                  </Alert>
                )}

                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mt: 3 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {health.data?.model
                      ? `Powered by ${health.data.model}${
                          health.data.thinking_level
                            ? ` · thinking_level=${health.data.thinking_level}`
                            : ""
                        }`
                      : ""}
                  </Typography>
                  <Tooltip
                    title={
                      !geminiReady
                        ? "Server is missing its Gemini API key"
                        : overSize
                        ? "Total upload must be ≤ 18 MB"
                        : tooMany
                        ? `Max ${MAX_FILES} files per run`
                        : files.length === 0
                        ? "Add at least one PDF"
                        : ""
                    }
                  >
                    <span>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<PlayArrowIcon />}
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                      >
                        Generate financial model
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* State B: Working */}
          {job && isWorking && !isError && (
            <Card sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  {reducedMotion ? (
                    <ActiveIcon sx={{ color: "primary.main", fontSize: 28 }} />
                  ) : (
                    <CircularProgress size={28} thickness={5} />
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      Building your financial model
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      aria-live="polite"
                    >
                      {statusMessage}
                    </Typography>
                  </Box>
                </Stack>

                <LinearProgress
                  variant={reducedMotion ? "determinate" : "indeterminate"}
                  value={reducedMotion ? 50 : undefined}
                  sx={{ height: 8, borderRadius: 4, mb: 2 }}
                  aria-valuetext={`${status} — ${formatElapsed(elapsedSec)} elapsed`}
                />

                <Stack
                  direction="row"
                  spacing={2}
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Elapsed: <strong>{formatElapsed(elapsedSec)}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Typical: 1–4 minutes
                  </Typography>
                </Stack>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Steps
                  </Typography>
                  <Stack>
                    {STEPS.map((s) => (
                      <StepRow
                        key={s.id}
                        label={
                          s.id === "uploaded" && job?.files?.length
                            ? `Uploaded ${job.files.length} PDF${
                                job.files.length === 1 ? "" : "s"
                              }`
                            : s.id === "analyzing" && health.data?.model
                            ? `Analyzing with ${health.data.model}`
                            : s.label
                        }
                        state={stepStates[s.id]}
                        reducedMotion={reducedMotion}
                      />
                    ))}
                  </Stack>
                </Box>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ mt: 2 }}
                >
                  You can leave this tab open; we'll let you know when it's done.
                </Typography>

                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
                  <Tooltip title="This stops watching; the server may still finish in the background.">
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<StopIcon />}
                      onClick={handleCancelWatch}
                    >
                      Cancel
                    </Button>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* State D: Error */}
          {isError && (
            <Card
              sx={{
                borderRadius: 3,
                mb: 3,
                borderLeft: "4px solid",
                borderLeftColor: "error.main",
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <ErrorIcon sx={{ color: "error.main", fontSize: 32, mt: 0.5 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      Something went wrong
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {job?.message || pollError || "The job failed."}
                    </Typography>

                    {job?.error && (
                      <Box sx={{ mt: 2 }}>
                        <Button
                          size="small"
                          onClick={() => setShowErrorDetails((s) => !s)}
                          endIcon={showErrorDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        >
                          {showErrorDetails ? "Hide details" : "Show details"}
                        </Button>
                        <Collapse in={showErrorDetails}>
                          <Paper
                            variant="outlined"
                            sx={{
                              mt: 1,
                              p: 1.5,
                              bgcolor: "grey.50",
                              maxHeight: 240,
                              overflow: "auto",
                            }}
                          >
                            <Box
                              component="pre"
                              sx={{
                                m: 0,
                                fontSize: 12,
                                whiteSpace: "pre",
                                overflow: "auto",
                              }}
                            >
                              {job.error}
                            </Box>
                          </Paper>
                        </Collapse>
                      </Box>
                    )}

                    <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                      <Button
                        variant="contained"
                        startIcon={<RefreshIcon />}
                        onClick={handleRetry}
                        disabled={files.length === 0}
                      >
                        Retry
                      </Button>
                      <Button variant="outlined" onClick={handleStartOver}>
                        Start over
                      </Button>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* State C: Done */}
          {isDone && (
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
                  <CheckIcon sx={{ color: "success.main", fontSize: 40, mt: 0.5 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" fontWeight={700}>
                      Model ready
                    </Typography>
                    {job?.company_name && (
                      <Typography variant="subtitle1" sx={{ mt: 0.5 }}>
                        {job.company_name}
                      </Typography>
                    )}
                    {job?.files?.length > 0 && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                        {job.files.map((name) => (
                          <Chip key={name} size="small" label={name} variant="outlined" />
                        ))}
                      </Stack>
                    )}

                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      sx={{ mt: 3 }}
                    >
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<DownloadIcon />}
                        onClick={triggerDownload}
                        disabled={!downloadHref}
                      >
                        Download {job?.output_filename || "model.xlsx"}
                      </Button>
                      {downloadHref && (
                        <Button
                          variant="text"
                          size="small"
                          component="a"
                          href={downloadHref}
                          download={job?.output_filename || "financial_model.xlsx"}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open in new tab
                        </Button>
                      )}
                      <Button variant="outlined" onClick={handleStartOver}>
                        Build another model
                      </Button>
                    </Stack>

                    {job?.summary && (
                      <Box sx={{ mt: 4 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          Executive summary
                        </Typography>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            maxHeight: 320,
                            overflow: "auto",
                            bgcolor: "grey.50",
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                          >
                            {job.summary}
                          </Typography>
                        </Paper>
                      </Box>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Box>

        <Snackbar
          open={!!toast}
          autoHideDuration={5000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          {toast ? (
            <Alert
              onClose={() => setToast(null)}
              severity={toast.severity}
              variant="filled"
            >
              {toast.message}
            </Alert>
          ) : undefined}
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
