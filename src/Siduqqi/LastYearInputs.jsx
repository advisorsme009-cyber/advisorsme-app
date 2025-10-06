import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Grid,
  Paper,
  TextField,
  Box,
  ThemeProvider,
  createTheme,
  CssBaseline,
} from "@mui/material";

const last_year_data = {
  IS_CON: {
    fairValueLoss: {
      2023: null,
      param_name: "Fair value loss on investments",
    },
    generalAdminExpenses: {
      2023: -4603718,
      param_name: "General and administrative expenses",
    },
    sellingMarketingExpenses: {
      2023: -10642887,
      param_name: "Selling and marketing expenses",
    },
    depreciationAmortization: {
      2023: -105858,
      param_name: "Depreciation and amortization",
    },
    costOfRevenue: {
      2023: -30069414,
      param_name: "Cost of revenue",
    },
    equityIncome: {
      2023: null,
      param_name: "Share of income from equity accounted investment",
    },
    financeCosts: {
      2023: -832520,
      param_name: "Finance costs",
    },
    zakat: {
      2023: null,
      param_name: "Zakat",
    },
    revenue: {
      2023: 40067175,
      param_name: "Revenue",
    },
    ratios: {
      smAsPercentOfRevenue: {
        2023: 0.27,
        param_name: "S&M as % of revenue",
      },
      gaAsPercentOfRevenue: {
        2023: 0.11,
        param_name: "G&A as % of revenue",
      },
      grossProfitMarginPercent: {
        2023: 0.25,
        param_name: "Gross profit margin %",
      },
      operatingProfitPercent: {
        2023: -0.13,
        param_name: "Operating profit %",
      },
      ebitdaPercent: {
        2023: -0.13,
        param_name: "EBITDA %",
      },
      netIncomePercent: {
        2023: -0.15,
        param_name: "Net income %",
      },
    },
  },
};

const assumptions = {
  assumptions: {
    current_year_assumption_revenue: {
      2024: 0.53,
      2025: 0.13,
      2026: 0.06,
      2027: 0.06,
      2028: 0.06,
      param_name: "REVENUE (Growth %)",
    },
    gp_margin_forecast_current_year: {
      2024: 0.25,
      2025: 0.25,
      2026: 0.25,
      2027: 0.25,
      2028: 0.25,
      param_name: "GP Margin (%)",
    },
    s_m_expenses_current_year_assumption: {
      2024: 0.181,
      2025: 0.165,
      2026: 0.162,
      2027: 0.158,
      2028: 0.154,
      param_name: "S&M Expenses (% of Revenue)",
    },
    g_a_expenses_current_year_assumption: {
      2024: -0.133,
      2025: 0.03,
      2026: 0.03,
      2027: 0.03,
      2028: 0.03,
      param_name: "G&A Expenses (% of Revenue)",
    },
    depreciation_and_amortization: {
      2024: -87418,
      2025: -84679,
      2026: -82026,
      2027: -79457,
      2028: -76968,
      param_name: "Depreciation and Amortization",
    },
    finance_costs: {
      2024: -144044,
      2025: -144044,
      2026: -144044,
      2027: -144044,
      2028: -144044,
      param_name: "Finance Costs",
    },
  },
};

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
  typography: {
    fontFamily: "Roboto, sans-serif",
  },
});

const AssumptionsInputs = () => {
  // Use a deep copy to ensure state is independent of the original data
  const [data, setData] = useState({
    lastYear: JSON.parse(JSON.stringify(last_year_data.IS_CON)),
    assumptions: JSON.parse(JSON.stringify(assumptions.assumptions)),
  });

  const handleLastYearChange = (section, key, e) => {
    const value = e.target.value === "" ? null : Number(e.target.value);
    setData((prevData) => {
      const newData = { ...prevData };
      if (section) {
        newData.lastYear = {
          ...newData.lastYear,
          [section]: {
            ...newData.lastYear[section],
            [key]: {
              ...newData.lastYear[section][key],
              2023: value,
            },
          },
        };
      } else {
        newData.lastYear = {
          ...newData.lastYear,
          [key]: {
            ...newData.lastYear[key],
            2023: value,
          },
        };
      }
      return newData;
    });
  };

  const handleAssumptionsChange = (key, year, e) => {
    const value = e.target.value === "" ? null : Number(e.target.value);
    setData((prevData) => {
      const newData = { ...prevData };
      newData.assumptions = {
        ...newData.assumptions,
        [key]: {
          ...newData.assumptions[key],
          [year]: value,
        },
      };
      return newData;
    });
  };

  const handleRecalculate = () => {
    console.log("Recalculate button clicked. State is:", data);
    // Logic for recalculation would go here
  };

  const renderTextField = (value, paramName, onChange) => {
    return (
      <Box key={paramName} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label={paramName}
          value={value === null ? "" : value}
          onChange={onChange}
          type="number"
          variant="outlined"
          size="small"
          InputLabelProps={{ shrink: true }}
        />
      </Box>
    );
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" color="primary">
          <Toolbar>
            <Typography
              variant="h6"
              component="div"
              sx={{ flexGrow: 1, color: "#FF8C00" }}
            >
              Financial Data Viewer
            </Typography>
            <Button color="inherit" onClick={handleRecalculate}>
              Recalculate
            </Button>
          </Toolbar>
        </AppBar>

        <Container sx={{ mt: 4, mb: 4 }}>
          <Grid container spacing={4}>
            {/* Last Year Data Section */}
            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
                <Typography
                  variant="h5"
                  gutterBottom
                  sx={{ mb: 2, color: "#FF8C00" }}
                >
                  Last Year's Data (2023)
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(data.lastYear).map(([key, item]) => {
                    if (key === "ratios") {
                      return (
                        <Grid item xs={12} key={key}>
                          <Typography
                            variant="h6"
                            sx={{ mt: 2, mb: 1, color: "#FF8C00" }}
                          >
                            Ratios
                          </Typography>
                          {Object.entries(item).map(([ratioKey, ratioItem]) => (
                            <Box key={ratioKey}>
                              {renderTextField(
                                ratioItem["2023"],
                                ratioItem.param_name,
                                (e) =>
                                  handleLastYearChange("ratios", ratioKey, e)
                              )}
                            </Box>
                          ))}
                        </Grid>
                      );
                    } else {
                      return (
                        <Grid item xs={12} key={key}>
                          {renderTextField(item["2023"], item.param_name, (e) =>
                            handleLastYearChange(null, key, e)
                          )}
                        </Grid>
                      );
                    }
                  })}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default AssumptionsInputs;
