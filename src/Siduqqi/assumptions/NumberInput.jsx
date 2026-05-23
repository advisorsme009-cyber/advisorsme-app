import React, { useState, useEffect } from "react";
import { TextField, InputAdornment } from "@mui/material";

// Formatted numeric input. Displays thousands separators when not focused,
// raw numeric when focused. Calls onChange(number | null). Passes through
// intermediate typing states ("-", ".") without committing until the value
// is parseable.

function formatDisplay(value, unit) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value; // intermediate state pass-through
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  if (unit === "currency") {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return String(value);
}

export default function NumberInput({
  value,
  onChange,
  unit = "number",
  label,
  step,
  size = "small",
  fullWidth = true,
  sx,
  placeholder,
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(() =>
    value === null || value === undefined ? "" : String(value)
  );

  // Sync external value → raw when not focused
  useEffect(() => {
    if (!focused) {
      setRaw(value === null || value === undefined ? "" : String(value));
    }
  }, [value, focused]);

  const display = focused ? raw : formatDisplay(value, unit);

  const handleChange = (e) => {
    const str = e.target.value;
    setRaw(str);

    if (str === "") {
      onChange(null);
      return;
    }
    // Allow intermediate typing; don't commit
    if (str === "-" || str === "." || str === "-.") return;

    // Strip thousands separators the user might paste
    const cleaned = str.replace(/,/g, "");
    const num = Number(cleaned);
    if (!Number.isNaN(num)) onChange(num);
  };

  const endAdornment =
    unit === "days" ? (
      <InputAdornment position="end">days</InputAdornment>
    ) : null;

  const startAdornment =
    unit === "currency" ? (
      <InputAdornment position="start">SAR</InputAdornment>
    ) : null;

  return (
    <TextField
      label={label}
      size={size}
      fullWidth={fullWidth}
      value={display}
      onChange={handleChange}
      onFocus={() => {
        setFocused(true);
        setRaw(value === null || value === undefined ? "" : String(value));
      }}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      inputProps={{
        inputMode: "decimal",
        step,
        style: { fontSize: 13 },
      }}
      InputProps={{ startAdornment, endAdornment }}
      sx={sx}
    />
  );
}
