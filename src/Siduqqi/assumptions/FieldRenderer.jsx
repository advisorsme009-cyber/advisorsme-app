import React from "react";
import { Box, Typography, Stack, TextField } from "@mui/material";
import NumberInput from "./NumberInput";
import PercentInput from "./PercentInput";
import LineItemRow from "./LineItemRow";
import { getFieldLabel, getFieldUnit, getFieldHint, getFieldStep } from "./fieldMeta";
import { isPerYearDict, isLineItemAssumption, isPlainNestedObject } from "./shapes";

// Scalar input — dispatches by unit
function ScalarInput({ value, unit, label, onChange, step }) {
  if (unit === "percent") {
    return <PercentInput value={value} onChange={onChange} label={label} />;
  }
  if (unit === "text") {
    return (
      <TextField
        label={label}
        size="small"
        fullWidth
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        inputProps={{ style: { fontSize: 13 } }}
      />
    );
  }
  if (unit === "year") {
    return (
      <NumberInput
        value={value}
        onChange={(v) => onChange(v === null ? null : Math.round(v))}
        label={label}
        unit="number"
        step={1}
      />
    );
  }
  return <NumberInput value={value} onChange={onChange} label={label} unit={unit} step={step} />;
}

// Per-year row — same unit/control as the scalar, but one per year key
function PerYearRow({ path, values, unit, step, onFieldChange }) {
  const years = Object.keys(values)
    .filter((k) => /^\d{4}$/.test(k))
    .sort();

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {years.map((year) => (
        <Box key={year} sx={{ minWidth: 110, flex: "1 1 110px" }}>
          <ScalarInput
            value={values[year]}
            unit={unit}
            label={year}
            step={step}
            onChange={(v) => onFieldChange(`${path}.${year}`, v)}
          />
        </Box>
      ))}
    </Stack>
  );
}

// Recursive renderer — walks the assumption tree and emits controls.
// `parentKey` hints at the unit for per-year dicts (the unit comes from the
// containing key, e.g. `growth_yoy_pct` even though its children are "2024").
export default function FieldRenderer({
  value,
  path,
  parentKey,
  onFieldChange,
  classifyLineItem,
  moduleHint, // "S&M" or "G&A" for line items under opex
}) {
  if (value === undefined) return null;

  // LineItemAssumption — must check before isPerYearDict (should not match) and before
  // the generic nested-object case.
  if (isLineItemAssumption(value)) {
    const itemKey = path.split(".").pop();
    return (
      <LineItemRow
        itemKey={itemKey}
        item={value}
        path={path}
        moduleHint={moduleHint}
        onFieldChange={onFieldChange}
        classifyLineItem={classifyLineItem}
      />
    );
  }

  // Per-year dict — render as row of inputs, unit derived from parent key
  if (isPerYearDict(value)) {
    const unit = getFieldUnit(parentKey);
    const step = getFieldStep(parentKey);
    return (
      <PerYearRow
        path={path}
        values={value}
        unit={unit}
        step={step}
        onFieldChange={onFieldChange}
      />
    );
  }

  // Scalar
  if (value === null || typeof value !== "object") {
    const unit = getFieldUnit(parentKey);
    const step = getFieldStep(parentKey);
    const label = getFieldLabel(parentKey);
    return (
      <ScalarInput
        value={value}
        unit={unit}
        label={label}
        step={step}
        onChange={(v) => onFieldChange(path, v)}
      />
    );
  }

  // Plain nested object (not per-year, not line item) — recurse into children.
  // Used for `opex.sm_expenses` (map of line items), nested valuation groups, etc.
  if (isPlainNestedObject(value)) {
    return (
      <Stack spacing={2}>
        {Object.entries(value).map(([childKey, childValue]) => {
          const childPath = `${path}.${childKey}`;
          const childIsLineItem = isLineItemAssumption(childValue);
          const childIsPerYear = isPerYearDict(childValue);
          const childIsScalar = childValue === null || typeof childValue !== "object";

          // Leaf-ish children (scalar, per-year, line item) render directly.
          if (childIsLineItem || childIsPerYear || childIsScalar) {
            // For per-year children, show a small header with the field label
            if (childIsPerYear) {
              const label = getFieldLabel(childKey);
              const hint = getFieldHint(childKey);
              return (
                <Box key={childKey}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, display: "block", mb: 0.5 }}
                  >
                    {label}
                    {hint && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.disabled"
                        sx={{ ml: 0.75, fontWeight: 400 }}
                      >
                        · {hint}
                      </Typography>
                    )}
                  </Typography>
                  <FieldRenderer
                    value={childValue}
                    path={childPath}
                    parentKey={childKey}
                    onFieldChange={onFieldChange}
                    classifyLineItem={classifyLineItem}
                    moduleHint={moduleHint}
                  />
                </Box>
              );
            }
            return (
              <FieldRenderer
                key={childKey}
                value={childValue}
                path={childPath}
                parentKey={childKey}
                onFieldChange={onFieldChange}
                classifyLineItem={classifyLineItem}
                moduleHint={moduleHint}
              />
            );
          }

          // Deep nested object — group under a subheader.
          const label = getFieldLabel(childKey);
          return (
            <Box key={childKey}>
              <Typography
                variant="subtitle2"
                color="text.primary"
                sx={{ fontWeight: 700, mb: 1, mt: 0.5 }}
              >
                {label}
              </Typography>
              <Box sx={{ pl: 1.5, borderLeft: "2px solid #e0e0e0" }}>
                <FieldRenderer
                  value={childValue}
                  path={childPath}
                  parentKey={childKey}
                  onFieldChange={onFieldChange}
                  classifyLineItem={classifyLineItem}
                  moduleHint={moduleHint}
                />
              </Box>
            </Box>
          );
        })}
      </Stack>
    );
  }

  return null;
}
