import React, { useMemo, useRef } from 'react';
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
  Stack,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Menu,
  MenuItem,
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import { ThemeProvider } from '@mui/material/styles';
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
import { Bar, Line } from 'react-chartjs-2';

import LinkedinAITheme from '../LinkedinAI/style/LinkedinAITheme';
import { useEngine } from './context/EngineContext';
import { useSettings } from './context/SettingsContext';

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

// --- Palette (matches the design's light-blue executive look) ---
const INK = '#1F559B';
const BAR_HISTORICAL = '#BFD4F2';
const BAR_FORECAST = '#3F6FD8';
const LINE_COLOR = '#1F559B';

// --- Helpers (read engine results dynamically; no hardcoded years) ---
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

function pickItem(mod, keys = [], rx = null) {
  if (!mod) return null;
  for (const k of keys) if (mod[k]) return mod[k];
  if (rx) {
    const hit = Object.values(mod).find((v) => v?.param_name && rx.test(v.param_name));
    if (hit) return hit;
  }
  return null;
}

function yearValues(item, years) {
  if (!item) return years.map(() => 0);
  return years.map((y) => {
    const v = Number(item[y]);
    return isNaN(v) ? 0 : v;
  });
}

function sumItems(items, years) {
  return years.map((y) =>
    items.reduce((acc, it) => acc + (Number(it?.[y]) || 0), 0)
  );
}

// --- UI atoms ---

function ChartCard({ title, accent = INK, action = null, children, height = 280 }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        height: '100%',
        border: '1px solid #ECEFF3',
        bgcolor: '#fff',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          gap: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 4, height: 22, borderRadius: 2, bgcolor: accent }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B' }}>
            {title}
          </Typography>
        </Stack>
        {action}
      </Box>
      <Box sx={{ height }}>{children}</Box>
    </Paper>
  );
}

function ExportButton({ chartRef, name }) {
  const handle = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const url = chart.toBase64Image('image/png', 1);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '_')}.png`;
    a.click();
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

function EmptyChart({ message = 'No data available.' }) {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>
        {message}
      </Typography>
    </Box>
  );
}

// --- Chart builders ---

const baseBarOptions = (formatY = compact) => ({
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => formatY(ctx.parsed.y),
      },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
    y: {
      grid: { color: '#F1F3F6' },
      ticks: { font: { size: 11 }, callback: (v) => formatY(v) },
      beginAtZero: true,
    },
  },
});

function buildBarData(years, values, forecastStartYear) {
  return {
    labels: years,
    datasets: [
      {
        data: values,
        backgroundColor: years.map((y) =>
          forecastStartYear && Number(y) >= forecastStartYear ? BAR_FORECAST : BAR_HISTORICAL
        ),
        borderRadius: 4,
        maxBarThickness: 38,
      },
    ],
  };
}

function buildLineData(years, values) {
  return {
    labels: years,
    datasets: [
      {
        data: values,
        borderColor: LINE_COLOR,
        backgroundColor: 'rgba(31,85,155,0.08)',
        pointBackgroundColor: LINE_COLOR,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
      },
    ],
  };
}

// --- Metric panel: renders one chart card from a metric spec ---

function MetricChart({ spec, years, forecastStartYear }) {
  const chartRef = useRef(null);
  const hasAny = spec.values?.some((v) => v !== 0 && v !== null && v !== undefined);

  return (
    <ChartCard
      title={spec.title}
      accent={INK}
      height={260}
      action={<ExportButton chartRef={chartRef} name={spec.title} />}
    >
      {hasAny ? (
        spec.kind === 'line' ? (
          <Line
            ref={chartRef}
            data={buildLineData(years, spec.values)}
            options={baseBarOptions(spec.format || compact)}
          />
        ) : (
          <Bar
            ref={chartRef}
            data={buildBarData(years, spec.values, forecastStartYear)}
            options={baseBarOptions(spec.format || compact)}
          />
        )
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}

// --- Financial Highlights table ---

const fmtNum = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const rounded = Math.round(Number(n));
  if (rounded < 0) return `(${Math.abs(rounded).toLocaleString('en-US')})`;
  return rounded.toLocaleString('en-US');
};

const fmtPctRow = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${Math.round(n * 100)}%`;
};

