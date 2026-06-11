// Pure helpers + Chart.js registration shared by the API & Metrics and Report
// Generator screens. Kept component-free so fast-refresh stays happy.
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
import { apiUrl } from '../hooks/api';

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

// --- Design tokens (match the Report Generator mockup) ---
export const INK = '#1F559B';
export const BLUE = '#3B6FE0';
export const LINE_COLORS = ['#3B6FE0', '#3FC592', '#9466E2'];
// Light → dark blues, then a few accents for wide Lv3 breakdowns.
export const STACK_PALETTE = [
  '#C2D8FB', '#9DBDF5', '#7AA2EF', '#5A86E8', '#3B6FE0', '#2457C8',
  '#9466E2', '#3FC592', '#F59E0B', '#EF4444', '#14B8A6', '#6366F1', '#A8B1BF',
];

// --- Formatters ---
export const isYear = (k) => /^\d{4}$/.test(k);
export const sortedYears = (valuesObj = {}) =>
  Object.keys(valuesObj || {})
    .filter(isYear)
    .sort((a, b) => Number(a) - Number(b));

export const compact = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
};

// API analytics are decimals (0.25 → 25%).
export const pct = (n, digits = 1) =>
  n === null || n === undefined || isNaN(n) ? '—' : `${(n * 100).toFixed(digits)}%`;

export const hexA = (hex, alpha) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// --- Chart builders (shared so saved charts re-render identically) ---
// `datasets` is the lightweight snapshot form: [{ label, data:[...], color }].

function lineRange(datasets) {
  let min = Infinity;
  let max = -Infinity;
  datasets.forEach((d) =>
    (d.data || []).forEach((v) => {
      if (v !== null && v !== undefined && !isNaN(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    })
  );
  if (min === Infinity) return { min: 0, max: 1 };
  return { min, max };
}

export function buildChartData(kind, labels, datasets) {
  if (kind === 'stackbar') {
    return {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.color,
        borderWidth: 0,
        borderRadius: 3,
        maxBarThickness: 46,
        stack: 'stack',
      })),
    };
  }
  // line
  const single = datasets.length === 1;
  return {
    labels,
    datasets: datasets.map((d) => ({
      label: d.label,
      data: d.data,
      borderColor: d.color,
      pointBackgroundColor: d.color,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2.5,
      tension: 0.35,
      spanGaps: true,
      fill: single,
      backgroundColor: (ctx) => {
        const { chart } = ctx;
        const { ctx: c, chartArea } = chart;
        if (!chartArea) return hexA(d.color, 0.12);
        const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, hexA(d.color, 0.22));
        g.addColorStop(1, hexA(d.color, 0));
        return g;
      },
    })),
  };
}

export function buildChartOptions(kind, percent, datasets) {
  const fmt = (v) => (percent ? pct(v, Math.abs(v) < 0.1 ? 1 : 0) : compact(v));
  const tip = (v) => (percent ? pct(v, 1) : compact(v));
  const showLegend = datasets.length > 1;

  const base = {
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: showLegend
        ? { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 14 } }
        : { display: false },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${tip(c.parsed.y)}` } },
    },
  };

  if (kind === 'stackbar') {
    return {
      ...base,
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { stacked: true, grid: { color: '#F1F3F6' }, ticks: { font: { size: 11 }, callback: fmt } },
      },
    };
  }

  // Line: keep real signs. Always include the zero baseline so a series getting
  // *more negative* slopes DOWN (worsening = down), never inverts/explodes (RG-F2).
  const { min, max } = lineRange(datasets);
  return {
    ...base,
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        suggestedMin: Math.min(0, min),
        suggestedMax: Math.max(0, max),
        grid: {
          color: (ctx) => (ctx.tick.value === 0 ? '#CBD5E1' : '#F1F3F6'),
          lineWidth: (ctx) => (ctx.tick.value === 0 ? 1.5 : 1),
        },
        ticks: { font: { size: 11 }, callback: fmt },
      },
    },
  };
}

// Paint a Chart.js canvas onto a white background → PNG data URL (for PDF/print).
export function chartCanvasToWhiteDataUrl(canvas) {
  if (!canvas) return null;
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out.toDataURL('image/png');
}

// --- Report Generator API helper ---
export async function postChartToReport(clientId, payload) {
  const res = await fetch(`${apiUrl}/report-generator/${encodeURIComponent(clientId)}/charts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to save chart (${res.status})`);
  return res.json();
}
