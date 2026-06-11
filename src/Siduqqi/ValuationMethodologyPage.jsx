import React, { useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { ThemeProvider } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

import LinkedinAITheme from '../LinkedinAI/style/LinkedinAITheme';
import { useEngine } from './context/EngineContext';
import { useSettings } from './context/SettingsContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

const INK = '#1F559B';
const HEAD_BG = '#1F559B';
const ACCENT = '#DC2626';

// --- Formatters (VM values are already in SAR Millions) ---
const fmtMM = (v, digits = 2) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Number(v).toFixed(digits);
};
const fmtPct = (v, digits = 1) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${(Number(v) * 100).toFixed(digits)}%`;
};

// Football-field range rows in display order
const RANGE_KEY_ORDER = [
  'dcfRange',
  'ebitdaMultipleFy1Range',
  'ebitdaMultipleFy2Range',
  'revenueMultipleRange',
  'bookValueRange',
];

// Weighted summary rows in display order — fairValueEstimate is the overall row, handled separately
const WEIGHTED_KEY_ORDER = [
  'weightedDcf',
  'weightedEbitdaFy1',
  'weightedEbitdaFy2',
  'weightedBookValue',
];

// Inline plugin: draws a vertical reference line at the fair value estimate
function makeFairValueLinePlugin(fairValue) {
  return {
    id: 'fairValueLine',
    afterDatasetsDraw(chart) {
      if (fairValue === null || fairValue === undefined || isNaN(fairValue)) return;
      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(Number(fairValue));
      if (!isFinite(x) || x < chartArea.left || x > chartArea.right) return;
      ctx.save();
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      // Label above the line
      ctx.fillStyle = ACCENT;
      ctx.font = '700 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Fair Value ${Number(fairValue).toFixed(1)}`, x, chartArea.top - 4);
      ctx.restore();
    },
  };
}

