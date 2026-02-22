import React, { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Container,
  Alert,
  Snackbar,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { useSettings } from "./context/SettingsContext";

const Settings = () => {
  const { clientId, setClientId } = useSettings();
  const [localClientId, setLocalClientId] = useState(clientId);
  const [openSnackbar, setOpenSnackbar] = useState(false);

  const handleSave = () => {
    setClientId(localClientId);
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpenSnackbar(false);
  };

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Global Settings
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Configure your global application settings here. The Client ID set
            here will be used automatically across all financial dashboards and
            extractors.
          </Typography>

          <Box sx={{ mt: 4, display: "flex", flexDirection: "column", gap: 3 }}>
            <TextField
              label="Active Client ID"
              variant="outlined"
              fullWidth
              value={localClientId}
              onChange={(e) => setLocalClientId(e.target.value)}
              helperText="This ID will be used for auto-fetching data in all screens."
            />

            <Button
              variant="contained"
              size="large"
              onClick={handleSave}
              sx={{ alignSelf: "flex-start", px: 4, borderRadius: 2 }}
            >
              Save Settings
            </Button>
          </Box>
        </Paper>

        <Snackbar
          open={openSnackbar}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity="success"
            sx={{ width: "100%", borderRadius: 2 }}
            elevation={6}
            variant="filled"
          >
            Settings saved successfully!
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
};

export default Settings;
