import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
} from "@mui/material";
import NumberInput from "./NumberInput";
import PercentInput from "./PercentInput";
import { humanize } from "./fieldMeta";
import { isPerYearDict } from "./shapes";

const DRIVER_OPTIONS = [
  { value: "yoy_growth", label: "YoY Growth" },
  { value: "pct_of_revenue", label: "% of Revenue" },
  { value: "fixed", label: "Fixed Amount" },
];

function isSynthetic(itemKey) {
  return /^other[A-Z].*Expenses$/.test(itemKey);
}

// Render a single S&M / G&A line item — driver dropdown + rate + optional base value.
// If `rate` is a per-year dict, render it as a row of inputs instead of one.
export default function LineItemRow({
  itemKey,
  item,
  path,
  moduleHint, // "S&M" or "G&A"
  onFieldChange,
  classifyLineItem,
}) {
  const [classifying, setClassifying] = useState(false);
  const driver = item.driver || "yoy_growth";
  const rate = item.rate;
  const baseValue = item.base_value;
  const synthetic = isSynthetic(itemKey);
  const rateIsPerYear = isPerYearDict(rate);

  const handleDriverChange = async (e) => {
    const newDriver = e.target.value;
    if (!classifyLineItem || !moduleHint) {
      // Fallback: direct patch (backend supports it via normal PATCH merge)
      onFieldChange(`${path}.driver`, newDriver);
      return;
    }
    setClassifying(true);
    try {
      await classifyLineItem(moduleHint, itemKey, newDriver);
    } finally {
      setClassifying(false);
    }
  };

  const isFixed = driver === "fixed";

  const renderRate = () => {
    if (rateIsPerYear) {
      const years = Object.keys(rate)
        .filter((k) => /^\d{4}$/.test(k))
        .sort();
      return (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {years.map((year) =>
            isFixed ? (
              <Box key={year} sx={{ minWidth: 100, flex: "1 1 100px" }}>
                <NumberInput
                  value={rate[year]}
                  onChange={(v) => onFieldChange(`${path}.rate.${year}`, v)}
                  label={year}
                  unit="currency"
                />
              </Box>
            ) : (
              <Box key={year} sx={{ minWidth: 90, flex: "1 1 90px" }}>
                <PercentInput
                  value={rate[year]}
                  onChange={(v) => onFieldChange(`${path}.rate.${year}`, v)}
                  label={year}
                />
              </Box>
            )
          )}
        </Stack>
      );
    }
    if (isFixed) {
      return (
        <NumberInput
          value={rate ?? null}
          onChange={(v) => onFieldChange(`${path}.rate`, v)}
          label="Amount"
          unit="currency"
        />
      );
    }
    return (
      <PercentInput
        value={rate ?? null}
        onChange={(v) => onFieldChange(`${path}.rate`, v)}
        label="Rate"
      />
    );
  };

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1.5,
        background: synthetic ? "rgba(255, 243, 224, 0.4)" : "background.paper",
      }}
    >
      {/* Row 1: label + badges */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
          {humanize(itemKey)}
        </Typography>
        {synthetic && (
          <Chip
            label="synthetic gap"
            size="small"
            variant="outlined"
            color="warning"
            sx={{ height: 20, fontSize: 10 }}
          />
        )}
        {rateIsPerYear && (
          <Chip
            label="per-year"
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: 10 }}
          />
        )}
      </Stack>

      {/* Row 2: driver + rate + base_value */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems="flex-start">
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Driver</InputLabel>
          <Select
            value={driver}
            label="Driver"
            onChange={handleDriverChange}
            disabled={classifying}
            sx={{ fontSize: 13 }}
          >
            {DRIVER_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
          {classifying && (
            <Box sx={{ position: "absolute", right: 32, top: 10 }}>
              <CircularProgress size={14} />
            </Box>
          )}
        </FormControl>

        <Box sx={{ flex: 1, width: "100%" }}>{renderRate()}</Box>

        {baseValue !== null && baseValue !== undefined && (
          <Box sx={{ minWidth: 180 }}>
            <NumberInput
              value={baseValue}
              onChange={(v) => onFieldChange(`${path}.base_value`, v)}
              label="Base Value"
              unit="currency"
            />
          </Box>
        )}
      </Stack>
    </Box>
  );
}
