import React, { useState, useEffect } from "react";
import { Container, Typography, Button, Box, Grid } from "@mui/material";
import { Card, CardContent, TextField } from "@mui/material";

const saveApiData = async (data) => {
  console.log("Saving data...", data);
  return new Promise((resolve) =>
    setTimeout(() => {
      console.log("Data saved successfully! ✅");
      resolve({ success: true, message: "Data updated." });
    }, 1000)
  );
};

const mockApiData = {
  Assumption: {
    revenue: {
      param_name: "Revenue",
      param_type: "Growth %",
      2024: "53%",
      2025: "13%",
      2026: "6%",
      2027: "6%",
      2028: "6%",
    },
    gp_margin: {
      param_name: "GP Margin",
      param_type: "Sales %",
      2024: "25.00%",
      2025: "25.00%",
      2026: "25.00%",
      2027: "25.00%",
      2028: "25.00%",
    },
    "s&m_expenses": {
      param_name: "S&M Expenses",
      param_type: "Sales %",
      2024: "18.10%",
      2025: "16.50%",
      2026: "16.20%",
      2027: "15.80%",
      2028: "15.40%",
      salaries_wages_and_benefits: {
        param_name: "Salaries, wages and benefits",
        param_type: "YoY %",
        2024: "3.00%",
        2025: "3.00%",
        2026: "3.00%",
        2027: "3.00%",
        2028: "3.00%",
      },
      repairs_and_maintenance: {
        param_name: "Repairs and maintenance",
        param_type: "YoY %",
        2024: "5.00%",
        2025: "5.00%",
        2026: "5.00%",
        2027: "5.00%",
        2028: "5.00%",
      },
      rent: {
        param_name: "Rent",
        param_type: "YoY %",
        2024: "5.00%",
        2025: "5.00%",
        2026: "5.00%",
        2027: "5.00%",
        2028: "5.00%",
      },
      travel_and_communication: {
        param_name: "Travel and communication",
        param_type: "Sales %",
        2024: "1.00%",
        2025: "1.00%",
        2026: "1.00%",
        2027: "1.00%",
        2028: "1.00%",
      },
      legal_cost: {
        param_name: "Legal cost",
        param_type: "YoY %",
        2024: "",
        2025: "0.00%",
        2026: "0.00%",
        2027: "0.00%",
        2028: "0.00%",
      },
      selling_and_promotion: {
        param_name: "Selling and promotion",
        param_type: "Sales %",
        2024: "0.00%",
        2025: "0.00%",
        2026: "0.00%",
        2027: "0.00%",
        2028: "0.00%",
      },
      stationary: {
        param_name: "Stationary",
        param_type: "YoY %",
        2024: "",
        2025: "0.00%",
        2026: "0.00%",
        2027: "0.00%",
        2028: "0.00%",
      },
      insurance: {
        param_name: "Insurance",
        param_type: "YoY %",
        2024: "",
        2025: "0.00%",
        2026: "0.00%",
        2027: "0.00%",
        2028: "0.00%",
      },
      other: {
        param_name: "Other",
        param_type: "YoY %",
        2024: "5.00%",
        2025: "5.00%",
        2026: "5.00%",
        2027: "5.00%",
        2028: "5.00%",
      },
    },
    "g&a_expenses": {
      param_name: "G&A Expenses",
      param_type: "YoY %",
      2024: "-13.30%",
      2025: "3.00%",
      2026: "3.00%",
      2027: "3.00%",
      2028: "3.00%",
      salaries_wages_and_benefits: {
        param_name: "Salaries, wages and benefits",
        param_type: "YoY %",
        2024: "3.00%",
        2025: "3.00%",
        2026: "3.00%",
        2027: "3.00%",
        2028: "3.00%",
      },
      impairment_on_trade_receivables: {
        param_name: "Impairment on trade receivables",
        param_type: "-",
        2024: "",
        2025: "",
        2026: "",
        2027: "",
        2028: "",
      },
      management_recharge: {
        param_name: "Management recharge",
        param_type: "YoY %",
        2024: "-20.00%",
        2025: "3.00%",
        2026: "3.00%",
        2027: "3.00%",
        2028: "3.00%",
      },
      professional_fees: {
        param_name: "Professional fees",
        param_type: "YoY %",
        2024: "3.00%",
        2025: "3.00%",
        2026: "3.00%",
        2027: "3.00%",
        2028: "3.00%",
      },
      travel: {
        param_name: "Travel",
        param_type: "YoY %",
        2024: "3.00%",
        2025: "3.00%",
        2026: "3.00%",
        2027: "3.00%",
        2028: "3.00%",
      },
      stationary: {
        param_name: "Stationary",
        param_type: "YoY %",
        2024: "3.00%",
        2025: "3.00%",
        2026: "3.00%",
        2027: "3.00%",
        2028: "3.00%",
      },
      other: {
        param_name: "Other",
        param_type: "YoY %",
        2024: "3.00%",
        2025: "3.00%",
        2026: "3.00%",
        2027: "3.00%",
        2028: "3.00%",
      },
    },
    working_capital: {
      param_name: "Working Capital",
      trade_receivables: {
        param_name: "Trade receivables",
        param_type: "Sales",
        2024: "164",
        2025: "164",
        2026: "164",
        2027: "164",
        2028: "164",
      },
      due_from_related_parties: {
        param_name: "Due from related parties",
        param_type: "Sales",
        2024: "290",
        2025: "256",
        2026: "241",
        2027: "228",
        2028: "215",
      },
      inventories: {
        param_name: "Inventories",
        param_type: "COGS",
        2024: "90",
        2025: "90",
        2026: "90",
        2027: "90",
        2028: "90",
      },
      prepayments_and_other_receivables: {
        param_name: "Prepayments and other receivables",
        param_type: "COGS",
        2024: "91",
        2025: "91",
        2026: "91",
        2027: "91",
        2028: "91",
      },
      trade_payables: {
        param_name: "Trade payables",
        param_type: "COGS",
        2024: "-120",
        2025: "-120",
        2026: "-120",
        2027: "-120",
        2028: "-120",
      },
      accrued_expenses_and_other_liabilities: {
        param_name: "Accrued expenses and other liabilities",
        param_type: "COGS",
        2024: "-180",
        2025: "-180",
        2026: "-180",
        2027: "-180",
        2028: "-180",
      },
      due_to_related_parties: {
        param_name: "Due to related parties",
        param_type: "",
        2024: "-295",
        2025: "-295",
        2026: "-295",
        2027: "-295",
        2028: "-295",
      },
      zakat_payable: {
        param_name: "Zakat payable",
        param_type: "",
        2024: "0",
        2025: "0",
        2026: "0",
        2027: "0",
        2028: "0",
      },
    },
    capex: {
      param_name: "CAPEX",
      param_type: "% of OB",
      2024: "12%",
      2025: "12%",
      2026: "12%",
      2027: "12%",
      2028: "12%",
    },
    depreciation: {
      param_name: "DEPRECIATION",
      param_type: "% of OB + Addns",
      2024: "14%",
      2025: "14%",
      2026: "14%",
      2027: "14%",
      2028: "14%",
      buildings: {
        param_name: "Buildings",
        param_type: "",
        2024: "",
        2025: "",
        2026: "",
        2027: "",
        2028: "",
      },
      plant: {
        param_name: "Plant",
        param_type: "",
        2024: "",
        2025: "",
        2026: "",
        2027: "",
        2028: "",
      },
      machinery_and_equipment: {
        param_name: "Machinery and equipment",
        param_type: "",
        2024: "",
        2025: "",
        2026: "",
        2027: "",
        2028: "",
      },
      vehicles: {
        param_name: "Vehicles",
        param_type: "",
        2024: "20%",
        2025: "20%",
        2026: "20%",
        2027: "",
        2028: "",
      },
      furniture_and_fixtures: {
        param_name: "Furniture and fixtures",
        param_type: "",
        2024: "10%",
        2025: "10%",
        2026: "10%",
        2027: "",
        2028: "",
      },
      office_equipment: {
        param_name: "Office equipment",
        param_type: "",
        2024: "10%",
        2025: "10%",
        2026: "10%",
        2027: "",
        2028: "",
      },
      computers: {
        param_name: "Computers",
        param_type: "",
        2024: "10%",
        2025: "10%",
        2026: "10%",
        2027: "",
        2028: "",
      },
      leasehold_improvement: {
        param_name: "Leasehold improvement",
        param_type: "",
        2024: "5%",
        2025: "5%",
        2026: "5%",
        2027: "",
        2028: "",
      },
      rou_assets: {
        param_name: "ROU Assets",
        param_type: "",
        2024: "",
        2025: "",
        2026: "",
        2027: "",
        2028: "",
      },
    },
    eosb: {
      param_name: "EOSB",
      param_type: "",
      2024: "4.20%",
      2025: "4.20%",
      2026: "4.20%",
      2027: "4.20%",
      2028: "4.20%",
    },
    total_salaries: {
      param_name: "Total salaries",
      param_type: "",
      2024: "9,635,085",
      2025: "9,924,137",
      2026: "10,221,861",
      2027: "10,528,517",
      2028: "10,844,373",
    },
    eosi: {
      param_name: "EOSI",
      param_type: "",
      2024: "401,462",
      2025: "413,506",
      2026: "425,911",
      2027: "438,688",
      2028: "451,849",
    },
    "inc/dec_in_eosb": {
      param_name: "Inc/dec in EOSB",
      param_type: "",
      2024: "682,157",
      2025: "12,044",
      2026: "12,405",
      2027: "12,777",
      2028: "13,161",
    },
    equity: {
      param_name: "EQUITY",
      capital_increase: {
        param_name: "Capital increase",
        param_type: "SAR",
        2024: "-",
        2025: "-",
        2026: "-",
        2027: "-",
        2028: "-",
      },
      dividend_payout_ratio: {
        param_name: "Dividend payout ratio",
        param_type: "%",
        2024: "0%",
        2025: "0%",
        2026: "0%",
        2027: "0%",
        2028: "0%",
      },
    },
    debt: {
      param_name: "DEBT",
      loan_proceeds: {
        param_name: "Loan proceeds",
        param_type: "",
        2024: "-",
        2025: "",
        2026: "",
        2027: "",
        2028: "",
      },
      loan_repayments: {
        param_name: "Loan repayments",
        param_type: "",
        2024: "",
        2025: "",
        2026: "-",
        2027: "-",
        2028: "-",
      },
    },
    finance_costs: {
      param_name: "FINANCE COSTS",
      st_loans: {
        param_name: "ST Loans",
        param_type: "Rate",
        2024: "0%",
        2025: "0%",
        2026: "0%",
        2027: "0%",
        2028: "0%",
      },
      lt_loans: {
        param_name: "LT Loans",
        param_type: "",
        2024: "",
        2025: "",
        2026: "",
        2027: "",
        2028: "",
      },
    },
    debt_ratio: {
      param_name: "DEBT",
      "st_as_%_of_total_debt": {
        param_name: "ST as % of Total Debt",
        param_type: "",
        2024: "50.00%",
        2025: "50.00%",
        2026: "50.00%",
        2027: "50.00%",
        2028: "50.00%",
      },
      "lt_as_%_of_total_debt": {
        param_name: "LT as % of Total Debt",
        param_type: "",
        2024: "50.00%",
        2025: "50.00%",
        2026: "50.00%",
        2027: "50.00%",
        2028: "50.00%",
      },
    },
    zakat_and_tax: {
      param_name: "ZAKAT AND TAX",
      zakat: {
        param_name: "Zakat",
        param_type: "Rate",
        2024: "2.58%",
        2025: "2.58%",
        2026: "2.58%",
        2027: "2.58%",
        2028: "2.58%",
      },
      tax_on_profit_share: {
        param_name: "Tax on profit share",
        param_type: "Rate",
        2024: "",
        2025: "",
        2026: "",
        2027: "",
        2028: "",
      },
      "tax_on_dividend_(foreign_shareholders)": {
        param_name: "Tax on dividend (foreign shareholders)",
        param_type: "Rate",
        2024: "",
        2025: "",
        2026: "",
        2027: "",
        2028: "",
      },
    },
  },
};