function exportTableCsv(rows, actualYears, forecastYears, fileName = 'Financial_Highlights') {
  const allYears = [...actualYears, ...forecastYears];
  const header = ['Key Highlights (SAR)', ...allYears];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    const cells = [`"${r.label}"`, ...allYears.map((y, i) => {
      const v = r.values[i];
      const formatted = r.kind === 'pct' ? fmtPctRow(v) : fmtNum(v);
      return `"${formatted}"`;
    })];
    lines.push(cells.join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function HighlightsTable({ rows, actualYears, forecastYears, footer }) {
  const [anchor, setAnchor] = React.useState(null);

  const cellSx = {
    fontSize: '0.82rem',
    color: '#1E293B',
    py: 1.2,
    px: 1.5,
    borderBottom: '1px solid #F1F5F9',
    whiteSpace: 'nowrap',
  };
  const labelSx = { ...cellSx, fontWeight: 600, bgcolor: '#F8FAFC', position: 'sticky', left: 0, zIndex: 1 };
  const numSx = { ...cellSx, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const yearHeaderSx = {
    ...cellSx,
    fontWeight: 700,
    color: '#475569',
    textAlign: 'right',
    bgcolor: '#FFF',
    borderBottom: '1px solid #E2E8F0',
  };

  return (
    <Paper
      elevation={0}
      sx={{ p: 3, borderRadius: 3, border: '1px solid #ECEFF3', bgcolor: '#fff', overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B' }}>
          Financial Highlights
        </Typography>
        <Button
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            bgcolor: INK,
            color: '#fff',
            borderRadius: '18px',
            px: 2,
            fontSize: '0.78rem',
            '&:hover': { bgcolor: '#17427C' },
          }}
        >
          Export
        </Button>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          <MenuItem
            onClick={() => {
              exportTableCsv(rows, actualYears, forecastYears);
              setAnchor(null);
            }}
          >
            Download CSV
          </MenuItem>
          <MenuItem
            onClick={() => {
              window.print();
              setAnchor(null);
            }}
          >
            Print / Save as PDF
          </MenuItem>
        </Menu>
      </Box>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            {/* Section header row: Actual / Forecast bands */}
            <TableRow>
              <TableCell
                sx={{
                  bgcolor: INK,
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  borderBottom: 'none',
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                }}
              >
                Key Highlights (SAR)
              </TableCell>
              {actualYears.length > 0 && (
                <TableCell
                  align="center"
                  colSpan={actualYears.length}
                  sx={{
                    bgcolor: INK,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    borderBottom: 'none',
                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  Actual
                </TableCell>
              )}
              {forecastYears.length > 0 && (
                <TableCell
                  align="center"
                  colSpan={forecastYears.length}
                  sx={{
                    bgcolor: INK,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    borderBottom: 'none',
                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                    borderTopRightRadius: 6,
                    borderBottomRightRadius: 6,
                  }}
                >
                  Forecast
                </TableCell>
              )}
            </TableRow>
            {/* Year header row */}
            <TableRow>
              <TableCell sx={{ ...yearHeaderSx, textAlign: 'left', bgcolor: '#F8FAFC' }} />
              {[...actualYears, ...forecastYears].map((y) => (
                <TableCell key={y} sx={yearHeaderSx}>
                  {y}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, idx) => {
              const stripeBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
              return (
                <TableRow key={r.key}>
                  <TableCell sx={{ ...labelSx, bgcolor: stripeBg }}>{r.label}</TableCell>
                  {[...actualYears, ...forecastYears].map((y, i) => {
                    const v = r.values[i];
                    const display = r.kind === 'pct' ? fmtPctRow(v) : fmtNum(v);
                    return (
                      <TableCell key={y} sx={{ ...numSx, bgcolor: stripeBg }}>
                        {display}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* Footer KPIs */}
      {footer && (
        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.2, alignItems: 'flex-end' }}>
          {footer.terminalValue !== null && footer.terminalValue !== undefined && (
            <Stack direction="row" spacing={6} alignItems="center">
              <Typography sx={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>
                Terminal Value Estimate
              </Typography>
              <Typography sx={{ fontSize: '0.9rem', color: '#0F172A', fontWeight: 700, minWidth: 120, textAlign: 'right' }}>
                {fmtNum(footer.terminalValue)}
              </Typography>
            </Stack>
          )}
          {footer.roi?.length > 0 && (
            <Stack direction="row" spacing={3} alignItems="center">
              <Typography sx={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>
                ROI
              </Typography>
              {footer.roi.map((v, i) => (
                <Typography key={i} sx={{ fontSize: '0.9rem', color: INK, fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                  {fmtPctRow(v)}
                </Typography>
              ))}
            </Stack>
          )}
          {footer.roe?.length > 0 && (
            <Stack direction="row" spacing={3} alignItems="center">
              <Typography sx={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>
                ROE
              </Typography>
              {footer.roe.map((v, i) => (
                <Typography key={i} sx={{ fontSize: '0.9rem', color: INK, fontWeight: 700, minWidth: 60, textAlign: 'right' }}>
                  {fmtPctRow(v)}
                </Typography>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );
}

// --- Main component ---

const FinancialSummaryTable = () => {
  const { results, assumptions, loading, error } = useEngine();
  const { clientId } = useSettings();
  const [activeTab, setActiveTab] = React.useState(0);

  const isMod = useMemo(() => prepareModuleData(results?.['IS-CON']), [results]);
  const bsMod = useMemo(() => prepareModuleData(results?.['BS']), [results]);
  const wcMod = useMemo(() => prepareModuleData(results?.['WC']), [results]);
  const debtMod = useMemo(() => prepareModuleData(results?.['DEBT']), [results]);
  const cfMod = useMemo(() => prepareModuleData(results?.['CF']), [results]);
  // Valuation total — legacy `valuation` module was split into BV/Comps/VM.
  // Prefer BV.equityValue (DCF total) and fall back to VM.fairValueEstimate.
  const bvMod = useMemo(() => prepareModuleData(results?.['BV']), [results]);
  const vmMod = useMemo(() => prepareModuleData(results?.['VM']), [results]);

  const years = useMemo(() => moduleYears(isMod || bsMod), [isMod, bsMod]);

  const forecastStartYear = assumptions?.general?.reporting_date
    ? assumptions.general.reporting_date + 1
    : undefined;

  // ---- Income Statement metrics ----
  const incomeMetrics = useMemo(() => {
    if (!isMod) return [];
    const revenue = pickItem(isMod, ['revenue'], /^revenue$/i);
    const grossProfit = pickItem(isMod, ['grossProfit'], /gross profit/i);
    const ebitda = pickItem(isMod, ['EBITDA', 'ebitda'], /ebitda/i);
    const netIncome = pickItem(
      isMod,
      ['netIncome', 'netIncomeLoss', 'netProfit'],
      /net (income|profit)/i
    );

    const revenueValues = yearValues(revenue, years);
    const gpValues = yearValues(grossProfit, years);
    const grossMarginValues = years.map((_, i) =>
      revenueValues[i] ? (gpValues[i] / revenueValues[i]) * 100 : 0
    );

    return [
      { key: 'revenue', title: 'Revenue', kind: 'bar', values: revenueValues, format: compact },
      {
        key: 'grossMargin',
        title: 'Gross Margin',
        kind: 'line',
        values: grossMarginValues,
        format: (v) => `${(v ?? 0).toFixed(1)}%`,
      },
      { key: 'ebitda', title: 'EBITDA', kind: 'bar', values: yearValues(ebitda, years), format: compact },
      {
        key: 'netProfit',
        title: 'Net Profit',
        kind: 'bar',
        values: yearValues(netIncome, years),
        format: compact,
      },
    ];
  }, [isMod, years]);

  // ---- Balance Sheet metrics ----
  const balanceMetrics = useMemo(() => {
    if (!bsMod && !wcMod && !debtMod) return [];

    // Working Capital — prefer WC.operatingWorkingCapital, else BS CA − CL
    const owc = pickItem(wcMod, ['operatingWorkingCapital'], /operating working capital/i);
    let workingCapitalValues;
    if (owc) {
      workingCapitalValues = yearValues(owc, years);
    } else {
      const ca = pickItem(bsMod, ['totalCurrentAssets']);
      const cl = pickItem(bsMod, ['totalCurrentLiabilities']);
      const caV = yearValues(ca, years);
      const clV = yearValues(cl, years);
      workingCapitalValues = years.map((_, i) => caV[i] - Math.abs(clV[i]));
    }

    const ppe = pickItem(bsMod, ['propertyAndEquipment'], /property and equipment/i);
    const equity = pickItem(bsMod, ['totalEquity'], /total equity|shareholders' equity/i);

    // Debt financing — DEBT closingBalance preferred, else BS short + long term borrowings
    let debtValues;
    const debtClosing = pickItem(debtMod, ['closingBalance']);
    if (debtClosing) {
      debtValues = yearValues(debtClosing, years);
    } else {
      const st = pickItem(bsMod, ['shortTermBorrowings']);
      const lt = pickItem(bsMod, ['longTermBorrowings']);
      debtValues = sumItems([st, lt], years);
    }

    return [
      {
        key: 'workingCapital',
        title: 'Working Capital',
        kind: 'bar',
        values: workingCapitalValues,
        format: compact,
      },
      {
        key: 'fixedAssets',
        title: 'Fixed Assets',
        kind: 'bar',
        values: yearValues(ppe, years),
        format: compact,
      },
      {
        key: 'equity',
        title: "Shareholder's Equity",
        kind: 'bar',
        values: yearValues(equity, years),
        format: compact,
      },
      {
        key: 'debt',
        title: 'Debt Financing',
        kind: 'bar',
        values: debtValues,
        format: compact,
      },
    ];
  }, [bsMod, wcMod, debtMod, years]);

  // ---- Financial Highlights pivot table data ----
  const highlightsData = useMemo(() => {
    if (years.length === 0) return null;

    const actualYears = forecastStartYear
      ? years.filter((y) => Number(y) < forecastStartYear)
      : years;
    const forecastYears = forecastStartYear
      ? years.filter((y) => Number(y) >= forecastStartYear)
      : [];

    const revenue = pickItem(isMod, ['revenue'], /^revenue$/i);
    const operatingProfit = pickItem(isMod, ['operatingProfit'], /operating profit/i);
    const ebitda = pickItem(isMod, ['EBITDA', 'ebitda'], /ebitda/i);
    const netIncome = pickItem(
      isMod,
      ['netIncome', 'netIncomeLoss'],
      /net (income|profit)/i
    );
    const ocf = pickItem(
      cfMod,
      ['cashGeneratedFromOperatingActivities', 'cashIncome', 'operatingActivities'],
      /operating activit/i
    );
    const capex = pickItem(cfMod, ['capex', 'capitalExpenditures'], /capital expenditure|capex/i);
    const ncf = pickItem(
      cfMod,
      ['netChangeInCash', 'freeCashFlows'],
      /net change in cash|free cash/i
    );
    const equityInv = pickItem(
      bsMod,
      ['equityAccountedInvestment', 'investmentsAtFairValue'],
      /equity (accounted )?investment|investments at fair/i
    );
    const equity = pickItem(bsMod, ['totalEquity'], /total equity|shareholders' equity/i);
    const roa = pickItem(bsMod, ['roa'], /roa|return on assets/i);
    const roeItem = pickItem(bsMod, ['roe'], /roe|return on equity/i);

    const allYears = [...actualYears, ...forecastYears];
    const revVals = yearValues(revenue, allYears);
    const growthVals = allYears.map((y, i) => {
      const cur = revVals[i];
      const prev = i > 0 ? revVals[i - 1] : null;
      if (!prev || prev === 0) return null;
      return (cur - prev) / prev;
    });
    const opVals = yearValues(operatingProfit, allYears);
    const ebitdaVals = yearValues(ebitda, allYears);
    const niVals = yearValues(netIncome, allYears);
    const ratio = (numV, denV) =>
      allYears.map((_, i) => (denV[i] ? numV[i] / denV[i] : null));

    const rows = [
      { key: 'revenue', label: 'Revenue', kind: 'num', values: revVals },
      { key: 'salesGrowth', label: 'Sales Annual Growth%', kind: 'pct', values: growthVals },
      { key: 'netContribution', label: 'Net Contribution', kind: 'num', values: opVals },
      {
        key: 'netContributionMargin',
        label: 'Net Contribution Margin %',
        kind: 'pct',
        values: ratio(opVals, revVals),
      },
      { key: 'ebitda', label: 'EBITDA', kind: 'num', values: ebitdaVals },
      {
        key: 'ebitdaPct',
        label: 'EBITDA %',
        kind: 'pct',
        values: ratio(ebitdaVals, revVals),
      },
      { key: 'netIncome', label: 'Net Income/(Loss)', kind: 'num', values: niVals },
      {
        key: 'netIncomePct',
        label: 'Net Income %',
        kind: 'pct',
        values: ratio(niVals, revVals),
      },
      { key: 'ocf', label: 'Operating Cash Flow', kind: 'num', values: yearValues(ocf, allYears) },
      {
        key: 'capex',
        label: 'Capex Req. (Tangible & Intangible)',
        kind: 'num',
        values: yearValues(capex, allYears),
      },
      { key: 'netCashFlow', label: 'Net Cash Flow', kind: 'num', values: yearValues(ncf, allYears) },
      {
        key: 'equityInvestment',
        label: 'Equity Investment',
        kind: 'num',
        values: yearValues(equityInv, allYears),
      },
      {
        key: 'shareholdersEquity',
        label: "Shareholder's Equity",
        kind: 'num',
        values: yearValues(equity, allYears),
      },
    ];

    // Footer metrics — show terminal value if valuation present, last 3 fwd years for ROI/ROE
    const tail = forecastYears.slice(-3);
    const tailIdx = tail.map((y) => allYears.indexOf(y));
    const roiVals = tailIdx.map((i) => (i >= 0 ? yearValues(roa, allYears)[i] : null));
    const roeVals = tailIdx.map((i) => (i >= 0 ? yearValues(roeItem, allYears)[i] : null));
    // Terminal Value Estimate — prefer BV.equityValue (DCF valuation total).
    // BV's summary block carries only the last forecast year; if absent, fall back to
    // VM.fairValueEstimate (already in SAR Millions — convert to absolute SAR for parity).
    const bvEquity = bvMod?.equityValue;
    const bvLastYear = bvEquity
      ? Object.keys(bvEquity).find((k) => /^\d{4}$/.test(k))
      : null;
    let terminalValue = bvLastYear ? Number(bvEquity?.[bvLastYear]) : null;
    if ((terminalValue === null || isNaN(terminalValue)) && vmMod?.fairValueEstimate?.value !== undefined) {
      terminalValue = Number(vmMod.fairValueEstimate.value) * 1_000_000;
    }

    const footer = {
      terminalValue:
        terminalValue !== null && terminalValue !== undefined && !isNaN(terminalValue)
          ? terminalValue
          : null,
      roi: roiVals,
      roe: roeVals,
    };

    return { rows, actualYears, forecastYears, footer };
  }, [isMod, bsMod, cfMod, bvMod, vmMod, years, forecastStartYear]);

  // ---- Render ----
  const ready = !(loading && !results) && !error;
  const businessName = clientId || 'Business Name';

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A' }}>
              Financial Summary
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Executive view across statements
            </Typography>
          </Box>
          <Chip
            icon={<BusinessOutlinedIcon sx={{ fontSize: 18 }} />}
            label={businessName}
            sx={{
              bgcolor: '#fff',
              border: '1px solid #E2E8F0',
              fontWeight: 600,
              color: '#1E293B',
              '& .MuiChip-icon': { color: INK },
            }}
          />
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            mb: 3,
            minHeight: 40,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: '#64748B',
              minHeight: 40,
              '&.Mui-selected': { color: INK },
            },
            '& .MuiTabs-indicator': { backgroundColor: INK, height: 3, borderRadius: 2 },
          }}
        >
          <Tab label="Income Statement" />
          <Tab label="Balance Sheet" />
          <Tab label="Financial Highlights" />
        </Tabs>

        {loading && !results && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {ready && years.length === 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            No engine results available for this client yet. Run the pipeline or recalculate first.
          </Alert>
        )}

        {ready && years.length > 0 && (
          <>
            {activeTab === 0 && (
              <Grid container spacing={3}>
                {incomeMetrics.map((m) => (
                  <Grid item xs={12} md={6} key={m.key}>
                    <MetricChart spec={m} years={years} forecastStartYear={forecastStartYear} />
                  </Grid>
                ))}
              </Grid>
            )}

            {activeTab === 1 && (
              <Grid container spacing={3}>
                {balanceMetrics.map((m) => (
                  <Grid item xs={12} md={6} key={m.key}>
                    <MetricChart spec={m} years={years} forecastStartYear={forecastStartYear} />
                  </Grid>
                ))}
              </Grid>
            )}

            {activeTab === 2 && highlightsData && (
              <HighlightsTable
                rows={highlightsData.rows}
                actualYears={highlightsData.actualYears}
                forecastYears={highlightsData.forecastYears}
                footer={highlightsData.footer}
              />
            )}
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default FinancialSummaryTable;
