import React, { useState, useEffect } from "react";
import { TextField, InputAdornment } from "@mui/material";

// Stores the underlying value as a fraction (0.05 = 5%) but the user types
// and reads it in percent form. onChange(fraction | null).
//
// Display rule: fraction → (fraction * 100) rounded to 4 decimals,
// trailing zeros trimmed so 0.05 → "5" and 0.0525 → "5.25".

function toDisplay(fraction) {
  if (fraction === null || fraction === undefined || fraction === "") return "";
  if (typeof fraction === "string") return fraction; // intermediate state
  if (typeof fraction !== "number" || Number.isNaN(fraction)) return "";
  const pct = fraction * 100;
  // Trim trailing zeros, keep up to 4 decimals
  return parseFloat(pct.toFixed(4)).toString();
}

export default function PercentInput({
  value,
  onChange,
  label,
  size = "small",
  fullWidth = true,
  sx,
  placeholder,
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(() => toDisplay(value));

  useEffect(() => {
    if (!focused) setRaw(toDisplay(value));
  }, [value, focused]);

  const handleChange = (e) => {
    const str = e.target.value;
    setRaw(str);

    if (str === "") {
      onChange(null);
      return;
    }
    if (str === "-" || str === "." || str === "-.") return;

    const num = Number(str);
    if (!Number.isNaN(num)) onChange(num / 100);
  };

  return (
    <TextField
      label={label}
      size={size}
      fullWidth={fullWidth}
      value={raw}
      onChange={handleChange}
      onFocus={() => {
        setFocused(true);
        setRaw(toDisplay(value));
      }}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      inputProps={{
        inputMode: "decimal",
        style: { fontSize: 13 },
      }}
      InputProps={{
        endAdornment: <InputAdornment position="end">%</InputAdornment>,
      }}
      sx={sx}
    />
  );
}
