import React from "react";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

/**
 * FinancialTableView - Reusable table component for displaying financial data
 *
 * @param {Object} props
 * @param {Object} props.data - Raw data object where keys are metric names and values contain year data
 * @param {Function} props.formatNumber - Optional custom number formatter (defaults to 2 decimals with commas)
 * @param {string} props.firstColumnLabel - Label for the first column (default: "Metric")
 * @param {Object} props.sx - Additional MUI sx styling for the table container
 */
const FinancialTableView = ({
  data,
  formatNumber,
  firstColumnLabel = "Metric",
  sx = {},
}) => {
  // Default number formatter
  const defaultFormatNumber = (num) => {
    if (num === null || num === undefined) return "—";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatter = formatNumber || defaultFormatNumber;

  // Extract years and build table rows from data
  const buildTableData = () => {
    if (!data) return { years: [], rows: [] };

    const years = new Set();
    const rows = [];

    // Collect all years and build rows
    Object.entries(data).forEach(([key, metric]) => {
      if (!metric || typeof metric !== "object") return;

      const yearValues = {};
      Object.keys(metric).forEach((k) => {
        if (/^\d{4}$/.test(k)) {
          years.add(k);
          yearValues[k] = metric[k];
        }
      });

      rows.push({
        key,
        paramName: metric.param_name || key,
        yearValues,
      });
    });

    const sortedYears = Array.from(years).sort((a, b) => Number(a) - Number(b));
    return { years: sortedYears, rows };
  };

  const { years, rows } = buildTableData();

  if (!data || rows.length === 0) {
    return null;
  }

  return (
    <TableContainer
      component={Paper}
      sx={{ boxShadow: 3, borderRadius: 2, ...sx }}
    >
      <Table sx={{ minWidth: 650 }} aria-label="financial data table">
        <TableHead>
          <TableRow sx={{ bgcolor: "primary.main" }}>
            <TableCell
              sx={{
                fontWeight: 700,
                color: "white",
                position: "sticky",
                left: 0,
                bgcolor: "primary.main",
                zIndex: 2,
              }}
            >
              {firstColumnLabel}
            </TableCell>
            {years.map((year) => (
              <TableCell
                key={year}
                align="right"
                sx={{ fontWeight: 700, color: "white" }}
              >
                {year}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow
              key={row.key}
              sx={{
                "&:nth-of-type(odd)": { bgcolor: "grey.50" },
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <TableCell
                component="th"
                scope="row"
                sx={{
                  fontWeight: 600,
                  position: "sticky",
                  left: 0,
                  bgcolor: idx % 2 === 0 ? "white" : "grey.50",
                  zIndex: 1,
                }}
              >
                {row.paramName}
              </TableCell>
              {years.map((year) => (
                <TableCell key={year} align="right">
                  {formatter(row.yearValues[year])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default FinancialTableView;
