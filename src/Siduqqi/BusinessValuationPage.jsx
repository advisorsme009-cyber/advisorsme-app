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
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { ThemeProvider } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

import LinkedinAITheme from '../LinkedinAI/style/LinkedinAITheme';
import { useEngine } from './context/EngineContext';
import { useSettings } from './context/SettingsContext';

const INK = '#1F559B';
const HEAD_BG = '#1F559B';

// --- Formatting helpers ---
const isYearKey = (k) => /^\d{4}$/.test(k);

const fmtMoney = (v, { blankZero = false } = {}) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const n = Number(v);
  if (blankZero && n === 0) return '';
  const rounded = Math.round(n);
  if (rounded < 0) return `(${Math.abs(rounded).toLocaleString('en-US')})`;
  return rounded.toLocaleString('en-US');
};

const fmtPct = (v, digits = 2) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${(Number(v) * 100).toFixed(digits)}%`;
};

const fmtFactor = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Number(v).toFixed(4);
};

const fmtMultiple = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${Number(v).toFixed(2)}x`;
};

// --- Section utilities ---
function collectYears(rows) {
  const years = new Set();
  rows.forEach(([, v]) => {
    if (!v || typeof v !== 'object') return;
    Object.keys(v).forEach((k) => isYearKey(k) && years.add(k));
  });
  return Array.from(years).sort();
}

// Split flat dict into sections delimited by `_sectionXxx` headers, preserving order.
function splitIntoSections(data) {
  const sections = [];
  let current = { title: null, key: null, rows: [] };

  for (const [key, value] of Object.entries(data || {})) {
    if (key.startsWith('_section') && value?.is_header) {
      if (current.title || current.rows.length) sections.push(current);
      current = { title: value.param_name || key, key, rows: [] };
    } else if (key === 'sensitivity') {
      // sensitivity is a custom widget — leave to caller
      continue;
    } else {
      current.rows.push([key, value]);
    }
  }
  if (current.title || current.rows.length) sections.push(current);
  return sections;
}

// --- Section renderers ---

function SectionTitle({ children, accent = INK }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 3, mb: 1.5 }}>
      <Box sx={{ width: 4, height: 20, borderRadius: 2, bgcolor: accent }} />
      <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: '#1E293B', letterSpacing: 0.4 }}>
        {children}
      </Typography>
    </Stack>
  );
}

