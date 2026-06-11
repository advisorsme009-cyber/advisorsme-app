import React, { useState, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Menu,
  MenuItem,
  IconButton,
  TextField,
  Checkbox,
  FormControlLabel,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Radio,
  RadioGroup,
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import MetricSelector from './MetricSelector';
import { ThemeProvider } from '@mui/material/styles';
import { useSettings } from './context/SettingsContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

import LinkedinAITheme from '../LinkedinAI/style/LinkedinAITheme';
import { useEngine } from './context/EngineContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- Color families (light → dark) matching the dashboard design ---
const PALETTES = {
  blue: ['#E0ECFF', '#C2D8FB', '#9DBDF5', '#7AA2EF', '#5A86E8', '#3B6FE0', '#2457C8'],
  purple: ['#F0E9FF', '#DCCBFB', '#C3A8F4', '#AB86ED', '#9466E2', '#7E45D6', '#6A2EC0'],
  teal: ['#DCF7EE', '#B6ECD9', '#8FE0C2', '#66D3AA', '#3FC592', '#23B07B', '#179268'],
  grey: ['#EEF1F5', '#DBE0E8', '#C3CAD5', '#A8B1BF', '#8C97A8', '#717D90', '#5A6678'],
};
const RED_FAMILY = ['#FECACA', '#FCA5A5', '#F87171', '#F05252', '#E02424', '#C81E1E', '#B01616'];
const INK = '#1F559B';

const LEVEL3_CATEGORIES = ['S&M', 'G&A', 'FA', 'WC', 'DEBT', 'eosp', 'equity'];
const STATEMENT_TO_MODULE = { IS: 'IS-CON', BS: 'BS' };

// --- Data helpers (all read engine results dynamically; no hardcoded years) ---
const isYear = (k) => /^\d{4}$/.test(k);

const compact = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
};
const pct = (n, digits = 1) =>
  n === null || n === undefined || isNaN(n) ? '—' : `${(n * 100).toFixed(digits)}%`;

// Merge _analytics into module data so analytics keys are usable
function prepareModuleData(mod) {
  if (!mod) return null;
  const data = { ...mod };
  if (data._analytics) {
    Object.entries(data._analytics).forEach(([k, v]) => {
      if (!data[k]) data[k] = v;
    });
    delete data._analytics;
  }
  return data;
}

function moduleYears(mod) {
  const years = new Set();
  Object.values(mod || {}).forEach((v) => {
    if (v && typeof v === 'object') Object.keys(v).forEach((k) => isYear(k) && years.add(k));
  });
  return Array.from(years).sort();
}

function moduleLineItems(mod) {
  if (!mod) return [];
  return Object.entries(mod)
    .filter(
      ([k, v]) =>
        k !== '_analytics' &&
        v &&
        typeof v === 'object' &&
        Object.keys(v).some(isYear)
    )
    .map(([key, v]) => ({ key, label: v.param_name || key, values: v }));
}

// Find a single line item by candidate keys then a param_name regex fallback
function findItem(mod, keys = [], rx = null) {
  if (!mod) return null;
  for (const k of keys) if (mod[k]) return mod[k];
  if (rx) {
    const hit = Object.values(mod).find((v) => v?.param_name && rx.test(v.param_name));
    if (hit) return hit;
  }
  return null;
}

function filterYears(years, viewMode, forecastStartYear) {
  if (!forecastStartYear || viewMode === 'All') return years;
  if (viewMode === 'Historical') return years.filter((y) => Number(y) < forecastStartYear);
  if (viewMode === 'Forecasted') return years.filter((y) => Number(y) >= forecastStartYear);
  return years;
}