const mockApiCall = () => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(mockApiData), 500);
  });
};

const AssumptionsFull = () => {
  const [data, setData] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const result = await mockApiCall();
      setData(result.Assumption);
    };
    fetchData();
  }, []);

  const handleSave = () => {
    // Mocked API save function
    console.log("Saving data:", data);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      handleSave();
    }
  };

  const updateData = (path, value) => {
    // Logic to deeply update the nested state
    setData((prevData) => {
      // create a copy to avoid direct state mutation
      const newData = JSON.parse(JSON.stringify(prevData));
      // path would be an array like ['s&m_expenses', 'travel_and_communication', '2024']
      let current = newData;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newData;
    });
  };

  const DataCard = ({ title, data, onUpdate, path }) => {
    const isNested = Object.values(data).some(
      (val) => typeof val === "object" && val !== null
    );

    const handleInputChange = (e, key) => {
      onUpdate([...path, key], e.target.value);
    };

    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography color="primary.main" variant="h6" component="div">
            {title}
          </Typography>
          <Box sx={{ pl: isNested ? 2 : 0 }}>
            {Object.entries(data).map(([key, value]) => {
              if (typeof value === "object" && value !== null) {
                return (
                  <DataCard
                    key={key}
                    title={value.param_name || key}
                    data={value}
                    onUpdate={onUpdate}
                    path={[...path, key]}
                  />
                );
              }
              if (key !== "param_name" && key !== "param_type") {
                return (
                  <Box key={key} sx={{ mt: 1 }}>
                    <TextField
                      fullWidth
                      label={key}
                      value={value}
                      onChange={(e) => handleInputChange(e, key)}
                      size="small"
                      variant="outlined"
                      placeholder={data.param_type}
                    />
                  </Box>
                );
              }
              return null;
            })}
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Container onKeyDown={handleKeyDown} tabIndex={0}>
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Financial Data Management
        </Typography>
        <Grid container spacing={3}>
          {Object.entries(data).map(([key, value]) => (
            <Grid item xs={12} key={key}>
              <DataCard
                title={value.param_name || key}
                data={value}
                onUpdate={updateData}
                path={[key]}
              />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Button variant="contained" color="primary" onClick={handleSave}>
            Save
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default AssumptionsFull;
