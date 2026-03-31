import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import LinkedinAITheme from "../LinkedinAI/style/LinkedinAITheme";
import { apiUrl } from "./hooks/api";
import { useSettings } from "./context/SettingsContext";

const HistoricalAIAgent = () => {
  const { clientId } = useSettings();
  const [activeTab, setActiveTab] = useState(0);

  // General State
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ==========================================
  // Tab 0: Generation Dashboard View State
  // ==========================================
  const [documentCodes, setDocumentCodes] = useState([]);
  const [selectedDocumentCode, setSelectedDocumentCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [agentLogs, setAgentLogs] = useState("");
  const [historicalDataMatrix, setHistoricalDataMatrix] = useState(null);

  // ==========================================
  // Tab 1: Mapping Management View State
  // ==========================================
  const [mappings, setMappings] = useState({});
  const [isFetchingMappings, setIsFetchingMappings] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [newMappingForm, setNewMappingForm] = useState({
    code: "",
    full_name: "",
    primary_bucket: "",
    note_bucket: "",
  });

  // Fetch available document codes on mount
  useEffect(() => {
    fetchDocumentCodes();
  }, []);

  const fetchDocumentCodes = async () => {
    setIsFetchingMappings(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/agents/historical/codes`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch codes: ${response.statusText}`);
      }
      const data = await response.json();
      setDocumentCodes(data.valid_codes || []);
      setMappings(data.full_mappings || {});
    } catch (err) {
      console.error("Error fetching codes:", err);
      setError("Failed to load document codes. Ensure backend is running.");
    } finally {
      setIsFetchingMappings(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setError("");
    setSuccessMsg("");
  };

  // --- Generation Logic ---
  const handleGenerate = async () => {
    if (!clientId) {
      setError("Please select a valid Client ID from the top navigation dropdown first.");
      return;
    }
    if (!selectedDocumentCode) {
      setError("Please select a document code.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setSuccessMsg("");
    setHistoricalDataMatrix(null);
    setAgentLogs("");

    try {
      const response = await fetch(`${apiUrl}/agents/historical/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          document_code: selectedDocumentCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `Agent failed: ${response.statusText}`);
      }

      const data = await response.json();
      setAgentLogs(data.agent_response || "Generation complete.");
      
      if (data.details) {
         setHistoricalDataMatrix(data.details);
         setSuccessMsg("Historical data retrieved successfully.");
      } else {
         setSuccessMsg("Agent task initiated successfully. Data has been saved to Firebase.");
      }

    } catch (err) {
      console.error("Generation error:", err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Mapping Logic ---
  const handleMappingInputChange = (e) => {
    const { name, value } = e.target;
    setNewMappingForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitNewMapping = async () => {
    if (!newMappingForm.code || !newMappingForm.full_name || !newMappingForm.primary_bucket || !newMappingForm.note_bucket) {
      setError("All fields are required to create a new mapping.");
      return;
    }

    setIsSavingMapping(true);
    setError("");
    setSuccessMsg("");

    try {
      const response = await fetch(`${apiUrl}/agents/historical/codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newMappingForm),
      });

      if (!response.ok) {
        throw new Error("Failed to save new mapping.");
      }

      setSuccessMsg(`Successfully added mapping for ${newMappingForm.code}.`);
      setNewMappingForm({ code: "", full_name: "", primary_bucket: "", note_bucket: "" });
      // Refresh list
      fetchDocumentCodes();
    } catch (err) {
      console.error("Mapping error:", err);
      setError(err.message);
    } finally {
      setIsSavingMapping(false);
    }
  };

  // --- render helpers ---
  const renderDynamicTable = () => {
     if (!historicalDataMatrix || Object.keys(historicalDataMatrix).length === 0) return null;

     // Extract first object to find year keys dynamically
     const firstItemKeys = Object.keys(Object.values(historicalDataMatrix)[0] || {});
     const yearKeys = firstItemKeys.filter(k => /^\d{4}$/.test(k)).sort();
     
     return (
        <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #e0e0e0", mt: 3 }}>
           <Table size="small">
              <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
                 <TableRow>
                    <TableCell sx={{ fontWeight: "bold" }}>Parameter</TableCell>
                    {yearKeys.map(year => (
                       <TableCell key={year} align="right" sx={{ fontWeight: "bold" }}>
                          {year}
                       </TableCell>
                    ))}
                 </TableRow>
              </TableHead>
              <TableBody>
                 {Object.entries(historicalDataMatrix).map(([key, itemData]) => (
                    <TableRow key={key} hover>
                       <TableCell component="th" scope="row">
                          {itemData.param_name || key}
                       </TableCell>
                       {yearKeys.map(year => {
                          const val = itemData[year];
                          // format number with commas if valid
                          const displayVal = (typeof val === 'number') 
                             ? val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                             : (val || "-");
                          return (
                             <TableCell key={year} align="right">
                                {displayVal}
                             </TableCell>
                          )
                       })}
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
        </TableContainer>
     );
  }

  return (
    <ThemeProvider theme={LinkedinAITheme}>
      <Box sx={{ width: "100%", p: 3, bgcolor: "#F5F6F8", minHeight: "100vh" }}>
        {/* Page Title */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500, color: "#333" }}>
            Historical AI Agent
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate and manage historical Level 3 financial statements using AI capabilities.
          </Typography>
        </Box>

        {/* Global Notifications */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

        {/* Main Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3, bgcolor: "white", borderRadius: 1 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": { textTransform: "none", fontWeight: 500, fontSize: "0.95rem" },
              "& .Mui-selected": { color: "#1976d2" },
            }}
          >
            <Tab label="Generation Dashboard" />
            <Tab label="Mapping Management" />
          </Tabs>
        </Box>

        {/* ========================================================= */}
        {/* TAB 0: Generation Dashboard */}
        {/* ========================================================= */}
        {activeTab === 0 && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Generate Historical Matrix
            </Typography>

            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Document Code</InputLabel>
                  <Select
                    value={selectedDocumentCode}
                    onChange={(e) => setSelectedDocumentCode(e.target.value)}
                    label="Document Code"
                    disabled={isFetchingMappings}
                  >
                    {documentCodes.map((code) => (
                      <MenuItem key={code} value={code}>
                        {code} - {mappings[code]?.full_name || "Unknown Document"}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                 <Typography variant="body2" color="text.secondary">
                    Targeting Client ID: <strong>{clientId || "None (Please Select)"}</strong>
                 </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="contained"
                  onClick={handleGenerate}
                  disabled={isGenerating || !selectedDocumentCode || !clientId}
                  fullWidth
                  sx={{ py: 1.2, fontWeight: "bold" }}
                >
                  {isGenerating ? <CircularProgress size={24} color="inherit" /> : "Run Agent"}
                </Button>
              </Grid>
            </Grid>

            {/* Agent Status Log */}
            {agentLogs && (
               <Box sx={{ mt: 3, p: 2, bgcolor: "#f8f9fa", borderLeft: "4px solid #1976d2", borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", color: "#424242" }}>
                     🤖 Agent: {agentLogs}
                  </Typography>
               </Box>
            )}

            {/* Matrix Result output */}
            {renderDynamicTable()}

          </Paper>
        )}

        {/* ========================================================= */}
        {/* TAB 1: Mapping Management */}
        {/* ========================================================= */}
        {activeTab === 1 && (
          <Grid container spacing={4}>
            {/* Left Col: Add New */}
            <Grid item xs={12} md={5}>
               <Paper elevation={0} sx={{ p: 4, borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                     Register New Document Mapping
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                     Instruct the AI Agent on what Firebase collections correspond to specific document codes during generation.
                  </Typography>

                  <Box component="form" noValidate autoComplete="off">
                     <TextField
                        fullWidth
                        size="small"
                        label="Code (e.g., S&M or IS-CON)"
                        name="code"
                        value={newMappingForm.code}
                        onChange={handleMappingInputChange}
                        sx={{ mb: 2 }}
                     />
                     <TextField
                        fullWidth
                        size="small"
                        label="Full Name (e.g., Selling & Promotion Expenses)"
                        name="full_name"
                        value={newMappingForm.full_name}
                        onChange={handleMappingInputChange}
                        sx={{ mb: 2 }}
                     />
                     <TextField
                        fullWidth
                        size="small"
                        label="Primary Table Bucket Name"
                        name="primary_bucket"
                        value={newMappingForm.primary_bucket}
                        onChange={handleMappingInputChange}
                        sx={{ mb: 2 }}
                     />
                     <TextField
                        fullWidth
                        size="small"
                        label="Notes Table Bucket Name"
                        name="note_bucket"
                        value={newMappingForm.note_bucket}
                        onChange={handleMappingInputChange}
                        sx={{ mb: 3 }}
                     />

                     <Button
                        variant="contained"
                        onClick={submitNewMapping}
                        disabled={isSavingMapping}
                        fullWidth
                        sx={{ py: 1.2 }}
                     >
                        {isSavingMapping ? <CircularProgress size={24} color="inherit" /> : "Save Mapping"}
                     </Button>
                  </Box>
               </Paper>
            </Grid>

            {/* Right Col: Active Mappings List */}
            <Grid item xs={12} md={7}>
               <Paper elevation={0} sx={{ p: 4, borderRadius: 2, height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                     Currently Active Mappings
                  </Typography>

                  {isFetchingMappings ? (
                     <CircularProgress />
                  ) : (
                     <TableContainer>
                        <Table size="small">
                           <TableHead>
                              <TableRow>
                                 <TableCell><strong>Code</strong></TableCell>
                                 <TableCell><strong>Full Name</strong></TableCell>
                                 <TableCell><strong>Primary Bucket</strong></TableCell>
                                 <TableCell><strong>Note Bucket</strong></TableCell>
                              </TableRow>
                           </TableHead>
                           <TableBody>
                              {documentCodes.map(code => {
                                 const item = mappings[code] || {}; // Some are default codes with no detailed mappings in dict currently
                                 return (
                                    <TableRow key={code} hover>
                                       <TableCell>{code}</TableCell>
                                       <TableCell>{item.full_name || "N/A"}</TableCell>
                                       <TableCell>{item.primary_bucket || "N/A"}</TableCell>
                                       <TableCell>{item.note_bucket || "N/A"}</TableCell>
                                    </TableRow>
                                 )
                              })}
                           </TableBody>
                        </Table>
                     </TableContainer>
                  )}
               </Paper>
            </Grid>
          </Grid>
        )}
      </Box>
    </ThemeProvider>
  );
};

export default HistoricalAIAgent;
