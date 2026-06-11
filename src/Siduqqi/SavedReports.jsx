import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stack,
  Button,
  Menu,
  MenuItem,
  IconButton,
  TextField,
  Checkbox,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip as MuiTooltip,
  Snackbar,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ThemeProvider } from '@mui/material/styles';
import { Line, Bar } from 'react-chartjs-2';

import LinkedinAITheme from '../LinkedinAI/style/LinkedinAITheme';
import { useSettings } from './context/SettingsContext';
import { apiUrl } from './hooks/api';
import {
  INK,
  buildChartData,
  buildChartOptions,
  chartCanvasToWhiteDataUrl,
  compact,
  pct,
} from './report/reportUtils';

const isPercentType = (t) => t === 'growth' || t === 'pctOfRevenue' || t === 'commonSize';
const kindOf = (t) => (t === 'drilldown' ? 'stackbar' : 'line');

const EXPORT_MODES = [
  { key: 'charts', label: 'Charts Only' },
  { key: 'tables', label: 'Tables Only' },
  { key: 'commentary', label: 'Commentary Only' },
  { key: 'selected', label: 'Selected Only' },
  { key: 'all', label: 'Export All' },
];

// --- One saved-chart card: chart + per-chart commentary + select + delete ---
function SavedChartCard({ chart, selected, onToggleSelect, onSaveCommentary, onDelete, registerCanvas }) {
  const [text, setText] = useState(chart.commentary || '');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setText(chart.commentary || '');
    setDirty(false);
  }, [chart.id, chart.commentary]);

  const percent = isPercentType(chart.chartType);
  const kind = kindOf(chart.chartType);
  const labels = useMemo(() => chart.series?.labels || [], [chart.series]);
  const datasets = useMemo(() => chart.series?.datasets || [], [chart.series]);

  const data = useMemo(() => buildChartData(kind, labels, datasets), [kind, labels, datasets]);
  const options = useMemo(() => buildChartOptions(kind, percent, datasets), [kind, percent, datasets]);

  const setChartRef = useCallback(
    (instance) => {
      if (instance?.canvas) registerCanvas(chart.id, instance.canvas);
    },
    [chart.id, registerCanvas]
  );

  const handleBlur = () => {
    if (dirty) {
      onSaveCommentary(chart.id, text);
      setDirty(false);
    }
  };

  const hasData = datasets.length > 0;

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid #ECEFF3' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 4, height: 22, borderRadius: 2, bgcolor: INK }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: INK }}>{chart.title}</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <MuiTooltip title="Include in “Selected Only” export">
            <Checkbox
              checked={selected}
              onChange={() => onToggleSelect(chart.id)}
              sx={{ color: INK, '&.Mui-checked': { color: INK } }}
            />
          </MuiTooltip>
          <MuiTooltip title="Remove chart">
            <IconButton size="small" onClick={() => onDelete(chart)}>
              <DeleteOutlineIcon sx={{ fontSize: 20, color: '#94A3B8' }} />
            </IconButton>
          </MuiTooltip>
        </Stack>
      </Box>

      <Box sx={{ height: 320 }}>
        {hasData ? (
          kind === 'stackbar' ? (
            <Bar ref={setChartRef} data={data} options={options} />
          ) : (
            <Line ref={setChartRef} data={data} options={options} />
          )
        ) : (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">This saved chart has no data snapshot.</Typography>
          </Box>
        )}
      </Box>

      {/* Per-chart commentary */}
      <Box sx={{ mt: 2 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', mb: 1 }}>Commentary</Typography>
        <TextField
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          onBlur={handleBlur}
          placeholder="Write commentary for this chart…"
          fullWidth
          multiline
          minRows={2}
          InputProps={{ sx: { borderRadius: 2, fontSize: '0.9rem', bgcolor: '#F8FAFC' } }}
        />
      </Box>
    </Paper>
  );
}