// Build stacked datasets: top 6 line items by magnitude + an "Other" bucket
function buildStacked(mod, years, palette, { mode = 'absolute', revenue = null, highlightYear = null } = {}) {
  const items = moduleLineItems(mod);
  if (items.length === 0 || years.length === 0) return null;

  const ranked = items
    .map((it) => ({
      ...it,
      total: years.reduce((s, y) => s + Math.abs(Number(it.values[y]) || 0), 0),
    }))
    .filter((it) => it.total > 0)
    .sort((a, b) => b.total - a.total);

  const top = ranked.slice(0, 6);
  const rest = ranked.slice(6);

  const series = [...top];
  if (rest.length) {
    series.push({
      label: 'Other',
      values: years.reduce((acc, y) => {
        acc[y] = rest.reduce((s, it) => s + (Number(it.values[y]) || 0), 0);
        return acc;
      }, {}),
    });
  }

  const valueAt = (it, y) => {
    let v = Number(it.values[y]) || 0;
    if (mode === 'pct_revenue' && revenue) {
      const r = Number(revenue[y]) || 0;
      v = r ? (v / r) * 100 : 0;
    }
    return v;
  };

  // For common-size (pct_total) normalize each column to 100%
  const colTotals = {};
  if (mode === 'pct_total') {
    years.forEach((y) => {
      colTotals[y] = series.reduce((s, it) => s + Math.abs(Number(it.values[y]) || 0), 0);
    });
  }

  const datasets = series.map((it, i) => ({
    label: it.label,
    stack: 'stack',
    borderWidth: 0,
    borderRadius: 3,
    maxBarThickness: 46,
    data: years.map((y) => {
      if (mode === 'pct_total') {
        const t = colTotals[y] || 0;
        return t ? (Math.abs(Number(it.values[y]) || 0) / t) * 100 : 0;
      }
      return valueAt(it, y);
    }),
    backgroundColor: years.map((y) =>
      y === highlightYear ? RED_FAMILY[i % RED_FAMILY.length] : palette[i % palette.length]
    ),
  }));

  return { labels: years, datasets };
}

const stackedOptions = (isPercent) => ({
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 10 }, padding: 12 } },
    tooltip: {
      callbacks: {
        label: (ctx) =>
          `${ctx.dataset.label}: ${isPercent ? `${ctx.parsed.y.toFixed(1)}%` : compact(ctx.parsed.y)}`,
      },
    },
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
    y: {
      stacked: true,
      grid: { color: '#F1F3F6' },
      ticks: {
        font: { size: 11 },
        callback: (v) => (isPercent ? `${v}%` : compact(v)),
      },
    },
  },
});

// Inline plugin: draw a percent label at the end of each horizontal bar
const pctLabelPlugin = {
  id: 'pctLabel',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      meta.data.forEach((bar, i) => {
        const val = ds.data[i];
        if (val === null || val === undefined) return;
        ctx.save();
        ctx.fillStyle = '#475569';
        ctx.font = '600 12px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${val.toFixed(1)}%`, bar.x + 8, bar.y);
        ctx.restore();
      });
    });
  },
};

// --- Reusable card that owns a chart ref + PNG export ---
function ChartCard({ title, accent = INK, toggle = null, children, height = 320 }) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, height: '100%', border: '1px solid #ECEFF3' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 4, height: 22, borderRadius: 2, bgcolor: accent }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B' }}>{title}</Typography>
        </Stack>
        {toggle}
      </Box>
      <Box sx={{ height }}>{children}</Box>
    </Paper>
  );
}

function ExportButton({ chartRef, name }) {
  const handle = async () => {
    const blob = await chartToWhiteBgBlob(chartRef?.current);
    if (blob) downloadBlob(blob, `${name.replace(/\s+/g, '_')}.png`);
  };
  return (
    <Button
      onClick={handle}
      size="small"
      startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
      sx={{
        textTransform: 'none',
        bgcolor: INK,
        color: '#fff',
        borderRadius: '18px',
        px: 1.5,
        fontSize: '0.78rem',
        '&:hover': { bgcolor: '#17427C' },
      }}
    >
      Export
    </Button>
  );
}

