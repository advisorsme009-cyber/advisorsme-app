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
      // Let Papa auto-detect delimiter and quotes
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (!data || data.length === 0) {
      return { columns: [], rows: [] };
    }

    // Determine header rows
    const header1 = data[0];
    const header2 = data[1] || [];

    const isNumericLike = (cell) => {
      const str = (cell ?? "").toString().trim();
      if (str === "") return false;
      return /^-?\d+(?:\.\d+)?$/.test(str);
    };

    const numCount = header2.reduce(
      (acc, c) => acc + (isNumericLike(c) ? 1 : 0),
      0
    );
    const textCount = header2.reduce((acc, c) => {
      const str = (c ?? "").toString().trim();
      if (str === "") return acc;
      return acc + (!isNumericLike(str) ? 1 : 0);
    }, 0);

    // Consider header2 as a second header row only if it contains at least 2 numeric-like cells
    // and no text cells. This avoids fusing first data row into header.
    const hasSecondHeader =
      header2.length > 0 && numCount >= 2 && textCount === 0;

    let columns;
    let body;

    if (hasSecondHeader) {
      columns = header1.map((h, i) => {
        const part1 = (h ?? "").toString().trim();
        const part2 = (header2[i] ?? "").toString().trim();
        if (part1 && part2) return `${part1} ${part2}`;
        return part1 || part2 || `Column ${i + 1}`;
      });
      body = data.slice(2);
    } else {
      columns = header1.map((h, i) => h ?? `Column ${i + 1}`);
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
