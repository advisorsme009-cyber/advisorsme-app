import React, { useState } from "react";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  ThemeProvider,
  createTheme,
  Icon,
} from "@mui/material";
import FinancialStatementComponent from "./FinantialStatments";
import FinancialStatementsHistorical from "./FinantialStatmentsHistorical";
import FinancialStatementUploader from "./Extractor";
import FinancialNotes from "./FinantialNotes";
import FinancialStatementsCalculations from "./FinancialCalculations";
import AssumptionsInputs from "./LastYearInputs";
import AssumptionsFull from "./AssumbtionsFull";
import ForecastingCalculationLv1 from "./ForecastingCalculationLv1";
import ForecastingCalculationLv3 from "./ForecastingCalculationLv3";
import Lv1Calculations from "./lv1Calculations";

// Define the custom MUI theme for typography and colors
const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2", // A professional blue color for headlines
    },
    text: {
      primary: "#000000", // Black for all body text
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
      color: "#1976d2", // Headline color from the primary palette
    },
    body1: {
      color: "#000000", // Body text color is black
    },
  },
});

const drawerWidth = 240;

// --- Placeholder Components for Modular Design ---

const WelcomeMessage = () => (
  <Box
    sx={{
      flexGrow: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      p: 3,
      backgroundColor: "#f4f6f8",
      height: "100%",
    }}
  >
    <Typography variant="h4" sx={{ mb: 2 }}>
      Welcome to Advisors M.E.
    </Typography>
    <Typography variant="body1">
      Please select a feature from the menu on the left.
    </Typography>
  </Box>
);

// --- Main App Component ---

function AdvisorDashboard() {
  const [path, setPath] = useState("/");

  const handleNavigation = (newPath) => {
    setPath(newPath);
  };

  const renderContent = () => {
    switch (path) {
      case "/statements":
        return <FinancialStatementComponent />;
      case "/historical":
        return <FinancialStatementsHistorical />;
      case "/calculations":
        return <FinancialStatementsCalculations />;
      case "/PdfExtractor":
        return <FinancialStatementUploader />;
      case "/FinancialNotes":
        return <FinancialNotes />;
      case "/AssumptionsInputs":
        return <AssumptionsInputs />;
      case "/AssumptionsInputsFull":
        return <AssumptionsFull />;

      case "/ForecastingCalculationLv1":
        return <Lv1Calculations />;

      case "/ForecastingCalculationLv3":
        return <ForecastingCalculationLv3 />;

      default:
        return <WelcomeMessage />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: "flex" }}>
        <CssBaseline />
        {/* Top App Bar */}
        <AppBar
          position="fixed"
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              Advisors M.E. LLC.
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Left-hand Navigation Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: "border-box",
              backgroundColor: "#e3f2fd", // Light blue background
            },
          }}
        >
          <Toolbar /> {/* Spacer to align with the AppBar */}
          <Box sx={{ overflow: "auto" }}>
            <List>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/")}
                  selected={path === "/"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>home_icon</Icon>
                  </ListItemIcon>
                  <ListItemText primary="Home" />
                </ListItemButton>
              </ListItem>
            </List>
            <Divider />
            <List>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/PdfExtractor")}
                  selected={path === "/PdfExtractor"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>upload_file_icon</Icon>
                  </ListItemIcon>
                  <ListItemText primary="PDF Extractor" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/statements")}
                  selected={path === "/statements"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>description_icon</Icon>
                  </ListItemIcon>
                  <ListItemText primary="Financial Statements" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/historical")}
                  selected={path === "/historical"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>history_icon</Icon>
                  </ListItemIcon>
                  <ListItemText primary="Historical Data" />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/FinancialNotes")}
                  selected={path === "/FinancialNotes"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>info_icon</Icon>
                  </ListItemIcon>
                  <ListItemText primary="Financial Notes" />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/calculations")}
                  selected={path === "/calculations"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>calculate</Icon>
                  </ListItemIcon>
                  <ListItemText primary="Financial Calculations" />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/AssumptionsInputs")}
                  selected={path === "/AssumptionsInputs"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>calculate</Icon>
                  </ListItemIcon>
                  <ListItemText primary="Last Year Inputs" />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/AssumptionsInputsFull")}
                  selected={path === "/AssumptionsInputsFull"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>calculate</Icon>
                  </ListItemIcon>
                  <ListItemText primary="Assumptions Inputs" />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/ForecastingCalculationLv1")}
                  selected={path === "/ForecastingCalculationLv1"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>calculate</Icon>
                  </ListItemIcon>
                  <ListItemText primary="Forecasting Lv1" />
                </ListItemButton>
              </ListItem>

              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation("/ForecastingCalculationLv3")}
                  selected={path === "/ForecastingCalculationLv3"}
                >
                  <ListItemIcon>
                    <Icon sx={{ color: "black", m: 2 }}>calculate</Icon>
                  </ListItemIcon>
                  <ListItemText primary="Forecasting Lv3 SM / GM" />
                </ListItemButton>
              </ListItem>
            </List>
          </Box>
        </Drawer>

        {/* Main Content Area */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, pt: 10 }}>
          {renderContent()}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default AdvisorDashboard;
