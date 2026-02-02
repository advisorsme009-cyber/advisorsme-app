import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";

// Siduqqi/ screens
import FinancialStatementUploader from "./Siduqqi/Extractor";
import FinancialStatementComponent from "./Siduqqi/FinantialStatments";
import FinancialStatementsHistorical from "./Siduqqi/FinantialStatmentsHistorical";
import Dashboard from "./Siduqqi/Dashboard";
import FinancialNotes from "./Siduqqi/FinantialNotes";
import ForecastingCalculationLv1 from "./Siduqqi/ForecastingCalculationLv1";
import ForecastingCalculationLv3 from "./Siduqqi/ForecastingCalculationLv3";
import Lv3Calculations from "./Siduqqi/lv3Calculations";
import IsConHistorical from "./Siduqqi/IsConHistorical";
import BSHistorical from "./Siduqqi/BSHistorical";
import BSForecasting from "./Siduqqi/BSForecasting";
import ExportManager from "./Siduqqi/ExportManager";
import FinancialSummaryTable from "./Siduqqi/FinancialSummaryTable";

// Theme & Auth
import LinkedinAITheme from "./LinkedinAI/style/LinkedinAITheme";
import { AuthProvider } from "./Siduqqi/auth/AuthContext";
import RequireAuth from "./Siduqqi/auth/RequireAuth";
import AuthPage from "./Siduqqi/auth/AuthPage";
import SignupPage from "./Siduqqi/auth/SignupPage";
import Lv1Calculations from "./Siduqqi/lv1Calculations";

function App() {
  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/signup" element={<SignupPage />} />

            <Route
              path="/"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />

            <Route
              path="/statements"
              element={
                <RequireAuth>
                  <Dashboard>
                    <FinancialStatementComponent />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/historical"
              element={
                <RequireAuth>
                  <Dashboard>
                    <FinancialStatementsHistorical />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/PdfExtractor"
              element={
                <RequireAuth>
                  <Dashboard>
                    <FinancialStatementUploader />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/advisors/lv3Calculations/:client_id/:doc"
              element={
                <RequireAuth>
                  <Dashboard>
                    <Lv3Calculations />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/FinancialNotes"
              element={
                <RequireAuth>
                  <Dashboard>
                    <FinancialNotes />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/ForecastingCalculationLv1"
              element={
                <RequireAuth>
                  <Dashboard>
                    <Lv1Calculations />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/ForecastingCalculationLv3"
              element={
                <RequireAuth>
                  <Dashboard>
                    <Lv3Calculations />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/IsConHistorical"
              element={
                <RequireAuth>
                  <Dashboard>
                    <IsConHistorical />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/BSHistorical"
              element={
                <RequireAuth>
                  <Dashboard>
                    <BSHistorical />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/BSForecasting"
              element={
                <RequireAuth>
                  <Dashboard>
                    <BSForecasting />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/ExportManager"
              element={
                <RequireAuth>
                  <Dashboard>
                    <ExportManager />
                  </Dashboard>
                </RequireAuth>
              }
            />

            <Route
              path="/FinancialSummary"
              element={
                <RequireAuth>
                  <Dashboard>
                    <FinancialSummaryTable />
                  </Dashboard>
                </RequireAuth>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
