import React, { useMemo } from 'react';
import { TextField } from '@mui/material';
import { CorporateTableTheme } from './CorporateTableTheme';

const CorporateEditableTable = ({ 
  data, 
  title, 
  sectionKey, 
  formData, 
  onInputChange 
}) => {

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
        key, // e.g. "revenue_growth"
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
    <div style={CorporateTableTheme.container}>
      <table style={CorporateTableTheme.table}>
        {/* Main Header Group */}
        <thead>
          <tr>
            <th style={CorporateTableTheme.mainHeader}>{title}</th>
            <th colSpan={years.length} style={{ ...CorporateTableTheme.mainHeader, textAlign: 'center', borderRadius: '0 4px 0 0' }}>
              Inputs
            </th>
          </tr>
          {/* Sub Header (Years) */}
          <tr>
            <th style={{ ...CorporateTableTheme.subHeader, borderBottom: '2px solid #fff' }}></th>
            {years.map((year, index) => (
              <th key={year} style={CorporateTableTheme.subHeader}>
                {year}
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} style={index % 2 === 0 ? CorporateTableTheme.rowOdd : CorporateTableTheme.rowEven}>
              <td style={CorporateTableTheme.cellLabel}>{row.label}</td>
              {years.map((year) => {
                const fieldName = `${sectionKey}.${row.key}.${year}`;
                const value = formData[fieldName] ?? "";

                return (
                  <td key={year} style={{ ...CorporateTableTheme.cellValue, padding: '8px' }}>
                     <TextField
                        fullWidth
                        type="number"
                        name={fieldName}
                        value={value}
                        onChange={onInputChange}
                        variant="outlined"
                        size="small"
                        sx={{
                            "& .MuiOutlinedInput-root": {
                              backgroundColor: '#fff',
                              borderRadius: "4px",
                            },
                             "& .MuiInputBase-input": {
                                fontSize: '0.9rem',
                                padding: '6px 10px',
                                textAlign: 'center'
                             }
                        }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CorporateEditableTable;