const SavedReports = () => {
  const { clientId } = useSettings();

  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [exportAnchor, setExportAnchor] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const canvasMap = useRef({}); // id → canvas element

  const registerCanvas = useCallback((id, canvas) => {
    canvasMap.current[id] = canvas;
  }, []);

  const loadCharts = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/report-generator/${encodeURIComponent(clientId)}/charts`);
      if (!res.ok) throw new Error(`Failed to load saved charts (${res.status})`);
      const json = await res.json();
      setCharts(json.charts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const saveCommentary = useCallback(
    async (id, commentary) => {
      try {
        const res = await fetch(`${apiUrl}/report-generator/${encodeURIComponent(clientId)}/charts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commentary }),
        });
        if (!res.ok) throw new Error(`Failed to save commentary (${res.status})`);
        setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, commentary } : c)));
        setToast({ severity: 'success', message: 'Commentary saved' });
      } catch (err) {
        setToast({ severity: 'error', message: err.message });
      }
    },
    [clientId]
  );

  const confirmDelete = useCallback(async () => {
    const chart = pendingDelete;
    if (!chart) return;
    try {
      const res = await fetch(`${apiUrl}/report-generator/${encodeURIComponent(clientId)}/charts/${chart.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed to remove chart (${res.status})`);
      setCharts((prev) => prev.filter((c) => c.id !== chart.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(chart.id);
        return next;
      });
      delete canvasMap.current[chart.id];
    } catch (err) {
      setToast({ severity: 'error', message: err.message });
    } finally {
      setPendingDelete(null);
    }
  }, [pendingDelete, clientId]);

  // --- PDF export (client-side, via a styled print window) ---
  const buildTable = (chart) => {
    const labels = chart.series?.labels || [];
    const datasets = chart.series?.datasets || [];
    const percent = isPercentType(chart.chartType);
    const esc = (s) =>
      String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const head = `<tr><th>Series</th>${labels.map((y) => `<th>${esc(y)}</th>`).join('')}</tr>`;
    const body = datasets
      .map(
        (d) =>
          `<tr><td class="series">${esc(d.label)}</td>${d.data
            .map((v) => `<td>${v === null || v === undefined || isNaN(v) ? '' : percent ? pct(v, 1) : compact(v)}</td>`)
            .join('')}</tr>`
      )
      .join('');
    return `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  };

  const exportPdf = (mode) => {
    setExportAnchor(null);
    const list = mode === 'selected' ? charts.filter((c) => selectedIds.has(c.id)) : charts;
    if (list.length === 0) {
      setToast({
        severity: 'warning',
        message: mode === 'selected' ? 'No charts selected.' : 'No charts to export.',
      });
      return;
    }
    const includeChart = mode === 'charts' || mode === 'selected' || mode === 'all';
    const includeTable = mode === 'tables' || mode === 'all';
    const includeCommentary = mode === 'commentary' || mode === 'selected' || mode === 'all';

    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const blocks = list
      .map((c) => {
        const img = includeChart ? chartCanvasToWhiteDataUrl(canvasMap.current[c.id]) : null;
        const commentary = (c.commentary || '').trim();
        return `
          <section class="block">
            <h2>${esc(c.title)}</h2>
            ${img ? `<img src="${img}" alt="${esc(c.title)}" />` : ''}
            ${includeTable ? buildTable(c) : ''}
            ${
              includeCommentary
                ? `<div class="commentary"><div class="label">Commentary</div><p>${
                    commentary ? esc(commentary) : '<em>— no commentary —</em>'
                  }</p></div>`
                : ''
            }
          </section>`;
      })
      .join('');

    const modeLabel = EXPORT_MODES.find((m) => m.key === mode)?.label || 'Report';
    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>Report — ${esc(clientId || '')}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1E293B; margin: 28px; }
        header { border-bottom: 2px solid ${INK}; padding-bottom: 10px; margin-bottom: 18px; }
        header h1 { color: ${INK}; font-size: 20px; margin: 0; }
        header .meta { color: #64748B; font-size: 12px; margin-top: 4px; }
        .block { page-break-inside: avoid; margin-bottom: 26px; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; }
        .block h2 { font-size: 15px; color: ${INK}; margin: 0 0 10px; }
        .block img { width: 100%; max-width: 760px; height: auto; display: block; }
        table.data { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 12px; }
        table.data th, table.data td { border: 1px solid #E2E8F0; padding: 5px 8px; text-align: right; }
        table.data th { background: ${INK}; color: #fff; }
        table.data td.series, table.data th:first-child { text-align: left; }
        .commentary { margin-top: 12px; background: #F8FAFC; border-radius: 6px; padding: 10px 12px; }
        .commentary .label { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
        .commentary p { margin: 0; font-size: 13px; line-height: 1.5; }
        @media print { @page { margin: 14mm; } }
      </style></head>
      <body>
        <header>
          <h1>Customized Report — ${modeLabel}</h1>
          <div class="meta">${esc(clientId || 'Business')} · ${list.length} chart${list.length === 1 ? '' : 's'} · ${new Date().toLocaleDateString()}</div>
        </header>
        ${blocks}
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      setToast({ severity: 'error', message: 'Pop-up blocked. Allow pop-ups to export.' });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A' }}>
              Create Your Customized Report!
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B', maxWidth: 620 }}>
              Generate and export detailed reports tailored to your business needs — income, expenses, sales, and more.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              icon={<BusinessOutlinedIcon sx={{ fontSize: 18 }} />}
              label={clientId || 'Business Name'}
              sx={{ bgcolor: '#fff', border: '1px solid #E2E8F0', fontWeight: 600, color: '#1E293B', '& .MuiChip-icon': { color: INK } }}
            />
            <IconButton onClick={loadCharts} size="small" sx={{ border: '1px solid #E2E8F0', bgcolor: '#fff' }}>
              <RefreshIcon sx={{ fontSize: 18, color: INK }} />
            </IconButton>
            <Button
              onClick={(e) => setExportAnchor(e.currentTarget)}
              endIcon={<KeyboardArrowDownIcon />}
              startIcon={<PictureAsPdfOutlinedIcon sx={{ fontSize: 18 }} />}
              variant="contained"
              disabled={charts.length === 0}
              sx={{ textTransform: 'none', bgcolor: INK, borderRadius: '20px', px: 2.5, fontWeight: 600, '&:hover': { bgcolor: '#17427C' } }}
            >
              Export
            </Button>
            <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
              {EXPORT_MODES.map((m) => (
                <MenuItem
                  key={m.key}
                  onClick={() => exportPdf(m.key)}
                  disabled={m.key === 'selected' && selectedIds.size === 0}
                >
                  {m.label}
                </MenuItem>
              ))}
            </Menu>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && charts.length === 0 && !error && (
          <Paper elevation={0} sx={{ p: 6, borderRadius: 3, border: '1px dashed #CBD5E1', textAlign: 'center' }}>
            <Typography sx={{ color: '#64748B', fontWeight: 600 }}>No charts pinned yet.</Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
              Go to <strong>API &amp; Metrics</strong>, open a chart, and click “Add to Saved Reports”.
            </Typography>
          </Paper>
        )}

        {!loading && charts.length > 0 && (
          <Grid container spacing={3}>
            {charts.map((chart) => (
              <Grid item xs={12} key={chart.id}>
                <SavedChartCard
                  chart={chart}
                  selected={selectedIds.has(chart.id)}
                  onToggleSelect={toggleSelect}
                  onSaveCommentary={saveCommentary}
                  onDelete={setPendingDelete}
                  registerCanvas={registerCanvas}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Delete confirm */}
        <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
          <DialogTitle>Remove this chart?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              “{pendingDelete?.title}” will be permanently removed from Saved Reports.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPendingDelete(null)} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button onClick={confirmDelete} variant="contained" color="error" sx={{ textTransform: 'none' }}>
              Remove
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={3000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {toast ? (
            <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)} sx={{ width: '100%' }}>
              {toast.message}
            </Alert>
          ) : undefined}
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
};

export default SavedReports;
