// Per-leaf-key metadata used by the recursive FieldRenderer to pick the right
// control, label, unit, and helper text. Any key not listed falls back to
// "number" with a humanized label.
//
// unit: "percent" stores 0–1, displays ×100 with % suffix.
// unit: "days" displays with "days" suffix, integer step.
// unit: "currency" displays with thousands separators and SAR prefix.
// unit: "year" single-year integer.
// unit: "text" free-form string.
// unit: "number" plain float.

export const FIELD_META = {
  // Top-level section labels (used when rendering multi-key sections)
  general: { label: "General", unit: null },
  rates: { label: "FX Rates", unit: null },
  revenue: { label: "Revenue", unit: null },
  margins: { label: "Margins", unit: null },
  working_capital: { label: "Working Capital", unit: null },
  capex: { label: "CapEx", unit: null },
  depreciation_rates: { label: "Depreciation Rates", unit: null },
  debt: { label: "Debt", unit: null },
  other: { label: "Other", unit: null },
  valuation: { label: "Valuation", unit: null },

  // General
  reporting_date: { label: "Reporting Date (Year)", unit: "year" },
  currency: { label: "Currency", unit: "text" },

  // FX Rates
  fx_usd_sar: { label: "USD / SAR", unit: "number", step: 0.0001 },
  fx_gbp_sar: { label: "GBP / SAR", unit: "number", step: 0.0001 },
  fx_eur_sar: { label: "EUR / SAR", unit: "number", step: 0.0001 },

  // Revenue
  growth_yoy_pct: { label: "Revenue Growth (YoY)", unit: "percent" },

  // Margins
  gp_margin_sales_pct: { label: "Gross Profit Margin", unit: "percent" },

  // Line item common fields (inside LineItemAssumption — handled specially, but
  // listed here so the driver-aware row can reuse labels)
  rate: { label: "Rate", unit: "percent" },
  base_value: { label: "Base Value", unit: "currency" },
  driver: { label: "Driver", unit: "text" },

  // Working Capital
  trade_receivables_days_sales: { label: "Trade Receivables", unit: "days", hint: "Days of Sales" },
  due_from_related_parties_days_sales: { label: "Due from Related Parties", unit: "days", hint: "Days of Sales" },
  inventories_days_cogs: { label: "Inventories", unit: "days", hint: "Days of COGS" },
  prepayments_days_cogs: { label: "Prepayments", unit: "days", hint: "Days of COGS" },
  trade_payables_days_cogs: { label: "Trade Payables", unit: "days", hint: "Days of COGS" },
  accrued_expenses_days_cogs: { label: "Accrued Expenses", unit: "days", hint: "Days of COGS" },
  due_to_related_parties_fixed_amount: { label: "Due to Related Parties", unit: "currency", hint: "Fixed amount" },

  // CapEx
  capex_pct_of_opening_balance: { label: "CapEx", unit: "percent", hint: "% of opening PP&E" },

  // Depreciation Rates — all percentages
  vehicles: { label: "Vehicles", unit: "percent" },
  furniture_and_fixtures: { label: "Furniture & Fixtures", unit: "percent" },
  office_equipment: { label: "Office Equipment", unit: "percent" },
  computers: { label: "Computers", unit: "percent" },
  leasehold_improvement: { label: "Leasehold Improvement", unit: "percent" },

  // Other
  zakat_rate: { label: "Zakat Rate", unit: "percent" },
  other_income_annual_growth_pct: { label: "Other Income Growth", unit: "percent" },
  eosb_pct: { label: "EOSB", unit: "percent", hint: "% of salaries" },
  dividend_payout_ratio: { label: "Dividend Payout", unit: "percent" },
  statutory_reserve_pct: { label: "Statutory Reserve", unit: "percent", hint: "% of net income" },
  statutory_reserve_cap_pct: { label: "Statutory Reserve Cap", unit: "percent", hint: "% of share capital" },

  // Debt
  financing_rate: { label: "Financing Rate", unit: "percent" },
  annual_repayment: { label: "Annual Repayment", unit: "currency" },
  new_borrowings: { label: "New Borrowings", unit: "currency" },

  // Valuation (optional section)
  risk_free_rate: { label: "Risk-Free Rate", unit: "percent" },
  equity_risk_premium: { label: "Equity Risk Premium", unit: "percent" },
  beta: { label: "Beta", unit: "number", step: 0.01 },
  cost_of_debt: { label: "Cost of Debt", unit: "percent" },
  terminal_growth_rate: { label: "Terminal Growth", unit: "percent" },
  ev_ebitda_multiple: { label: "EV/EBITDA Multiple", unit: "number", step: 0.1 },
  pe_multiple: { label: "P/E Multiple", unit: "number", step: 0.1 },
};

// Humanize an unknown camelCase or snake_case key.
// E.g. "salariesWagesAndBenefits" → "Salaries Wages And Benefits"
//      "sm_expenses" → "Sm Expenses" (overridden by section labels when known)
export function humanize(key) {
  if (!key) return "";
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getFieldLabel(key) {
  return FIELD_META[key]?.label || humanize(key);
}

export function getFieldUnit(key) {
  return FIELD_META[key]?.unit || "number";
}

export function getFieldHint(key) {
  return FIELD_META[key]?.hint || null;
}

export function getFieldStep(key) {
  return FIELD_META[key]?.step;
}
