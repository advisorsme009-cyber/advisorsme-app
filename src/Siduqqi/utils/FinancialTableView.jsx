import React, { useMemo } from "react";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Stack,
  Typography,
  Box,
  styled,
} from "@mui/material";
import { Icon } from "@mui/material";

// --- Styled Components (Dolores Gradient Theme) ---

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  // The requested Dolores Gradient
  background: "linear-gradient(to bottom, #0A1E37, #12325B, #1F559B)",
  borderRadius: 12,
  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
  maxHeight: '80vh', // Allows internal scrolling
  '&::-webkit-scrollbar': {
    width: '8px',
    height: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(255, 255, 255, 0.05)',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
  },
}));

const StickyTableCell = styled(TableCell)(({ theme }) => ({
  position: 'sticky',
  left: 0,
  zIndex: 10,
  backgroundColor: '#0A1E37', // Must match the top of the gradient to hide scroll
  color: '#FFFFFF',
  fontWeight: 'bold',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  minWidth: 200,
  '&::after': {
    content: '""',
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '2px',
    background: 'linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0))',
  }
}));

const DataTableCell = styled(TableCell)(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.85)',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  whiteSpace: 'nowrap',
  fontFamily: '"Roboto Mono", monospace', // Financial font style
  fontSize: '0.85rem',
  textAlign: 'right', // Accounting standard
}));

const HeaderCell = styled(TableCell)(({ theme }) => ({
  backgroundColor: 'rgba(10, 30, 55, 0.95)', // Slightly translucent dark
  color: '#4FC3F7', // Light blue highlight for headers
  fontWeight: 'bold',
  borderBottom: '2px solid rgba(79, 195, 247, 0.3)',
  whiteSpace: 'nowrap',
  textAlign: 'right',
}));

/**
 * FinancialTableView - Reusable table component for displaying financial data
 *
 * @param {Object} props
 * @param {Object} props.data - Raw data object where keys are metric names and values contain year data
 * @param {Function} props.formatNumber - Optional custom number formatter (defaults to 2 decimals with commas)
 * @param {string} props.firstColumnLabel - Label for the first column (default: "Metric")
 * @param {Object} props.sx - Additional MUI sx styling for the table container
 * @param {Function} props.onReferenceClick - Optional callback when reference icon is clicked (receives doc string)
 */
const FinancialTableView = ({
  data,
  formatNumber,
  firstColumnLabel = "Metric",
  sx = {},
  onReferenceClick,
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
        reference: metric.reference || null,
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
    <StyledTableContainer component={Paper} sx={sx}>
      <Table stickyHeader aria-label="financial data table">
        <TableHead>
          <TableRow>
            <StickyTableCell sx={{ zIndex: 11 }}>{firstColumnLabel}</StickyTableCell>
            {years.map((year) => (
              <HeaderCell key={year}>
                {year}
                {/* Visual indicator for Forecast years - hardcoded cutoff per request */}
                {parseInt(year) >= 2023 && (
                  <Box component="span" sx={{ 
                    display: 'block', 
                    fontSize: '0.6em', 
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 'normal' 
                  }}>
                    FORECAST
                  </Box>
                )}
              </HeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>
              <StickyTableCell component="th" scope="row">
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ minWidth: 0 }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: "inherit", color: "inherit", flex: 1, minWidth: 0 }}
                  >
                    {row.paramName}
                  </Typography>
                  {row.reference?.doc && onReferenceClick && (
                    <Tooltip title={`Open reference (Level ${row.reference.level || 3})`}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => onReferenceClick(row.reference.doc)}
                          sx={{
                            padding: 0.5,
                            "&:hover": {
                              bgcolor: "rgba(255,255,255,0.1)",
                            },
                          }}
                        >
                          <Icon
                            fontSize="small"
                            sx={{ color: "#4FC3F7", fontSize: "1.2rem" }} // Updated color to match theme
                          >
                            zoom_in
                          </Icon>
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Stack>
              </StickyTableCell>
              {years.map((year) => (
                <DataTableCell key={year}>
                  {formatter(row.yearValues[year])}
                </DataTableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );
};

export default FinancialTableView;