function FootballField({ vm, fairValue }) {
  const chartRef = useRef(null);

  const { labels, ranges, comments, axisMax } = useMemo(() => {
    const lbls = [];
    const rgs = [];
    const cmts = [];
    let maxUpper = 0;

    RANGE_KEY_ORDER.forEach((key) => {
      const r = vm?.[key];
      if (!r) return;
      let lo = Number(r.lower);
      let hi = Number(r.upper);
      if (isNaN(lo) || isNaN(hi)) return;
      // For point estimates (book value), give the bar a tiny visible width
      if (lo === hi) {
        const eps = Math.max(lo * 0.01, 0.3);
        lo -= eps;
        hi += eps;
      }
      lbls.push(r.param_name || key);
      rgs.push([lo, hi]);
      cmts.push(r.comment || '');
      maxUpper = Math.max(maxUpper, Number(r.upper) || 0);
    });

    // Include fair value in the axis range calculation
    maxUpper = Math.max(maxUpper, Number(fairValue) || 0);
    const aMax = Math.ceil(maxUpper / 10) * 10 || 100;
    return { labels: lbls, ranges: rgs, comments: cmts, axisMax: aMax };
  }, [vm, fairValue]);

  if (labels.length === 0) {
    return (
      <Alert severity="info">No valuation ranges available to chart.</Alert>
    );
  }

  const data = {
    labels,
    datasets: [
      {
        label: 'Range (SAR MM)',
        data: ranges,
        backgroundColor: labels.map((_, i) => {
          const palette = ['#5A86E8', '#9466E2', '#7E45D6', '#3FC592', '#FBBF24'];
          return palette[i % palette.length];
        }),
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.55,
      },
    ],
  };

  const options = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const i = ctx.dataIndex;
            const r = vm?.[RANGE_KEY_ORDER[i]];
            const loLabel = r?.lowerLabel ? `${r.lowerLabel}: ` : '';
            const hiLabel = r?.upperLabel ? `${r.upperLabel}: ` : '';
            const cmt = comments[i] ? ` — ${comments[i]}` : '';
            return `${loLabel}${Number(r?.lower).toFixed(1)}  ${hiLabel}${Number(r?.upper).toFixed(1)}${cmt}`;
          },
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: axisMax,
        grid: { color: '#F1F3F6' },
        ticks: {
          font: { size: 11 },
          callback: (v) => `${v}`,
        },
        title: { display: true, text: 'SAR Millions', font: { size: 11, weight: '600' }, color: '#64748B' },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 12, weight: '600' } },
      },
    },
  };

  return (
    <Paper elevation={0} sx={{ border: '1px solid #ECEFF3', borderRadius: 2, p: 2.5 }}>
      <Box sx={{ height: 320 }}>
        <Bar
          ref={chartRef}
          data={data}
          options={options}
          plugins={[makeFairValueLinePlugin(fairValue)]}
        />
      </Box>
      {/* Range labels below the chart */}
      <Stack spacing={0.5} sx={{ mt: 2 }}>
        {RANGE_KEY_ORDER.map((key) => {
          const r = vm?.[key];
          if (!r) return null;
          const isPoint = Number(r.lower) === Number(r.upper);
          return (
            <Stack
              key={key}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ fontSize: '0.78rem', color: '#475569' }}
            >
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
                {r.param_name}
                {r.comment && (
                  <Tooltip title={r.comment}>
                    <InfoOutlinedIcon sx={{ fontSize: 13, ml: 0.5, verticalAlign: 'middle', color: '#94A3B8' }} />
                  </Tooltip>
                )}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1E293B', fontVariantNumeric: 'tabular-nums' }}>
                {isPoint
                  ? `${fmtMM(r.lower, 1)} (point)`
                  : `${fmtMM(r.lower, 1)} — ${fmtMM(r.upper, 1)}`}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

function WeightedSummaryTable({ vm }) {
  const headSx = { bgcolor: HEAD_BG, color: '#fff', fontWeight: 700, fontSize: '0.82rem' };
  const cellSx = { fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' };

  const fairValue = vm?.fairValueEstimate;

  return (
    <Paper elevation={0} sx={{ border: '1px solid #ECEFF3', borderRadius: 2, overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headSx}>Method</TableCell>
            <TableCell align="right" sx={headSx}>SAR MM</TableCell>
            <TableCell align="right" sx={headSx}>Weight</TableCell>
            <TableCell align="right" sx={headSx}>Contribution</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {WEIGHTED_KEY_ORDER.map((key, i) => {
            const row = vm?.[key];
            if (!row) return null;
            const stripeBg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
            return (
              <TableRow key={key}>
                <TableCell sx={{ ...cellSx, fontWeight: 600, bgcolor: stripeBg }}>
                  {row.param_name || key}
                </TableCell>
                <TableCell align="right" sx={{ ...cellSx, bgcolor: stripeBg }}>
                  {fmtMM(row.value)}
                </TableCell>
                <TableCell align="right" sx={{ ...cellSx, bgcolor: stripeBg }}>
                  {fmtPct(row.weight, 1)}
                </TableCell>
                <TableCell align="right" sx={{ ...cellSx, fontWeight: 700, bgcolor: stripeBg }}>
                  {fmtMM(row.contribution)}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Overall fair value row */}
          {fairValue && (
            <TableRow>
              <TableCell
                sx={{
                  ...cellSx,
                  fontWeight: 800,
                  bgcolor: '#EFF6FF',
                  borderTop: '3px solid ' + INK,
                  fontSize: '0.95rem',
                }}
              >
                {fairValue.param_name || 'Overall fair value estimate'}
              </TableCell>
              <TableCell
                align="right"
                sx={{ ...cellSx, bgcolor: '#EFF6FF', borderTop: '3px solid ' + INK }}
              />
              <TableCell
                align="right"
                sx={{
                  ...cellSx,
                  fontWeight: 800,
                  bgcolor: '#EFF6FF',
                  borderTop: '3px solid ' + INK,
                }}
              >
                {fmtPct(fairValue.weight_total, 1)}
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  ...cellSx,
                  fontWeight: 800,
                  fontSize: '1.4rem',
                  color: INK,
                  bgcolor: '#EFF6FF',
                  borderTop: '3px solid ' + INK,
                }}
              >
                {fmtMM(fairValue.value)} ★
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Typography sx={{ p: 1.5, fontSize: '0.72rem', color: '#64748B' }}>
        ★ Final estimate is FLOOR(Σ contributions / 0.5) × 0.5 (Excel parity).
      </Typography>
    </Paper>
  );
}

const ValuationMethodologyPage = () => {
  const { results, loading, error } = useEngine();
  const { clientId } = useSettings();
  const navigate = useNavigate();

  const vm = results?.['VM'] || null;
  const fairValue = vm?.fairValueEstimate?.value;

  if (loading && !results) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0F172A' }}>
              Valuation Methodology
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Football field and weighted fair value (SAR Millions)
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/assumptions')}
              sx={{ textTransform: 'none', borderRadius: '18px', fontWeight: 600 }}
            >
              Edit assumptions
            </Button>
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
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {!vm && (
          <Alert severity="info">
            No VM (Valuation Methodology) data available for this client.
          </Alert>
        )}

        {vm && (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, mb: 1.5 }}>
              <Box sx={{ width: 4, height: 20, borderRadius: 2, bgcolor: INK }} />
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B', letterSpacing: 0.4 }}>
                VALUATION RANGES (SAR MILLIONS) — FOOTBALL FIELD
              </Typography>
            </Stack>
            <FootballField vm={vm} fairValue={fairValue} />

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 4, mb: 1.5 }}>
              <Box sx={{ width: 4, height: 20, borderRadius: 2, bgcolor: INK }} />
              <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B', letterSpacing: 0.4 }}>
                WEIGHTED AVERAGE FAIR VALUE
              </Typography>
              <Tooltip title="Revenue Multiple is shown in the football field but intentionally not included in the weighted average (Excel parity).">
                <InfoOutlinedIcon sx={{ fontSize: 16, color: '#94A3B8' }} />
              </Tooltip>
            </Stack>
            <WeightedSummaryTable vm={vm} />
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default ValuationMethodologyPage;