// Render the chart canvas onto a white-background canvas → returns PNG Blob.
// Charts.js leaves the canvas background transparent; this guarantees pasted /
// downloaded images show as white instead of black on dark backgrounds.
function chartToWhiteBgBlob(chart) {
  return new Promise((resolve) => {
    if (!chart) return resolve(null);
    const src = chart.canvas;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    out.toBlob((b) => resolve(b), 'image/png', 1);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Build a 2D string grid: header row + one row per series with year columns.
function tableDataToRows({ labels, datasets }, isPercent) {
  const fmtCell = (v) =>
    v === null || v === undefined || isNaN(v)
      ? ''
      : isPercent
      ? `${Number(v).toFixed(1)}%`
      : Math.round(Number(v)).toString();
  const header = ['Series', ...labels.map(String)];
  const body = datasets.map((ds) => [ds.label, ...ds.data.map(fmtCell)]);
  return [header, ...body];
}

function rowsToCsv(rows) {
  const escape = (s) => `"${String(s).replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(escape).join(',')).join('\n');
}

function rowsToXlsHtml(rows, sheetName = 'Sheet1') {
  const escapeHtml = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const trs = rows
    .map(
      (r, i) =>
        `<tr>${r
          .map((c) =>
            i === 0
              ? `<th style="background:#1F559B;color:#fff;font-weight:bold">${escapeHtml(c)}</th>`
              : `<td>${escapeHtml(c)}</td>`
          )
          .join('')}</tr>`
    )
    .join('');
  // Excel-compatible HTML envelope — Excel reads this as a real workbook.
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escapeHtml(sheetName)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml></head><body><table>${trs}</table></body></html>`;
}

// View-aware export dropdown: chart-mode → Copy / Download PNG (white bg);
// table-mode → Export as Excel / Export as CSV.
function ExportMenu({ view = 'chart', chartRef, tableData, isPercent, name }) {
  const [anchor, setAnchor] = useState(null);
  const close = () => setAnchor(null);
  const safeName = name.replace(/\s+/g, '_');

  const handleDownloadPng = async () => {
    const blob = await chartToWhiteBgBlob(chartRef?.current);
    if (blob) downloadBlob(blob, `${safeName}.png`);
    close();
  };

  const handleCopyPng = async () => {
    const blob = await chartToWhiteBgBlob(chartRef?.current);
    if (blob && navigator.clipboard?.write && typeof window.ClipboardItem !== 'undefined') {
      try {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      } catch {
        // clipboard write denied / unsupported — silent
      }
    }
    close();
  };

  const handleDownloadCsv = () => {
    if (!tableData) return close();
    const rows = tableDataToRows(tableData, isPercent);
    const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${safeName}.csv`);
    close();
  };

  const handleDownloadXls = () => {
    if (!tableData) return close();
    const rows = tableDataToRows(tableData, isPercent);
    const blob = new Blob([rowsToXlsHtml(rows, name)], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    downloadBlob(blob, `${safeName}.xls`);
    close();
  };

  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        size="small"
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
        sx={{
          textTransform: 'none',
          bgcolor: INK,
          color: '#fff',
          borderRadius: '18px',
          px: 1.5,
          fontSize: '0.78rem',
          '&:hover': { bgcolor: '#17427C' },
        }}
      >
        Export
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        {view === 'chart'
          ? [
              <MenuItem key="copy" onClick={handleCopyPng}>
                Copy chart
              </MenuItem>,
              <MenuItem key="png" onClick={handleDownloadPng}>
                Download chart (PNG)
              </MenuItem>,
            ]
          : [
              <MenuItem key="xls" onClick={handleDownloadXls}>
                Export as Excel
              </MenuItem>,
              <MenuItem key="csv" onClick={handleDownloadCsv}>
                Export as CSV
              </MenuItem>,
            ]}
      </Menu>
    </>
  );
}

// Chart/Table radio toggle (used by stacked sections)
function ViewToggle({ value, onChange }) {
  return (
    <RadioGroup
      row
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{
        '& .MuiFormControlLabel-root': { mr: 1 },
        '& .MuiFormControlLabel-label': {
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#64748B',
        },
        '& .MuiRadio-root': { p: 0.3 },
      }}
    >
      <FormControlLabel value="chart" control={<Radio size="small" sx={{ color: INK, '&.Mui-checked': { color: INK } }} />} label="Chart" />
      <FormControlLabel value="table" control={<Radio size="small" sx={{ color: INK, '&.Mui-checked': { color: INK } }} />} label="Table" />
    </RadioGroup>
  );
}

// Pill toggle used inside stacked sections
function PillToggle({ value, onChange, options }) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(e, v) => v && onChange(v)}
      sx={{
        '& .MuiToggleButton-root': {
          textTransform: 'none',
          border: '1px solid #E2E8F0',
          px: 1.5,
          py: 0.4,
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#64748B',
          borderRadius: '16px !important',
          mr: 0.5,
          '&.Mui-selected': { bgcolor: INK, color: '#fff', '&:hover': { bgcolor: '#17427C' } },
        },
      }}
    >
      {options.map((o) => (
        <ToggleButton key={o.value} value={o.value}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

// A full stacked-bar section with mode toggle + Chart/Table view + export
function StackedSection({ title, mod, years, paletteKey, highlightYear, revenue, altMode, altLabel }) {
  const [mode, setMode] = useState('absolute');
  const [view, setView] = useState('chart');
  const chartRef = useRef(null);
  const palette = PALETTES[paletteKey];

  const data = useMemo(
    () => buildStacked(mod, years, palette, { mode, revenue, highlightYear }),
    [mod, years, palette, mode, revenue, highlightYear]
  );

  const isPercent = mode !== 'absolute';

  const renderTable = () => {
    if (!data) return null;
    const fmt = (v) =>
      isPercent
        ? `${(Number(v) || 0).toFixed(1)}%`
        : compact(Number(v) || 0);
    return (
      <Box sx={{ overflowX: 'auto', height: '100%' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: '#1E293B', fontSize: '0.8rem' }}>Series</TableCell>
              {data.labels.map((y) => (
                <TableCell
                  key={y}
                  align="right"
                  sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}
                >
                  {y}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.datasets.map((ds, i) => (
              <TableRow key={i}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#1E293B' }}>
                  {ds.label}
                </TableCell>
                {ds.data.map((v, j) => (
                  <TableCell key={j} align="right" sx={{ fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(v)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    );
  };

  return (
    <ChartCard
      title={title}
      accent={palette[5]}
      height={340}
      toggle={
        <Stack direction="row" spacing={1.5} alignItems="center">
          <PillToggle
            value={mode}
            onChange={setMode}
            options={[
              { value: 'absolute', label: 'Value' },
              { value: altMode, label: altLabel },
            ]}
          />
          <ViewToggle value={view} onChange={setView} />
          <ExportMenu
            view={view}
            chartRef={chartRef}
            tableData={data}
            isPercent={isPercent}
            name={title}
          />
        </Stack>
      }
    >
      {data ? (
        view === 'chart' ? (
          <Bar ref={chartRef} data={data} options={stackedOptions(isPercent)} />
        ) : (
          renderTable()
        )
      ) : (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">No data available for this section.</Typography>
        </Box>
      )}
    </ChartCard>
  );
}

// KPI stat card for the top strip
function KpiStat({ label, value, sub, positive, healthy }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #ECEFF3', height: '100%' }}>
      <Typography sx={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, mt: 0.3 }}>
        {label}
      </Typography>
      {sub && (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
          {healthy ? (
            <FiberManualRecordIcon sx={{ fontSize: 10, color: '#16A34A' }} />
          ) : positive !== undefined ? (
            positive ? (
              <TrendingUpIcon sx={{ fontSize: 16, color: '#16A34A' }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: 16, color: '#DC2626' }} />
            )
          ) : null}
          <Typography
            sx={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: healthy
                ? '#16A34A'
                : positive === undefined
                ? '#64748B'
                : positive
                ? '#16A34A'
                : '#DC2626',
            }}
          >
            {sub}
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}

const ReportGenerator = () => {
  const { results, assumptions, loading: isLoading, error: engineError } = useEngine();
  const { clientId } = useSettings();

  const [statementType, setStatementType] = useState('IS');
  const [viewMode, setViewMode] = useState('All');
  const [selectedMetrics, setSelectedMetrics] = useState(['revenue', 'costOfRevenue']);
  const [activeLevel, setActiveLevel] = useState('1');
  const [level3Category, setLevel3Category] = useState(null);
  // Hero panel toolbar state
  const [period, setPeriod] = useState('YTD');
  const [showPctGrowth, setShowPctGrowth] = useState(false);
  const [showPctRevenue, setShowPctRevenue] = useState(false);
  const [heroChartType, setHeroChartType] = useState('line');
  const [commentary, setCommentary] = useState('');

  const heroRef = useRef(null);
  const kpiRef = useRef(null);
  const error = engineError || '';

  const forecastStartYear = assumptions?.general?.reporting_date
    ? assumptions.general.reporting_date + 1
    : undefined;
  const highlightYear = forecastStartYear ? String(forecastStartYear - 1) : null;

  const handleToggleMetric = (metricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(metricKey)) return prev.filter((k) => k !== metricKey);
      if (prev.length >= 3) return prev;
      return [...prev, metricKey];
    });
  };

  // Prepared modules
  const isMod = useMemo(() => prepareModuleData(results?.['IS-CON']), [results]);
  const bsMod = useMemo(() => prepareModuleData(results?.['BS']), [results]);

  const moduleKey = STATEMENT_TO_MODULE[statementType];
  const currentData = useMemo(() => prepareModuleData(results?.[moduleKey]), [results, moduleKey]);

  const level3DataForCategory = useMemo(() => {
    if (!level3Category || !results?.[level3Category]) return null;
    return prepareModuleData(results[level3Category]);
  }, [results, level3Category]);

  // Years (respecting view mode) — derived from IS-CON, the spine of the report
  const baseYears = useMemo(() => moduleYears(isMod || currentData), [isMod, currentData]);
  const years = useMemo(
    () => filterYears(baseYears, viewMode, forecastStartYear),
    [baseYears, viewMode, forecastStartYear]
  );

  // Revenue series for % of revenue transforms
  const revenueItem = useMemo(
    () => findItem(isMod, ['revenue', 'totalRevenue', 'netRevenue'], /^(total |net )?revenue$/i),
    [isMod]
  );

  // --- KPI strip values ---
  const kpis = useMemo(() => {
    const all = baseYears;
    const last = all[all.length - 1];
    const prev = all[all.length - 2];
    const rev = revenueItem ? Number(revenueItem[last]) : null;
    const revPrev = revenueItem && prev ? Number(revenueItem[prev]) : null;
    const growth = rev && revPrev ? (rev - revPrev) / revPrev : null;

    const niItem = findItem(isMod, ['netIncomeLoss', 'netIncome', 'netProfit'], /net (income|profit)/i);
    const ni = niItem ? Number(niItem[last]) : null;
    const netMargin = ni && rev ? ni / rev : null;

    const cashItem =
      findItem(bsMod, ['cashAndCashEquivalents', 'cash'], /cash (and|&).*equivalent|^cash$/i) ||
      findItem(prepareModuleData(results?.['CF']), ['endingCash', 'closingCash'], /ending cash|closing cash/i);
    const cash = cashItem ? Number(cashItem[last]) : null;

    return { last, rev, growth, netMargin, cash };
  }, [baseYears, revenueItem, isMod, bsMod, results]);

  // --- Horizontal KPI bars: paired % of Revenue vs % of Growth per year (last 5) ---
  const kpiBarData = useMemo(() => {
    if (!revenueItem || baseYears.length === 0) return null;
    const recent = baseYears.slice(-5);

    // Net Income / Revenue used as the "% of Revenue" series (latest profitability ratio)
    const niItem = findItem(isMod, ['netIncomeLoss', 'netIncome'], /net (income|profit)/i);

    const pctRev = recent.map((y) => {
      const r = Number(revenueItem[y]) || 0;
      const n = Number(niItem?.[y]) || 0;
      return r ? (Math.abs(n) / r) * 100 : 0;
    });

    const pctGrowth = recent.map((y, i) => {
      if (i === 0) return 0;
      const cur = Number(revenueItem[y]) || 0;
      const prev = Number(revenueItem[recent[i - 1]]) || 0;
      return prev ? ((cur - prev) / prev) * 100 : 0;
    });

    return {
      labels: recent,
      datasets: [
        {
          label: '% of Revenue',
          data: pctRev,
          backgroundColor: PALETTES.blue[2],
          borderRadius: 4,
          maxBarThickness: 14,
        },
        {
          label: '% of Growth',
          data: pctGrowth,
          backgroundColor: PALETTES.blue[5],
          borderRadius: 4,
          maxBarThickness: 14,
        },
      ],
    };
  }, [baseYears, revenueItem, isMod]);

  // --- Auto-generated narrative insights ---
  const insights = useMemo(() => {
    const lines = [];
    const all = baseYears;
    if (revenueItem && all.length >= 2) {
      const first = Number(revenueItem[all[0]]);
      const last = Number(revenueItem[all[all.length - 1]]);
      if (first && last) {
        const n = all.length - 1;
        const cagr = Math.pow(last / first, 1 / n) - 1;
        lines.push(
          `Revenue moved from ${compact(first)} (${all[0]}) to ${compact(last)} (${all[all.length - 1]}), a ${pct(cagr)} CAGR over ${n} years.`
        );
      }
    }
    if (kpis.netMargin !== null && kpis.netMargin !== undefined) {
      lines.push(`Latest net margin stands at ${pct(kpis.netMargin)} of revenue.`);
    }
    // Largest expense driver
    const items = moduleLineItems(isMod).filter((it) => {
      const v = Number(it.values[kpis.last]);
      return v < 0 || /cost|expense|expenditure/i.test(it.label);
    });
    if (items.length && kpis.rev) {
      const largest = items
        .map((it) => ({ ...it, mag: Math.abs(Number(it.values[kpis.last]) || 0) }))
        .sort((a, b) => b.mag - a.mag)[0];
      if (largest) {
        lines.push(
          `The largest cost component is ${largest.label} at ${pct(largest.mag / kpis.rev)} of revenue.`
        );
      }
    }
    if (forecastStartYear) {
      lines.push(`Figures from ${forecastStartYear} onward are forecast; earlier years are actuals.`);
    }
    return lines;
  }, [baseYears, revenueItem, kpis, isMod, forecastStartYear]);

  // --- Available metrics for the hero custom chart (reuses MetricSelector) ---
  const availableMetrics = useMemo(() => {
    if (activeLevel === '3') {
      if (!level3Category || !level3DataForCategory) return [];
      return Object.entries(level3DataForCategory)
        .filter(([, v]) => v && v.param_name)
        .map(([key, v]) => ({ key, label: v.param_name || key, isLevel3: true, category: level3Category }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    if (!currentData) return [];
    return Object.entries(currentData)
      .filter(([, v]) => v && v.param_name)
      .map(([key, v]) => ({ key, label: v.param_name || key }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [currentData, activeLevel, level3Category, level3DataForCategory]);

  // --- Hero (custom) line chart with gradient fill ---
  const heroData = useMemo(() => {
    const findMetricData = (k) =>
      (currentData && currentData[k]) || (level3DataForCategory && level3DataForCategory[k]) || null;
    if (selectedMetrics.length === 0) return null;

    const transform = (raw) => {
      const rawVals = years.map((y) => Number(raw?.[y]) || 0);
      if (showPctRevenue) {
        return years.map((y, i) => {
          const r = Number(revenueItem?.[y]) || 0;
          return r ? (rawVals[i] / r) * 100 : 0;
        });
      }
      if (showPctGrowth) {
        return years.map((_, i) => {
          if (i === 0) return null;
          const prev = rawVals[i - 1];
          if (!prev) return null;
          return ((rawVals[i] - prev) / Math.abs(prev)) * 100;
        });
      }
      return rawVals;
    };

    const lineColors = [INK, '#3FC592', '#9466E2'];
    const datasets = selectedMetrics.map((key, index) => {
      const raw = findMetricData(key) || {};
      return {
        label: raw.param_name || key,
        data: transform(raw),
        borderColor: lineColors[index % lineColors.length],
        pointBackgroundColor: lineColors[index % lineColors.length],
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2.5,
        tension: 0.35,
        fill: index === 0,
        backgroundColor: (ctx) => {
          const { chart } = ctx;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'rgba(31,85,155,0.08)';
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(31,85,155,0.22)');
          g.addColorStop(1, 'rgba(31,85,155,0.0)');
          return g;
        },
      };
    });
    return { labels: years, datasets };
  }, [currentData, level3DataForCategory, selectedMetrics, years, showPctRevenue, showPctGrowth, revenueItem]);

  const ready = !(isLoading && !results) && !error;

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A' }}>
              Dashboard
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Yearly View · All Charts
            </Typography>
          </Box>
          <Chip
            icon={<BusinessOutlinedIcon sx={{ fontSize: 18 }} />}
            label={clientId || 'Business Name'}
            sx={{
              bgcolor: '#fff',
              border: '1px solid #E2E8F0',
              fontWeight: 600,
              color: '#1E293B',
              '& .MuiChip-icon': { color: INK },
            }}
          />
        </Box>

        {/* Sub-tabs */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
          <Tabs value={statementType} onChange={(e, v) => setStatementType(v)} sx={{ minHeight: 40 }}>
            <Tab label="Income Statement" value="IS" />
            <Tab label="Balance Sheet" value="BS" />
          </Tabs>
          <Tabs
            value={viewMode}
            onChange={(e, v) => setViewMode(v)}
            sx={{
              '& .MuiTab-root': {
                minHeight: 36,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                padding: '6px 16px',
                borderRadius: '18px',
                mr: 1,
                color: '#5e6c84',
                '&.Mui-selected': { color: '#fff', bgcolor: INK },
              },
              '& .MuiTabs-indicator': { display: 'none' },
            }}
          >
            <Tab label="All" value="All" />
            <Tab label="Historical" value="Historical" />
            <Tab label="Forecasted" value="Forecasted" />
          </Tabs>
        </Stack>

        {isLoading && !results && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {ready && (
          <Grid container spacing={3}>
            {/* KPI strip */}
            <Grid item xs={12} md={4}>
              <KpiStat
                label="YTD Revenue"
                value={kpis.rev !== null ? compact(kpis.rev) : '—'}
                sub={
                  kpis.growth !== null
                    ? `${kpis.growth >= 0 ? '+' : ''}${pct(kpis.growth)} Since last year`
                    : undefined
                }
                positive={kpis.growth !== null ? kpis.growth >= 0 : undefined}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <KpiStat
                label="YTD Net Profit"
                value={kpis.netMargin !== null ? pct(kpis.netMargin) : '—'}
                sub={kpis.last ? `as of ${kpis.last}` : undefined}
                positive={kpis.netMargin !== null ? kpis.netMargin >= 0 : undefined}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <KpiStat
                label="Cash Balance"
                value={kpis.cash !== null ? compact(kpis.cash) : '—'}
                sub={
                  kpis.cash !== null && kpis.cash > 0 ? 'Healthy' : kpis.last ? `as of ${kpis.last}` : undefined
                }
                healthy={kpis.cash !== null && kpis.cash > 0}
              />
            </Grid>

            {/* Hero line chart (custom metrics) */}
            <Grid item xs={12}>
              <ChartCard
                title="Performance Trend"
                accent={INK}
                height={320}
                toggle={
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <PillToggle
                      value={period}
                      onChange={setPeriod}
                      options={[
                        { value: 'Monthly', label: 'Monthly' },
                        { value: 'YTD', label: 'YTD' },
                      ]}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={showPctGrowth}
                          onChange={(e) => {
                            setShowPctGrowth(e.target.checked);
                            if (e.target.checked) setShowPctRevenue(false);
                          }}
                          sx={{ color: INK, '&.Mui-checked': { color: INK }, p: 0.3 }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B' }}>
                          % of Growth
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={showPctRevenue}
                          onChange={(e) => {
                            setShowPctRevenue(e.target.checked);
                            if (e.target.checked) setShowPctGrowth(false);
                          }}
                          sx={{ color: INK, '&.Mui-checked': { color: INK }, p: 0.3 }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B' }}>
                          % of Revenue
                        </Typography>
                      }
                    />
                    <PillToggle
                      value={heroChartType}
                      onChange={setHeroChartType}
                      options={[
                        { value: 'line', label: 'Line Chart' },
                        { value: 'bar', label: 'Bar Chart' },
                      ]}
                    />
                    <MetricSelector
                      metrics={availableMetrics}
                      selectedMetrics={selectedMetrics}
                      onToggleMetric={handleToggleMetric}
                      maxSelection={3}
                      activeLevel={activeLevel}
                      onLevelChange={setActiveLevel}
                      level3Categories={LEVEL3_CATEGORIES}
                      selectedLevel3Category={level3Category}
                      onLevel3CategoryChange={setLevel3Category}
                      isLoadingLevel3={false}
                    />
                    <ExportButton chartRef={heroRef} name="Performance Trend" />
                  </Stack>
                }
              >
                {heroData && heroData.datasets.length ? (
                  (() => {
                    const isPercent = showPctRevenue || showPctGrowth;
                    const fmt = (v) =>
                      v === null || v === undefined
                        ? '—'
                        : isPercent
                        ? `${Number(v).toFixed(1)}%`
                        : compact(v);
                    const heroOptions = {
                      maintainAspectRatio: false,
                      interaction: { mode: 'index', intersect: false },
                      plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 14 } },
                        tooltip: {
                          callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y)}` },
                        },
                      },
                      scales: {
                        x: { grid: { display: false } },
                        y: {
                          grid: { color: '#F1F3F6' },
                          ticks: { callback: (v) => fmt(v) },
                        },
                      },
                    };
                    return heroChartType === 'line' ? (
                      <Line ref={heroRef} data={heroData} options={heroOptions} />
                    ) : (
                      <Bar
                        ref={heroRef}
                        data={{
                          labels: heroData.labels,
                          datasets: heroData.datasets.map((ds) => ({
                            label: ds.label,
                            data: ds.data,
                            backgroundColor: ds.borderColor,
                            borderRadius: 4,
                            maxBarThickness: 38,
                          })),
                        }}
                        options={heroOptions}
                      />
                    );
                  })()
                ) : (
                  <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.secondary">Select metrics to visualize the trend.</Typography>
                  </Box>
                )}
              </ChartCard>
            </Grid>

            {/* KPI Analysis (paired bars) + Commentary panel */}
            <Grid item xs={12} md={7}>
              <ChartCard
                title="KPI Analysis (%)"
                accent={PALETTES.blue[5]}
                height={300}
                toggle={<ExportButton chartRef={kpiRef} name="KPI Analysis" />}
              >
                {kpiBarData ? (
                  <Bar
                    ref={kpiRef}
                    data={kpiBarData}
                    plugins={[pctLabelPlugin]}
                    options={{
                      indexAxis: 'y',
                      maintainAspectRatio: false,
                      layout: { padding: { right: 60 } },
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 14 },
                        },
                        tooltip: {
                          callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.x.toFixed(1)}%` },
                        },
                      },
                      scales: {
                        x: { grid: { color: '#F1F3F6' }, ticks: { callback: (v) => `${v}%` } },
                        y: { grid: { display: false }, ticks: { font: { size: 12, weight: '600' } } },
                      },
                    }}
                  />
                ) : (
                  <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.secondary">No ratio data available.</Typography>
                  </Box>
                )}
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  height: '100%',
                  border: '1px solid #ECEFF3',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 2 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 4, height: 22, borderRadius: 2, bgcolor: INK }} />
                    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B' }}>
                      Commentary
                    </Typography>
                  </Stack>
                </Stack>
                <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
                  <Stack spacing={1.5}>
                    {insights.length ? (
                      insights.map((line, i) => (
                        <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                          <Box
                            sx={{
                              mt: '7px',
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: PALETTES.blue[5],
                              flexShrink: 0,
                            }}
                          />
                          <Typography sx={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.55 }}>
                            {line}
                          </Typography>
                        </Stack>
                      ))
                    ) : (
                      <Typography color="text.secondary">No insights available yet.</Typography>
                    )}
                  </Stack>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '20px',
                    px: 1.5,
                    py: 0.5,
                  }}
                >
                  <TextField
                    placeholder="Write commentary…"
                    value={commentary}
                    onChange={(e) => setCommentary(e.target.value)}
                    variant="standard"
                    fullWidth
                    InputProps={{ disableUnderline: true, sx: { fontSize: '0.85rem' } }}
                  />
                  <IconButton size="small">
                    <AttachFileOutlinedIcon sx={{ fontSize: 18, color: '#64748B' }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    sx={{ bgcolor: INK, color: '#fff', '&:hover': { bgcolor: '#17427C' } }}
                  >
                    <SendOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              </Paper>
            </Grid>

            {/* Stacked sections — one color family each */}
            <Grid item xs={12}>
              <StackedSection
                title="Operational Expenses"
                mod={isMod}
                years={years}
                paletteKey="blue"
                highlightYear={viewMode !== 'Forecasted' ? highlightYear : null}
                revenue={revenueItem}
                altMode="pct_revenue"
                altLabel="% of Revenue"
              />
            </Grid>
            <Grid item xs={12}>
              <StackedSection
                title="% of Revenue"
                mod={prepareModuleData(results?.['S&M']) || isMod}
                years={years}
                paletteKey="purple"
                highlightYear={viewMode !== 'Forecasted' ? highlightYear : null}
                revenue={revenueItem}
                altMode="pct_revenue"
                altLabel="% of Revenue"
              />
            </Grid>
            <Grid item xs={12}>
              <StackedSection
                title="Annual Growth"
                mod={prepareModuleData(results?.['G&A']) || prepareModuleData(results?.['FA']) || isMod}
                years={years}
                paletteKey="teal"
                highlightYear={viewMode !== 'Forecasted' ? highlightYear : null}
                revenue={revenueItem}
                altMode="pct_total"
                altLabel="Common Size"
              />
            </Grid>
            <Grid item xs={12}>
              <StackedSection
                title="Common Size"
                mod={bsMod || isMod}
                years={years}
                paletteKey="grey"
                highlightYear={viewMode !== 'Forecasted' ? highlightYear : null}
                revenue={revenueItem}
                altMode="pct_total"
                altLabel="Common Size"
              />
            </Grid>
          </Grid>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default ReportGenerator;
