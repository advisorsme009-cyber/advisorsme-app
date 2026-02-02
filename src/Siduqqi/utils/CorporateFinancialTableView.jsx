import React, { useMemo } from 'react';

const CorporateFinancialTableView = ({ 
  data, 
  title = "Key Highlights (SAR)",
  formatNumber 
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

  // Process data to extract years and rows
  const { years, rows } = useMemo(() => {
    if (!data) return { years: [], rows: [] };

    const uniqueYears = new Set();
    const processedRows = [];

    // Collect all years and build rows
    Object.entries(data).forEach(([key, metric]) => {
      if (!metric || typeof metric !== "object") return;

      const yearValues = {};
      Object.keys(metric).forEach((k) => {
        // Assume key is a year if it matches 4 digits
        if (/^\d{4}$/.test(k)) {
          uniqueYears.add(k);
          yearValues[k] = metric[k];
        }
      });

      processedRows.push({
        key,
        label: metric.param_name || key,
        values: yearValues,
      });
    });

    const sortedYears = Array.from(uniqueYears).sort((a, b) => Number(a) - Number(b));
    return { years: sortedYears, rows: processedRows };
  }, [data]);


  if (!data || rows.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <table style={styles.table}>
        {/* Main Header Group */}
        <thead>
          <tr>
            <th style={styles.mainHeaderLeft}>{title}</th>
            {/* The gap is created by the border in CSS */}
            <th colSpan={years.length} style={styles.mainHeaderRight}>
              Actual
            </th>
          </tr>
          {/* Sub Header (Years) */}
          <tr>
            <th style={styles.subHeaderEmpty}></th> {/* Empty corner cell */}
            {years.map((year, index) => (
              <th key={year} style={styles.subHeaderYear}>
                {year}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} style={index % 2 === 0 ? styles.rowOdd : styles.rowEven}>
              <td style={styles.rowLabel}>{row.label}</td>
              {years.map((year) => (
                <td key={year} style={styles.rowValue}>
                  {formatter(row.values[year])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// The Theme Styles
const styles = {
  container: {
    fontFamily: '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: '0px', // Removed padding as it might be inside another container
    backgroundColor: '#fff',
    overflowX: 'auto', // Handle overflow if many columns
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
    color: '#333',
  },
  // The Dark Blue Header
  mainHeaderLeft: {
    backgroundColor: '#1F559B', // THEME BLUE
    color: '#ffffff',
    padding: '16px',
    textAlign: 'left',
    fontWeight: 'bold',
    borderRight: '4px solid white', // The gap between headers
    borderRadius: '4px 0 0 0',
  },
  mainHeaderRight: {
    backgroundColor: '#1F559B', // THEME BLUE
    color: '#ffffff',
    padding: '16px',
    textAlign: 'center',
    fontWeight: 'bold',
    borderRadius: '0 4px 0 0',
  },
  // The Year Headers
  subHeaderEmpty: {
    backgroundColor: '#ffffff',
    padding: '12px',
    borderBottom: '2px solid #fff', // Optional separator
  },
  subHeaderYear: {
    backgroundColor: '#ffffff',
    color: '#333',
    padding: '15px',
    textAlign: 'center',
    fontWeight: '600',
    borderBottom: '1px solid #e0e0e0', // Separator from data
  },
  // Rows
  rowOdd: {
    backgroundColor: '#F0F4F8', // The light blue/gray stripe
  },
  rowEven: {
    backgroundColor: '#ffffff',
  },
  rowLabel: {
    padding: '14px 16px',
    textAlign: 'left',
    fontWeight: '600', // Bold labels
    whiteSpace: 'nowrap',
    color: '#2d3748',
  },
  rowValue: {
    padding: '14px 16px',
    textAlign: 'center', // Center align numbers as per image
    color: '#4a5568',
    whiteSpace: 'nowrap',
  },
};

export default CorporateFinancialTableView;
