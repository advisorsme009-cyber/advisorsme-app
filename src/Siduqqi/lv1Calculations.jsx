
// Potentialy OLD!
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
  Typography,
  Divider,
  Icon,
} from "@mui/material";
import { ThemeProvider } from "@emotion/react";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";

// Simple, elegant MUI-based component that fetches and displays LV1 calculations
// Years are shown as columns and rows start with param_name. Original server order is preserved.

function numberFormat(value) {
  if (value === null || value === undefined || value === "") return "";
  try {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    // Keep up to 2 decimals, with grouping
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return String(value);
  }
}

export default function Lv1Calculations() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState("");
  const [rawData, setRawData] = useState(null); // raw API payload
  const [orderedKeys, setOrderedKeys] = useState([]); // preserve server-provided order
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFetch = async () => {
    setError("");
    setLoading(true);
    try {
      const url = `${apiUrl}/calculation/lv1/fetch?client_id=${encodeURIComponent(
        clientId
      )}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const data = await res.json();

      // Preserve the order the backend returns by capturing keys as-is
      const keysInOrder = Object.keys(data);

      setRawData(data);
      setOrderedKeys(keysInOrder);
    } catch (e) {
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const years = useMemo(() => {
    if (!rawData) return [];
    const set = new Set();
    orderedKeys.forEach((k) => {
      const row = rawData[k] || {};
      Object.keys(row).forEach((rk) => {
        if (/^\d{4}$/.test(rk)) set.add(rk);
      });
    });
    return Array.from(set)
      .map((y) => Number(y))
      .sort((a, b) => a - b)
      .map((y) => String(y));
  }, [rawData, orderedKeys]);

  const rows = useMemo(() => {
    if (!rawData) return [];
    return orderedKeys.map((k) => {
      const row = rawData[k] || {};
      return {
        key: k,
        name: row.param_name || k,
        reference: row.reference || null,
        valuesByYear: years.reduce((acc, y) => {
          acc[y] = row[y] ?? ""; // blank if missing
          return acc;
        }, {}),
      };
    });
  }, [rawData, orderedKeys, years]);

  const openReference = (doc) => {
    if (!clientId) return; // avoid opening malformed URL
    const path = `/advisors/lv3Calculations/${encodeURIComponent(
      clientId
    )}/${encodeURIComponent(doc)}`;
    navigate(path);
  };

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
        <Card elevation={2} sx={{ borderRadius: 3 }}>
          <CardHeader
            title={
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h6" fontWeight={700}>
                  IS-CON
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  (Lv1 Calculations)
                </Typography>
              </Stack>
            }
          />
          <Divider />
          <CardContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
              sx={{ mb: 2 }}
            >
              <TextField
                fullWidth
                label="Client ID"
                placeholder="pwc-test-123456"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && clientId && !loading) handleFetch();
                }}
                disabled={loading}
              />
              <Button
                variant="contained"
                onClick={handleFetch}
                disabled={!clientId || loading}
              >
                {loading ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={18} />
                    <span>Fetching…</span>
                  </Stack>
                ) : (
                  "Fetch"
                )}
              </Button>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {!rawData && !loading && (
              <Alert severity="info">Enter a client ID to fetch data.</Alert>
            )}

            {rawData && (
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{ borderRadius: 2 }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        Parameter
                      </TableCell>
                      {years.map((y) => (
                        <TableCell
                          key={y}
                          align="right"
                          sx={{ fontWeight: 700 }}
                        >
                          {y}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.key} hover>
                        <TableCell>
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1}
                          >
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600 }}
                            >
                              {r.name}
                            </Typography>
                            {r.reference?.doc && (
                              <Tooltip title="Open reference (Level 3)">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() =>
                                      openReference(r.reference.doc)
                                    }
                                    disabled={!clientId}
                                  >
                                    <Icon
                                      fontSize="inherit"
                                      sx={{ color: "primary.main" }}
                                    >
                                      zoom_in
                                    </Icon>
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        {years.map((y) => (
                          <TableCell key={y} align="right">
                            <Typography variant="body2">
                              {numberFormat(r.valuesByYear[y])}
                            </Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Box>
    </ThemeProvider>
  );
}
