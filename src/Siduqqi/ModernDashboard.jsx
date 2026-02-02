import React from "react";
import {
  Box,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  Avatar,
  Stack,
} from "@mui/material";
import {
  UploadFile as UploadFileIcon,
  Description as DescriptionIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Calculate as CalculateIcon,
  Insights as InsightsIcon,
  TableChart as TableChartIcon,
} from "@mui/icons-material";

// Configure what to show here. Toggle `show` to hide/show tiles or add new items.
export const dashboardItems = [
  {
    key: "pdf_extractor",
    title: "PDF Extractor",
    description: "Upload statements and extract tables",
    path: "/PdfExtractor",
    icon: UploadFileIcon,
    color: "#1976d2",
    show: true,
  },
  {
    key: "statements",
    title: "Financial Statements",
    description: "Browse statement tables by year",
    path: "/statements",
    icon: DescriptionIcon,
    color: "#2e7d32",
    show: true,
  },
  {
    key: "historical",
    title: "Consolidated Data",
    description: "Review historical extractions",
    path: "/historical",
    icon: HistoryIcon,
    color: "#6a1b9a",
    show: true,
  },
  {
    key: "notes",
    title: "Financial Notes",
    description: "Fetch & view note disclosures",
    path: "/FinancialNotes",
    icon: InfoIcon,
    color: "#ef6c00",
    show: true,
  },
  {
    key: "forecast_lv3",
    title: "Forecasting Lv3",
    description: "Sales & gross margin modeling",
    path: "/ForecastingCalculationLv3",
    icon: InsightsIcon,
    color: "#455a64",
    show: true,
  },
  {
    key: "create_lv1_iscon",
    title: "Create Lv1 IS-CON",
    description: "Kick off AI-based LV1 creation",
    path: "/CreateLv1IsCon",
    icon: InsightsIcon,
    color: "#1e88e5",
    show: true,
  },
  {
    key: "iscon_historical",
    title: "IS-CON Historical",
    description: "View P&L historical data table",
    path: "/IsConHistorical",
    icon: HistoryIcon,
    color: "#00695c",
    show: true,
  },
  {
    key: "financial_summary",
    title: "Financial Summary",
    description: "Unified Income Statement and Balance Sheet view",
    path: "/FinancialSummary",
    icon: TableChartIcon,
    color: "#0288d1",
    show: true,
  },
];

const Tile = ({ title, description, IconCmp, color, onClick }) => {
  return (
    <Card
      elevation={4}
      sx={{
        height: "100%",
        borderRadius: 3,
        overflow: "hidden",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": { transform: "translateY(-4px)", boxShadow: 10 },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
            <Avatar sx={{ bgcolor: color, width: 40, height: 40 }}>
              <IconCmp sx={{ color: "#fff" }} />
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
          <Chip
            label="Open"
            size="small"
            sx={{ bgcolor: `${color}1A`, color: color, fontWeight: 600 }}
          />
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

const ModernDashboard = ({ onSelect, items }) => {
  const visibleItems = (items ?? dashboardItems).filter((i) => i.show);
  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: "primary.main" }}
        >
          Welcome back
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose a module to get started
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {visibleItems.map((item) => (
          <Grid key={item.key} item xs={12} sm={6} md={4} lg={3}>
            <Tile
              title={item.title}
              description={item.description}
              IconCmp={item.icon}
              color={item.color}
              onClick={() => onSelect?.(item.path)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ModernDashboard;