// Wide table (years as columns) — used for DCF rows + Multiples
function YearTable({ rows, years, formatter = fmtMoney, blankZero = false }) {
  if (rows.length === 0 || years.length === 0) return null;
  return (
    <Paper elevation={0} sx={{ border: '1px solid #ECEFF3', borderRadius: 2, overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ bgcolor: HEAD_BG, color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
              Parameter
            </TableCell>
            {years.map((y) => (
              <TableCell
                key={y}
                align="right"
                sx={{ bgcolor: HEAD_BG, color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}
              >
                {y}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(([key, v], idx) => {
            const stripeBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
            return (
              <TableRow key={key}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.82rem', bgcolor: stripeBg }}>
                  {v?.param_name || key}
                </TableCell>
                {years.map((y) => (
                  <TableCell
                    key={y}
                    align="right"
                    sx={{
                      fontSize: '0.82rem',
                      fontVariantNumeric: 'tabular-nums',
                      bgcolor: stripeBg,
                    }}
                  >
                    {formatter(v?.[y], { blankZero })}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

// Two-column "label | value" rows — `formatter` can be a function (v, key) => string
// or a single function applied to all rows.
function LabelValueList({ rows, formatter, valueSx = {}, year = null }) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid #ECEFF3', borderRadius: 2, p: 2 }}>
      <Stack divider={<Box sx={{ height: 1, bgcolor: '#F1F5F9' }} />}>
        {rows.map(([key, v]) => {
          const yearToShow =
            year ||
            Object.keys(v || {}).find((k) => isYearKey(k) && v[k] !== null && v[k] !== undefined);
          const val = yearToShow ? v?.[yearToShow] : null;
          const display = formatter ? formatter(val, key) : fmtMoney(val);
          return (
            <Stack
              key={key}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ py: 1.1 }}
            >
              <Typography sx={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>
                {v?.param_name || key}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: '#0F172A',
                  fontVariantNumeric: 'tabular-nums',
                  ...valueSx,
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

// Sensitivity matrix renderer
function SensitivityMatrix({ sensitivity, baseDiscount, baseGrowth }) {
  if (!sensitivity?.matrix) return null;
  const { discount_rates: drs, growth_rates: grs, matrix } = sensitivity;

  const eqBase = (dr, gr) => Math.abs(Number(dr) - Number(baseDiscount)) < 1e-6 && Math.abs(Number(gr) - Number(baseGrowth)) < 1e-6;

  return (
    <Paper elevation={0} sx={{ border: '1px solid #ECEFF3', borderRadius: 2, overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ bgcolor: HEAD_BG, color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
              Discount ↓ &nbsp; / &nbsp; Growth →
            </TableCell>
            {grs.map((g) => (
              <TableCell
                key={g}
                align="center"
                sx={{ bgcolor: HEAD_BG, color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}
              >
                g = {fmtPct(g)}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {drs.map((d) => {
            const rowKey = String(d);
            return (
              <TableRow key={rowKey}>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                  dr = {fmtPct(d)}
                  {Math.abs(Number(d) - Number(baseDiscount)) < 1e-6 ? ' *' : ''}
                </TableCell>
                {grs.map((g) => {
                  const cellKey = String(g);
                  const v = matrix[rowKey]?.[cellKey];
                  const isBase = eqBase(d, g);
                  return (
                    <TableCell
                      key={cellKey}
                      align="right"
                      sx={{
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: isBase ? 800 : 500,
                        bgcolor: isBase ? '#FEF3C7' : 'transparent',
                        color: isBase ? '#B45309' : '#0F172A',
                        fontSize: '0.85rem',
                      }}
                    >
                      {isBase ? (
                        <Tooltip title="Base-case scenario — matches equity valuation">
                          <span>{fmtMoney(v)}</span>
                        </Tooltip>
                      ) : (
                        fmtMoney(v)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Typography sx={{ p: 1.5, fontSize: '0.72rem', color: '#64748B' }}>
        * = base assumption · highlighted center cell equals the equity valuation
      </Typography>
    </Paper>
  );
}

// --- Main ---

const BusinessValuationPage = () => {
  const { results, assumptions, loading, error } = useEngine();
  const { clientId } = useSettings();
  const navigate = useNavigate();

  const bv = results?.['BV'] || null;

  const sections = useMemo(() => splitIntoSections(bv), [bv]);

  // DCF section years (the wide table — freeCashFlow / presentValueFactor / presentValueFcf)
  const dcfYears = useMemo(() => {
    const dcfSection = sections.find((s) => s.key === '_sectionDCF') || sections[0];
    return collectYears(dcfSection?.rows || []);
  }, [sections]);

  const multiplesYears = useMemo(() => {
    const m = sections.find((s) => s.key === '_sectionMultiples');
    return collectYears(m?.rows || []);
  }, [sections]);

  const baseDiscount = assumptions?.valuation?.bv?.discount_rate;
  const baseGrowth = assumptions?.valuation?.bv?.terminal_growth_rate;

  // Get individual rows by key for the summary big-number block
  const equityValue = bv?.equityValue;
  const summaryYear = equityValue
    ? Object.keys(equityValue).find((k) => isYearKey(k) && equityValue[k] !== null && equityValue[k] !== undefined)
    : null;

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
              Business Valuation
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              DCF, sensitivity, and valuation multiples
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

        {!bv && (
          <Alert severity="info">
            No BV (Business Valuation) data available for this client. Configure valuation
            assumptions and run a recalculation.
          </Alert>
        )}

        {bv && (
          <>
            {sections.map((sec) => {
              if (!sec.title || sec.rows.length === 0) return null;

              // Route each section to the right renderer based on its key
              switch (sec.key) {
                case '_sectionDCF':
                  return (
                    <Box key={sec.key}>
                      <SectionTitle>{sec.title}</SectionTitle>
                      <YearTable rows={sec.rows} years={dcfYears} formatter={(v) => fmtMoney(v, { blankZero: true })} blankZero />
                    </Box>
                  );
                case '_sectionAssumptions':
                  return (
                    <Box key={sec.key}>
                      <SectionTitle>{sec.title}</SectionTitle>
                      <LabelValueList rows={sec.rows} formatter={fmtPct} />
                    </Box>
                  );
                case '_sectionTerminal':
                  return (
                    <Box key={sec.key}>
                      <SectionTitle>{sec.title}</SectionTitle>
                      <LabelValueList
                        rows={sec.rows}
                        formatter={(v, key) =>
                          key === 'terminalPvFactor' ? fmtFactor(v) : fmtMoney(v)
                        }
                      />
                    </Box>
                  );
                case '_sectionSummary': {
                  return (
                    <Box key={sec.key}>
                      <SectionTitle>{sec.title}</SectionTitle>
                      <Paper
                        elevation={0}
                        sx={{
                          border: '1px solid #ECEFF3',
                          borderRadius: 2,
                          p: 3,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1.2,
                        }}
                      >
                        {sec.rows.map(([key, v]) => {
                          const yr = summaryYear;
                          const val = yr ? v?.[yr] : null;
                          const isEquity = key === 'equityValue';
                          return (
                            <Stack
                              key={key}
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              sx={{
                                pt: isEquity ? 1.5 : 0,
                                borderTop: isEquity ? '2px solid #E2E8F0' : 'none',
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: isEquity ? '1rem' : '0.88rem',
                                  fontWeight: isEquity ? 800 : 600,
                                  color: isEquity ? '#0F172A' : '#475569',
                                }}
                              >
                                {v?.param_name || key}
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: isEquity ? '1.6rem' : '1rem',
                                  fontWeight: isEquity ? 800 : 700,
                                  color: isEquity ? INK : '#0F172A',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {fmtMoney(val)}
                              </Typography>
                            </Stack>
                          );
                        })}
                      </Paper>
                    </Box>
                  );
                }
                case '_sectionSensitivity':
                  return (
                    <Box key={sec.key}>
                      <SectionTitle>{sec.title}</SectionTitle>
                      <SensitivityMatrix
                        sensitivity={bv.sensitivity}
                        baseDiscount={baseDiscount}
                        baseGrowth={baseGrowth}
                      />
                    </Box>
                  );
                case '_sectionMultiples':
                  return (
                    <Box key={sec.key}>
                      <SectionTitle>{sec.title}</SectionTitle>
                      <YearTable rows={sec.rows} years={multiplesYears} formatter={fmtMultiple} />
                    </Box>
                  );
                default:
                  return null;
              }
            })}
          </>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default BusinessValuationPage;
