import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";

// Siduqqi/ folder imports
import FinancialStatementUploader from "./Siduqqi/Extractor";
import FinancialStatementComponent from "./Siduqqi/FinantialStatments";
import FinancialStatementsHistorical from "./Siduqqi/FinantialStatmentsHistorical";
import AdvisorDashboard from "./Siduqqi/Dashboard";
import FinancialNotes from "./Siduqqi/FinantialNotes";
import AssumptionsInputs from "./Siduqqi/LastYearInputs";
import Lv3Calculations from "./Siduqqi/lv3Calculations";
import LinkedinAITheme from "./LinkedinAI/style/LinkedinAITheme";

function PricingTraining() {
  return (
    <ThemeProvider theme={LinkedinAITheme}>
      {/* AuthProvider and PrivateRoute are removed as they likely import non-Siduqqi files, 
          and the Siduqqi routes seem to be public. 
          If AuthProvider/PrivateRoute are required for Siduqqi routes, they must be re-added
          and their required non-Siduqqi imports must be kept. 
          For now, assuming minimal dependencies outside of Siduqqi files. */}
      <Router>
        <Routes>
          {/* Routes for Siduqqi/ files */}
          <Route path="/statements" element={<FinancialStatementComponent />} />
          <Route
            path="/historical"
            element={<FinancialStatementsHistorical />}
          />
          {/* Note: FinantialStatmentsHistorical and FinancialStatementsHistorical 
              point to the same file, keeping the latter for routes as in original code */}
          <Route
            path="/PdfExtractor"
            element={<FinancialStatementUploader />}
          />
          <Route
            path="/advisors/lv3Calculations/:client_id/:doc"
            element={<Lv3Calculations />}
          />
          <Route path="/FinancialNotes" element={<FinancialNotes />} />
          <Route path="/" element={<AdvisorDashboard />} />
          <Route path="/AssumptionsInputs" element={<AssumptionsInputs />} />

          {/* Keeping a placeholder route if needed, otherwise this can be removed */}
          {/* <Route path="/" element={<div>Siduqqi App</div>} /> */}
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default PricingTraining;
