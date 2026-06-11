// Shared UI components for the API & Metrics and Report Generator screens.
// Pure helpers + Chart.js registration live in ./reportUtils.
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
} from '@mui/material';
import AddChartOutlinedIcon from '@mui/icons-material/AddChartOutlined';
import { INK, postChartToReport } from './reportUtils';

// --- Card shell ---
export function ChartCard({ title, accent = INK, headerRight = null, children, height = 320, mutedTitle = false }) {
  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, height: '100%', border: '1px solid #ECEFF3' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 4, height: 22, borderRadius: 2, bgcolor: accent }} />
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: mutedTitle ? '#94A3B8' : INK }}>
            {title}
          </Typography>
        </Stack>
        {headerRight}
      </Box>
      <Box sx={{ height }}>{children}</Box>
    </Paper>
  );
}

// "Add to Report Generator" button: confirm → POST → toast.
export function AddToReportButton({ clientId, getPayload, disabled = false }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null); // { severity, message }

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await postChartToReport(clientId, getPayload());
      setToast({ severity: 'success', message: 'Added to Report Generator' });
    } catch (err) {
      setToast({ severity: 'error', message: err.message || 'Could not add chart' });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={disabled || busy}
        size="small"
        startIcon={<AddChartOutlinedIcon sx={{ fontSize: 16 }} />}
        sx={{
          textTransform: 'none',
          bgcolor: INK,
          color: '#fff',
          borderRadius: '18px',
          px: 1.5,
          fontSize: '0.76rem',
          whiteSpace: 'nowrap',
          '&:hover': { bgcolor: '#17427C' },
          '&.Mui-disabled': { bgcolor: '#CBD5E1', color: '#fff' },
        }}
      >
        Add to Report Generator
      </Button>

      <Dialog open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)}>
        <DialogTitle>Add this chart to the Report Generator?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A snapshot of this chart will be pinned to the Report Generator, where you can add commentary
            and export it to PDF.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            variant="contained"
            sx={{ textTransform: 'none', bgcolor: INK, '&:hover': { bgcolor: '#17427C' } }}
          >
            {busy ? 'Adding…' : 'Add chart'}
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
    </>
  );
}
