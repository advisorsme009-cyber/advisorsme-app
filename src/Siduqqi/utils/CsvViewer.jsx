import React, { useMemo } from "react";
import * as Papa from "papaparse";

/**
 * CsvViewer component
 * Props:
 *  - csvString: the raw CSV text to display
 */
const CsvViewer = ({ csvString }) => {
  // Parse and normalize once per csvString
  const { columns, rows } = useMemo(() => {
    const { data } = Papa.parse(csvString, {
      delimiter: ",",
      skipEmptyLines: true,
    });

    if (!data || data.length === 0) {
      return { columns: [], rows: [] };
    }

    // Determine header rows
    const header1 = data[0];
    const header2 = data[1] || [];
    const isYearRow = header2.slice(2).every((cell) => !isNaN(cell));

    let columns;
    let body;

    if (isYearRow) {
      columns = header1.map((h, i) => {
        const part1 = h.trim();
        const part2 = header2[i]?.trim();
        if (part1 && part2) return `${part1} ${part2}`;
        return part1 || part2 || `Column ${i + 1}`;
      });
      body = data.slice(2);
    } else {
      columns = header1.map((h, i) => h || `Column ${i + 1}`);
      body = data.slice(1);
    }

    return { columns, rows: body };
  }, [csvString]);

  // Helper to format numeric cells with thousand separators
  const formatCell = (cell) => {
    const value = cell ?? "";
    const str = value.toString().trim();
    // Matches integer or decimal numbers
    if (/^-?\d+(\.\d+)?$/.test(str)) {
      return Number(str).toLocaleString();
    }
    return value;
  };

  return (
    <div>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          color: "black",
          border: "1px solid black",
        }}
      >
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={i}
                style={{
                  border: "1px solid black",
                  padding: "8px",
                  textAlign: "left",
                  color: "black",
                  fontWeight: "bold",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {columns.map((_, ci) => (
                <td
                  key={ci}
                  style={{
                    border: "1px solid black",
                    padding: "8px",
                    color: "black",
                  }}
                >
                  {formatCell(row[ci])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CsvViewer;
