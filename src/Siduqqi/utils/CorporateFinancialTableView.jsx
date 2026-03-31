import React, { useMemo } from 'react';
import { CorporateTableTheme } from './CorporateTableTheme';
import { Tooltip, IconButton, Icon } from '@mui/material';

const CorporateFinancialTableView = ({
  data,
  title = "Key Highlights (SAR)",
  formatNumber,
  onReferenceClick,
  boldRows = [],
  forecastStartYear,
}) => {

  // Default number formatter
  const defaultFormatNumber = (num) => {
    if (num === null || num === undefined) return "—";
    // Check if it's already a formatted string, otherwise format it
    if (typeof num === 'string') return num;
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0,
    });
  };

  const formatter = formatNumber || defaultFormatNumber;

  const boldRowSet = useMemo(() => new Set(boldRows), [boldRows]);

  // Process data to extract years and rows
  const { years, rows, historicalYears, forecastYears } = useMemo(() => {
    if (!data) return { years: [], rows: [], historicalYears: [], forecastYears: [] };

    const uniqueYears = new Set();
    const processedRows = [];

    // Collect all years and build rows — skip _analytics key
    Object.entries(data).forEach(([key, metric]) => {
      if (key === "_analytics") return;
      if (!metric || typeof metric !== "object") return;

      const yearValues = {};
      Object.keys(metric).forEach((k) => {
        if (/^\d{4}$/.test(k)) {
          uniqueYears.add(k);
          yearValues[k] = metric[k];
        }
      });

      processedRows.push({
        key,
        label: metric.param_name || key,
        values: yearValues,
        reference: metric.reference || null,
      });
    });

    const sortedYears = Array.from(uniqueYears).sort((a, b) => Number(a) - Number(b));

    // Split into historical and forecast year groups
    let hist = sortedYears;
    let fcst = [];
    if (forecastStartYear) {
      hist = sortedYears.filter((y) => Number(y) < forecastStartYear);
      fcst = sortedYears.filter((y) => Number(y) >= forecastStartYear);
    }

    return { years: sortedYears, rows: processedRows, historicalYears: hist, forecastYears: fcst };
  }, [data, forecastStartYear]);


  if (!data || rows.length === 0) {
    return null;
  }

  return (
    <div style={CorporateTableTheme.container}>
      <table style={CorporateTableTheme.table}>
        {/* Main Header Group */}
        <thead>
          <tr>
            <th style={CorporateTableTheme.mainHeader}>{title}</th>
            {forecastStartYear && historicalYears.length > 0 ? (
              <>
                <th colSpan={historicalYears.length} style={{ ...CorporateTableTheme.mainHeader, textAlign: 'center' }}>
                  Historical
                </th>
                {forecastYears.length > 0 && (
                  <th colSpan={forecastYears.length} style={{ ...CorporateTableTheme.mainHeader, textAlign: 'center', borderRadius: '0 4px 0 0', backgroundColor: '#163C6E' }}>
                    Forecast
                  </th>
                )}
              </>
            ) : (
              <th colSpan={years.length} style={{ ...CorporateTableTheme.mainHeader, textAlign: 'center', borderRadius: '0 4px 0 0' }}>
                Actual
              </th>
            )}
          </tr>
          {/* Sub Header (Years) */}
          <tr>
            <th style={{ ...CorporateTableTheme.subHeader, borderBottom: '2px solid #fff' }}></th>
            {years.map((year) => {
              const isHistorical = forecastStartYear && Number(year) < forecastStartYear;
              return (
                <th key={year} style={{
                  ...CorporateTableTheme.subHeader,
                  ...(isHistorical ? { backgroundColor: '#f1f5f9', color: '#64748b' } : {}),
                }}>
                  {year}
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {rows.map((row, index) => {
            const isBold = boldRowSet.has(row.key);
            const isBalanceCheck = row.key === 'balanceCheck';
            const rowBase = index % 2 === 0 ? CorporateTableTheme.rowOdd : CorporateTableTheme.rowEven;
            const rowStyle = isBold
              ? { ...rowBase, borderTop: '2px solid #cbd5e0' }
              : rowBase;

            return (
              <tr key={row.key} style={rowStyle}>
                <td style={{
                  ...CorporateTableTheme.cellLabel,
                  ...(isBold ? { fontWeight: 700, color: '#1a202c' } : {}),
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{row.label}</span>
                    {row.reference?.doc && onReferenceClick && (
                      <Tooltip title={`Open reference (Level ${row.reference.level || 3})`}>
                        <IconButton
                          size="small"
                          onClick={() => onReferenceClick(row.reference.doc)}
                          sx={{ ml: 1, padding: 0.5 }}
                        >
                           <Icon fontSize="small" sx={{ color: "#1F559B", fontSize: "1.2rem" }}>zoom_in</Icon>
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                </td>
                {years.map((year) => {
                  const isHistorical = forecastStartYear && Number(year) < forecastStartYear;
                  const cellVal = row.values[year];

                  // Balance check row: green if 0, red if non-zero
                  let balanceStyle = {};
                  if (isBalanceCheck) {
                    const numVal = Number(cellVal);
                    balanceStyle = numVal === 0 || isNaN(numVal)
                      ? { color: '#16a34a', fontWeight: 700 }
                      : { color: '#dc2626', fontWeight: 700 };
                  }

                  return (
                    <td key={year} style={{
                      ...CorporateTableTheme.cellValue,
                      ...(isBold ? { fontWeight: 700, color: '#1a202c' } : {}),
                      ...(isHistorical ? { backgroundColor: '#f1f5f9' } : {}),
                      ...balanceStyle,
                    }}>
                      {isBalanceCheck
                        ? (Number(cellVal) === 0 ? '\u2713' : formatter(cellVal))
                        : formatter(cellVal)
                      }
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CorporateFinancialTableView;
