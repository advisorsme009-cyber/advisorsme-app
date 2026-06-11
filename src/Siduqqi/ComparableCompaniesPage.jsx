import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Button,
  Grid,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { ThemeProvider } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

import LinkedinAITheme from '../LinkedinAI/style/LinkedinAITheme';
import { useEngine } from './context/EngineContext';
import { useSettings } from './context/SettingsContext';

const INK = '#1F559B';
const HEAD_BG = '#1F559B';

// --- Formatters ---
const fmtMoney = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const n = Math.round(Number(v));
  if (n < 0) return `(${Math.abs(n).toLocaleString('en-US')})`;
  return n.toLocaleString('en-US');
};
const fmtPct = (v, digits = 1) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${(Number(v) * 100).toFixed(digits)}%`;
};
const fmtMultiple = (v, digits = 1) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Number(v).toFixed(digits);
};
const fmtFactor = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Number(v).toFixed(4);
};

// Row order inside each scenario block (do not reorder per spec)
const SCENARIO_ROW_ORDER = [
  'ebitda',
  'multiple',
  'evEstimateGross',
  'pvFactor',
  'evEstimate',
  'netDebt',
  'equityEstimate',
];

function ScenarioBlock({ title, block }) {
  if (!block) return null;
  const year = block.ebitda?.year || block.multiple?.year || '';

  // Reconciliation check: equityEstimate ≈ evEstimate + netDebt
  const ev = Number(block.evEstimate?.value) || 0;
  const nd = Number(block.netDebt?.value) || 0;
  const eq = Number(block.equityEstimate?.value) || 0;
  const reconciles = Math.abs(eq - (ev + nd)) < 1;

  return (
    <Paper elevation={0} sx={{ border: '1px solid #ECEFF3', borderRadius: 2, p: 2.5, height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 4, height: 18, borderRadius: 2, bgcolor: INK }} />
          <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B' }}>
            {title}
          </Typography>
        </Stack>
        {year && (
          <Chip
            label={year}
            size="small"
            sx={{ bgcolor: '#EFF6FF', color: INK, fontWeight: 700, fontSize: '0.72rem' }}
          />
        )}
      </Stack>

      <Stack divider={<Box sx={{ height: 1, bgcolor: '#F1F5F9' }} />}>
        {SCENARIO_ROW_ORDER.map((rowKey) => {
          const row = block[rowKey];
          if (!row) return null;

          const isMultiple = rowKey === 'multiple';
          const isFactor = rowKey === 'pvFactor';
          const isEquity = rowKey === 'equityEstimate';
          const value = row.value;

          const display = isMultiple
            ? fmtMultiple(value, 1)
            : isFactor
            ? fmtFactor(value)
            : fmtMoney(value);

          return (
            <Stack
              key={rowKey}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1 }}
            >
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Typography
                  sx={{
                    fontSize: isEquity ? '0.92rem' : '0.85rem',
                    fontWeight: isEquity ? 800 : 600,
                    color: isEquity ? '#0F172A' : '#475569',
                  }}
                >
                  {row.label}
                </Typography>
                {isEquity && reconciles && (
                  <Tooltip title="evEstimate + netDebt = equityEstimate ✓">
                    <CheckCircleOutlineIcon sx={{ fontSize: 14, color: '#16A34A' }} />
                  </Tooltip>
                )}
              </Stack>
              <Typography
                sx={{
                  fontSize: isEquity ? '1.05rem' : '0.88rem',
                  fontWeight: isEquity ? 800 : 700,
                  color: isEquity ? INK : '#0F172A',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {display}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

// Industry averages table — two columns (Global / Emerging) side by side
function AveragesTable({ industryRows, comps }) {
  const globalAverage = comps?.globalAverage?.value;
  const emergingAverage = comps?.emergingAverage?.value;
  const liqGlobal = comps?.liquidityDiscountGlobal?.value;
  const liqEmerging = comps?.liquidityDiscountEmerging?.value;
  const appliedGlobal = comps?.appliedMultipleGlobal?.value;
  const appliedEmerging = comps?.appliedMultipleEmerging?.value;

  const headSx = { bgcolor: HEAD_BG, color: '#fff', fontWeight: 700, fontSize: '0.82rem' };
  const cellSx = { fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' };

  return (
    <Paper elevation={0} sx={{ border: '1px solid #ECEFF3', borderRadius: 2, overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={headSx}>Industry</TableCell>
            <TableCell align="right" sx={headSx}>Global</TableCell>
            <TableCell align="right" sx={headSx}>Emerging</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {industryRows.map(([key, v], i) => {
            const stripeBg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
            return (
              <TableRow key={key}>
                <TableCell sx={{ ...cellSx, fontWeight: 600, bgcolor: stripeBg }}>
                  {v?.param_name || key}
                </TableCell>
                <TableCell align="right" sx={{ ...cellSx, bgcolor: stripeBg }}>
                  {fmtMultiple(v?.global, 1)}
                </TableCell>
                <TableCell align="right" sx={{ ...cellSx, bgcolor: stripeBg }}>
                  {fmtMultiple(v?.emerging, 1)}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Average row */}
          <TableRow>
            <TableCell sx={{ ...cellSx, fontWeight: 700, bgcolor: '#F1F5F9', borderTop: '2px solid #CBD5E1' }}>
              EBITDA multiple (average)
            </TableCell>
            <TableCell align="right" sx={{ ...cellSx, fontWeight: 700, bgcolor: '#F1F5F9', borderTop: '2px solid #CBD5E1' }}>
              {fmtMultiple(globalAverage, 1)}
            </TableCell>
            <TableCell align="right" sx={{ ...cellSx, fontWeight: 700, bgcolor: '#F1F5F9', borderTop: '2px solid #CBD5E1' }}>
              {fmtMultiple(emergingAverage, 1)}
            </TableCell>
          </TableRow>
          {/* Liquidity discount row */}
          <TableRow>
            <TableCell sx={{ ...cellSx, fontWeight: 600, bgcolor: '#F8FAFC' }}>
              Discount for lack of liquidity
            </TableCell>
            <TableCell align="right" sx={{ ...cellSx, bgcolor: '#F8FAFC' }}>
              {fmtPct(liqGlobal, 1)}
            </TableCell>
            <TableCell align="right" sx={{ ...cellSx, bgcolor: '#F8FAFC' }}>
              {fmtPct(liqEmerging, 1)}
            </TableCell>
          </TableRow>
          {/* Applied multiple row — emphasized */}
          <TableRow>
            <TableCell sx={{ ...cellSx, fontWeight: 800, bgcolor: '#EFF6FF', color: INK }}>
              EBITDA multiple applied
            </TableCell>
            <TableCell align="right" sx={{ ...cellSx, fontWeight: 800, bgcolor: '#EFF6FF', color: INK }}>
              {fmtMultiple(appliedGlobal, 1)}
            </TableCell>
            <TableCell align="right" sx={{ ...cellSx, fontWeight: 800, bgcolor: '#EFF6FF', color: INK }}>
              {fmtMultiple(appliedEmerging, 1)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Paper>
  );
}

const ComparableCompaniesPage = () => {
  const { results, loading, error } = useEngine();
  const { clientId } = useSettings();
  const navigate = useNavigate();

  const comps = results?.['Comps'] || null;

  // Collect industry rows dynamically — any key starting with industry_
  const industryRows = useMemo(() => {
    if (!comps) return [];
    return Object.entries(comps).filter(([k]) => k.startsWith('industry_'));
  }, [comps]);

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
              Comparable Companies
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              EV/EBITDA scenarios and industry averages
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

        {!comps && (
          <Alert severity="info">
            No Comps (Comparable Companies) data available for this client.
          </Alert>
        )}

        {comps && (
          <>
            {/* 2×2 scenario grid */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <ScenarioBlock title="Global Markets — EBITDA Multiple FY+1" block={comps.globalFy1} />
              </Grid>
              <Grid item xs={12} md={6}>
                <ScenarioBlock title="Emerging Markets — EBITDA Multiple FY+1" block={comps.emergingFy1} />
              </Grid>
              <Grid item xs={12} md={6}>
                <ScenarioBlock title="Global Markets — EBITDA Multiple FY+2" block={comps.globalFy2} />
              </Grid>
              <Grid item xs={12} md={6}>
                <ScenarioBlock title="Emerging Markets — EBITDA Multiple FY+2" block={comps.emergingFy2} />
              </Grid>
            </Grid>

            {/* Industry averages */}
            <Box sx={{ mt: 4 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ width: 4, height: 20, borderRadius: 2, bgcolor: INK }} />
                <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B', letterSpacing: 0.4 }}>
                  EBITDA MULTIPLES — INDUSTRY AVERAGES
                </Typography>
              </Stack>
              <AveragesTable industryRows={industryRows} comps={comps} />
            </Box>

            {/* Source note */}
            {comps.sourceNote?.param_name && (
              <Typography sx={{ mt: 2, fontStyle: 'italic', fontSize: '0.78rem', color: '#64748B' }}>
                {comps.sourceNote.param_name}
              </Typography>
            )}
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default ComparableCompaniesPage;
