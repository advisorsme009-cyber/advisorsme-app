import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Autocomplete,
  TextField,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import { ThemeProvider } from '@mui/material/styles';
import { Line, Bar } from 'react-chartjs-2';

import LinkedinAITheme from '../LinkedinAI/style/LinkedinAITheme';
import { useSettings } from './context/SettingsContext';
import { apiUrl } from './hooks/api';
import {
  INK,
  LINE_COLORS,
  STACK_PALETTE,
  sortedYears,
  buildChartData,
  buildChartOptions,
} from './report/reportUtils';
import { ChartCard, AddToReportButton } from './report/reportShared';

// --- One chart card with an "Add to Report Generator" action ---
// datasets: [{ label, data:[...], color }]; reportMeta: { module, metric, chartType }
function MetricChartCard({ title, kind, labels, datasets, percent, reportMeta, clientId, accent = INK }) {
  const ref = useRef(null);
  const hasData = datasets.length > 0 && datasets.some((d) => d.data.some((v) => v !== null && v !== undefined && !isNaN(v)));

  const data = useMemo(() => buildChartData(kind, labels, datasets), [kind, labels, datasets]);
  const options = useMemo(() => buildChartOptions(kind, percent, datasets), [kind, percent, datasets]);

  const getPayload = () => ({
    ...reportMeta,
    title,
    series: { labels, datasets: datasets.map((d) => ({ label: d.label, data: d.data, color: d.color })) },
  });

  return (
    <ChartCard
      title={title}
      accent={accent}
      height={320}
      headerRight={<AddToReportButton clientId={clientId} getPayload={getPayload} disabled={!hasData} />}
    >
      {hasData ? (
        kind === 'stackbar' ? (
          <Bar ref={ref} data={data} options={options} />
        ) : (
          <Line ref={ref} data={data} options={options} />
        )
      ) : (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">No data available for this view.</Typography>
        </Box>
      )}
    </ChartCard>
  );
}

const ApiAndMetrics = () => {
  const { clientId } = useSettings();

  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [error, setError] = useState('');

  // selected: array of option objects { module, key, label, groupLabel }. First = PRIMARY.
  const [selected, setSelected] = useState([]);
  // analytics cache keyed by `${module}/${key}`
  const [analytics, setAnalytics] = useState({});
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // --- Load the metrics catalog ---
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setCatalogLoading(true);
    setError('');
    fetch(`${apiUrl}/engine/metrics-catalog/${encodeURIComponent(clientId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load metrics catalog (${res.status})`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setCatalog(json);
        setSelected([]);
        setAnalytics({});
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setCatalogLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Flatten catalog → grouped Autocomplete options
  const options = useMemo(() => {
    if (!catalog?.modules) return [];
    return catalog.modules.flatMap((mod) =>
      (mod.metrics || []).map((m) => ({
        module: mod.module,
        key: m.key,
        label: m.label,
        groupLabel: mod.label || mod.module,
        drillDown: m.drillDown,
        isTotal: m.isTotal,
      }))
    );
  }, [catalog]);

  // --- Fetch analytics for any selected metric not yet cached ---
  useEffect(() => {
    if (!clientId || selected.length === 0) return;
    const missing = selected.filter((s) => !analytics[`${s.module}/${s.key}`]);
    if (missing.length === 0) return;
    let cancelled = false;
    setAnalyticsLoading(true);
    Promise.all(
      missing.map((s) =>
        fetch(
          `${apiUrl}/engine/metric-analytics/${encodeURIComponent(clientId)}/${encodeURIComponent(
            s.module
          )}/${encodeURIComponent(s.key)}?include_drilldown=true`
        )
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Analytics failed (${res.status})`))))
          .then((json) => ({ id: `${s.module}/${s.key}`, json }))
      )
    )
      .then((entries) => {
        if (cancelled) return;
        setAnalytics((prev) => {
          const next = { ...prev };
          entries.forEach((e) => (next[e.id] = e.json));
          return next;
        });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setAnalyticsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected, clientId, analytics]);

  const primary = selected[0] || null;
  const primaryData = primary ? analytics[`${primary.module}/${primary.key}`] : null;

  // Union of years across selected metrics, numerically sorted
  const years = useMemo(() => {
    const set = new Set();
    selected.forEach((s) => {
      const a = analytics[`${s.module}/${s.key}`];
      if (a?.values) sortedYears(a.values).forEach((y) => set.add(y));
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [selected, analytics]);

  // Value comparison chart datasets (all selected metrics)
  const valueDatasets = useMemo(
    () =>
      selected.map((s, i) => {
        const a = analytics[`${s.module}/${s.key}`];
        return {
          label: a?.paramName || s.label,
          data: years.map((y) => (a?.values?.[y] ?? null)),
          color: LINE_COLORS[i % LINE_COLORS.length],
        };
      }),
    [selected, analytics, years]
  );

  // Drill-down datasets for the primary metric
  const drill = primaryData?.drillDown;
  const drillAvailable = Boolean(drill?.available);
  const primaryYears = useMemo(() => sortedYears(primaryData?.values || {}), [primaryData]);

  const drillDatasets = useMemo(() => {
    if (!primaryData) return [];
    if (drillAvailable) {
      return (drill.lines || [])
        .filter((l) => !l.isTotal)
        .map((l, i) => ({
          label: l.label,
          data: primaryYears.map((y) => (l.values?.[y] ?? 0)),
          color: STACK_PALETTE[i % STACK_PALETTE.length],
        }));
    }
    // No deeper level → show the selected metric as a single solid line.
    return [
      {
        label: primaryData.paramName || primary?.label,
        data: primaryYears.map((y) => (primaryData.values?.[y] ?? null)),
        color: INK,
      },
    ];
  }, [primaryData, drill, drillAvailable, primaryYears, primary]);

  // Analytics line datasets for the primary metric (% of revenue / growth / common size)
  const analyticsLine = (metricKey, color) => [
    {
      label: primaryData?.paramName || primary?.label || '',
      data: primaryYears.map((y) => {
        const v = primaryData?.analytics?.[metricKey]?.[y];
        return v === null || v === undefined ? null : v;
      }),
      color,
    },
  ];

  const baseMeta = primary ? { module: primary.module, metric: primary.key } : {};

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: '100%', p: 3, bgcolor: '#F5F6F8', minHeight: '100vh' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A' }}>
              API &amp; Metrics
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Explore any metric, drill into its Lv3 breakdown, and pin charts to your report.
            </Typography>
          </Box>
          <Chip
            icon={<BusinessOutlinedIcon sx={{ fontSize: 18 }} />}
            label={clientId || 'Business Name'}
            sx={{ bgcolor: '#fff', border: '1px solid #E2E8F0', fontWeight: 600, color: '#1E293B', '& .MuiChip-icon': { color: INK } }}
          />
        </Box>

        {/* Metric picker (group by module, up to 3, first = primary) */}
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #ECEFF3', mb: 3 }}>
          <Autocomplete
            multiple
            options={options}
            groupBy={(o) => o.groupLabel}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(o, v) => o.module === v.module && o.key === v.key}
            value={selected}
            onChange={(e, val) => {
              if (val.length <= 3) setSelected(val);
            }}
            getOptionDisabled={(o) =>
              selected.length >= 3 && !selected.some((s) => s.module === o.module && s.key === o.key)
            }
            renderTags={(value, getTagProps) =>
              value.map((opt, index) => (
                <Chip
                  {...getTagProps({ index })}
                  key={`${opt.module}/${opt.key}`}
                  label={index === 0 ? `★ ${opt.label}` : opt.label}
                  size="small"
                  sx={{
                    bgcolor: index === 0 ? INK : '#EEF2F8',
                    color: index === 0 ? '#fff' : '#1E293B',
                    fontWeight: 600,
                    '& .MuiChip-deleteIcon': { color: index === 0 ? '#fff' : '#94A3B8' },
                  }}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select up to 3 metrics"
                placeholder={selected.length < 3 ? 'Search metrics…' : 'Max 3 reached'}
              />
            )}
          />
          <Typography variant="caption" sx={{ color: '#94A3B8', mt: 1, display: 'block' }}>
            The first metric (★) is the primary — its drill-down and analytics are shown below.
          </Typography>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {(catalogLoading || (analyticsLoading && !primaryData)) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {!catalogLoading && selected.length === 0 && (
          <Paper elevation={0} sx={{ p: 6, borderRadius: 3, border: '1px dashed #CBD5E1', textAlign: 'center' }}>
            <Typography sx={{ color: '#64748B', fontWeight: 600 }}>
              Select a metric to begin.
            </Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', mt: 0.5 }}>
              Pick up to 3 metrics from the dropdown above. The first one drives the drill-down and analytics charts.
            </Typography>
          </Paper>
        )}

        {primaryData && (
          <Grid container spacing={3}>
            {/* Value comparison chart (all selected) */}
            <Grid item xs={12}>
              <MetricChartCard
                title={selected.length > 1 ? 'Values — Comparison' : `${primary.label} — Value`}
                kind="line"
                labels={years}
                datasets={valueDatasets}
                percent={false}
                reportMeta={{ ...baseMeta, chartType: 'value' }}
                clientId={clientId}
              />
            </Grid>

            {/* Drill-down (full Lv3 if available, single solid line otherwise) */}
            <Grid item xs={12}>
              <MetricChartCard
                title={
                  drillAvailable
                    ? `${primary.label} — ${drill.module} Breakdown`
                    : `${primary.label} — Detail`
                }
                kind={drillAvailable ? 'stackbar' : 'line'}
                labels={primaryYears}
                datasets={drillDatasets}
                percent={false}
                reportMeta={{ ...baseMeta, chartType: drillAvailable ? 'drilldown' : 'value' }}
                clientId={clientId}
                accent={STACK_PALETTE[4]}
              />
            </Grid>

            {/* Three analytics charts for the primary metric */}
            <Grid item xs={12} md={4}>
              <MetricChartCard
                title={`${primary.label} — % of Revenue`}
                kind="line"
                labels={primaryYears}
                datasets={analyticsLine('pctOfRevenue', '#3B6FE0')}
                percent
                reportMeta={{ ...baseMeta, chartType: 'pctOfRevenue' }}
                clientId={clientId}
                accent="#3B6FE0"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <MetricChartCard
                title={`${primary.label} — % Growth`}
                kind="line"
                labels={primaryYears}
                datasets={analyticsLine('growth', '#3FC592')}
                percent
                reportMeta={{ ...baseMeta, chartType: 'growth' }}
                clientId={clientId}
                accent="#3FC592"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <MetricChartCard
                title={`${primary.label} — % Common Size`}
                kind="line"
                labels={primaryYears}
                datasets={analyticsLine('commonSize', '#9466E2')}
                percent
                reportMeta={{ ...baseMeta, chartType: 'commonSize' }}
                clientId={clientId}
                accent="#9466E2"
              />
            </Grid>
          </Grid>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default ApiAndMetrics;
