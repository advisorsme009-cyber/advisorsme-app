import React, { useState } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  List,
  ListItem,
  IconButton,
  TextField,
  CircularProgress,
  Snackbar,
  Alert,
  Chip,
  Stack,
  Divider,
  Container,
  ThemeProvider,
  CssBaseline,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Article as ArticleIcon,
  CheckCircle as CheckCircleIcon,
  Book as BookIcon,
  TableChart as TableChartIcon,
  AutoFixHigh as AutoFixHighIcon,
} from "@mui/icons-material";
import { createTheme } from "@mui/material/styles";

// --- Helper function to add basic styling to the extracted HTML tables ---
const styleHtmlContent = (htmlString) => {
  const style = `
    <style>
      table { 
        border-collapse: collapse; 
        width: 100%; 
        margin-bottom: 1rem; 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 0.9rem;
      }
      th, td { 
        border: 1px solid #ddd; 
        padding: 8px; 
        text-align: left; 
      }
      th { 
        background-color: #f2f2f2; 
        font-weight: bold;
      }
      tr:nth-child(even) { 
        background-color: #f9f9f9; 
      }
    </style>
  `;
  // Simple cleanup to remove potential markdown backticks from AI response
  const cleanedHtml = htmlString.replace(/```html|```/g, "").trim();
  return style + cleanedHtml;
};

const FinancialStatementUploaderAgentic = () => {
  // --- NEW --- Add your Gemini API Key here for testing
  // ⚠️ IMPORTANT: Do NOT expose this key in a public application.
  const GEMINI_API_KEY = "";

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [extractedTables, setExtractedTables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [fixPrompts, setFixPrompts] = useState({});
  const [fixingTableId, setFixingTableId] = useState(null);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    const uniqueNew = newFiles.filter(
      (f) => !selectedFiles.some((sf) => sf.name === f.name)
    );
    setSelectedFiles((prev) => [...prev, ...uniqueNew]);
    e.target.value = null;
  };

  const handleRemoveFile = (name) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const openSnackbar = (msg, sev = "success") => {
    setSnackbar({ open: true, message: msg, severity: sev });
  };

  const closeSnackbar = (_, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleExtractTables = async () => {
    // This function remains the same
    if (!selectedFiles.length) {
      openSnackbar("Please select at least one PDF file.", "warning");
      return;
    }
    setIsLoading(true);
    setExtractedTables([]);
    let allTables = [];
    let counter = 1;
    const API_KEY =
      "cDRjNmh5am55NDZhb2k4YXpucjFqOmF0TnRxYXlyZ2JMWVdyWXJTSDBLczJjZnBlS0JTckd5";

    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("include_marginalia", "false");
      formData.append("include_metadata_in_markdown", "true");
      formData.append(
        "fields_schema",
        JSON.stringify({
          type: "object",
          properties: {
            field1: { type: "string" },
            field2: { type: "string" },
          },
          required: ["field1", "field2"],
        })
      );

      try {
        const res = await fetch("/api/v1/tools/agentic-document-analysis", {
          method: "POST",
          headers: { Authorization: `Basic ${API_KEY}` },
          body: formData,
        });
        const result = await res.json();
        if (!res.ok || (result.errors && result.errors.length)) {
          throw new Error(
            result.extraction_error ||
              result.errors?.[0]?.error ||
              `Failed: ${file.name}`
          );
        }
        const tables = result.data.chunks
          .filter((c) => c.chunk_type === "table")
          .map((c) => ({
            id: c.chunk_id,
            name: `Table ${counter++}`,
            htmlContent: c.text,
            sourceFile: file.name,
          }));
        allTables = allTables.concat(tables);
      } catch (err) {
        openSnackbar(`Error with ${file.name}: ${err.message}`, "error");
        setIsLoading(false);
        return;
      }
    }
    setExtractedTables(allTables);
    openSnackbar(
      allTables.length
        ? `Extracted ${allTables.length} tables!`
        : "No tables found.",
      allTables.length ? "success" : "info"
    );
    setSelectedFiles([]);
    setIsLoading(false);
  };

  const handleTableNameChange = (id, name) => {
    setExtractedTables((prev) =>
      prev.map((tbl) => (tbl.id === id ? { ...tbl, name } : tbl))
    );
  };

  const handleRemoveTable = (id) => {
    setExtractedTables((prev) => prev.filter((tbl) => tbl.id !== id));
    openSnackbar("Table removed.", "info");
  };

  const handlePromptChange = (tableId, value) => {
    setFixPrompts((prev) => ({ ...prev, [tableId]: value }));
  };

  // --- UPDATED --- Function to call Gemini API directly
  const handleFixTableWithAI = async (tableId) => {
    const tableToFix = extractedTables.find((t) => t.id === tableId);
    const userPrompt = fixPrompts[tableId];

    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
      openSnackbar("Please add your Gemini API key to the code.", "error");
      return;
    }
    if (!userPrompt || !userPrompt.trim()) {
      openSnackbar("Please describe what you want to fix.", "warning");
      return;
    }

    setFixingTableId(tableId);

    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

    // The prompt sent to the AI, instructing it to only return HTML
    const fullPrompt = `
      You are an expert in correcting HTML tables. A user has provided an HTML table and an instruction to fix it.
      Your task is to return ONLY the raw, corrected HTML code for the <table> element and nothing else.
      Do not include markdown language identifiers like \`\`\`html, explanations, or any other text outside of the corrected table HTML.

      Instruction: "${userPrompt}"

      Original HTML Table:
      ${tableToFix.htmlContent}
    `;

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: fullPrompt }],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "API request failed");
      }

      const data = await response.json();

      // Extract the text from the API response
      const fixedHtml = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!fixedHtml) {
        throw new Error(
          "Could not parse the corrected table from the AI response."
        );
      }

      // Update the state for only the table that was fixed
      setExtractedTables((prev) =>
        prev.map((tbl) =>
          tbl.id === tableId ? { ...tbl, htmlContent: fixedHtml } : tbl
        )
      );
      openSnackbar(
        `Table "${tableToFix.name}" was updated with AI.`,
        "success"
      );
    } catch (err) {
      console.error("Gemini API Error:", err);
      openSnackbar(`Error fixing table: ${err.message}`, "error");
    } finally {
      setFixingTableId(null); // Reset loading state regardless of outcome
    }
  };

  const handleCreateDatabook = () => {
    // This function remains the same
    if (!extractedTables.length) {
      openSnackbar("No tables to create databook.", "warning");
      return;
    }
    const htmlParts = extractedTables
      .map((tbl) => {
        const safeName = tbl.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `
        <div style="page-break-after: always; padding: 20px; border-bottom: 2px solid #ccc;">
          <h2 style="font-family: sans-serif; color: #333;">${safeName}</h2>
          ${styleHtmlContent(tbl.htmlContent)}
        </div>`;
      })
      .join("");

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Financial Databook</title>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; }
          .container { max-width: 900px; margin: 20px auto; background-color: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
          @media print { .container { box-shadow: none; margin: 0; } div { page-break-after: always; } }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 style="text-align:center; padding:20px; background-color:#4CAF50; color:white;">
            Financial Databook
          </h1>
          ${htmlParts}
        </div>
      </body>
      </html>`;

    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    URL.revokeObjectURL(url);
  };

  const theme = createTheme({
    // Theme remains the same
    palette: {
      text: { primary: "#000000", secondary: "#000000" },
      primary: { main: "#FFA500" },
    },
    components: {
      MuiTypography: {
        defaultProps: { color: "text.primary" },
        variants: [
          { props: { variant: "h1" }, style: { color: "#FFA500" } },
          { props: { variant: "h2" }, style: { color: "#FFA500" } },
          { props: { variant: "h3" }, style: { color: "#FFA500" } },
          { props: { variant: "h4" }, style: { color: "#FFA500" } },
          { props: { variant: "h5" }, style: { color: "#FFA500" } },
          { props: { variant: "h6" }, style: { color: "#FFA500" } },
        ],
      },
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ my: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Stack spacing={4}>
            {/* --- UI Sections below are the same as before --- */}

            {/* Uploader */}
            <Box>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Upload Financial Statement
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Select one or more PDF documents containing financial data
              </Typography>
              <Box
                textAlign="center"
                p={3}
                sx={{
                  border: "2px dashed",
                  borderColor: "grey.400",
                  borderRadius: 2,
                  bgcolor: "grey.50",
                }}
              >
                <input
                  id="file-upload-input"
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  disabled={isLoading}
                />
                <label htmlFor="file-upload-input">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<CloudUploadIcon />}
                    disabled={isLoading}
                  >
                    Select PDFs
                  </Button>
                </label>
              </Box>
            </Box>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Selected Files ({selectedFiles.length})
                </Typography>
                <List>
                  {selectedFiles.map((file, i) => (
                    <ListItem
                      key={i}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleRemoveFile(file.name)}
                          disabled={isLoading}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                      sx={{ bgcolor: "action.hover", borderRadius: 1, mb: 1 }}
                    >
                      <Chip
                        icon={<ArticleIcon />}
                        label={file.name}
                        color="primary"
                      />
                    </ListItem>
                  ))}
                </List>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={
                    isLoading ? (
                      <CircularProgress color="inherit" size={24} />
                    ) : (
                      <TableChartIcon />
                    )
                  }
                  onClick={handleExtractTables}
                  disabled={isLoading || !selectedFiles.length}
                  sx={{ mt: 2, width: "100%" }}
                >
                  {isLoading ? "Extracting..." : "Extract Tables"}
                </Button>
              </Box>
            )}

            {/* Extracted Tables */}
            {extractedTables.length > 0 && (
              <Box>
                <Divider sx={{ my: 4 }}>
                  <Typography variant="h6">Extracted Tables</Typography>
                </Divider>
                <Stack spacing={3}>
                  {extractedTables.map((tbl) => (
                    <Paper
                      key={tbl.id}
                      variant="outlined"
                      sx={{ p: 2, borderRadius: 2 }}
                    >
                      <Stack
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        mb={2}
                      >
                        <TextField
                          label="Table Name"
                          size="small"
                          value={tbl.name}
                          onChange={(e) =>
                            handleTableNameChange(tbl.id, e.target.value)
                          }
                          sx={{ flexGrow: 1 }}
                        />
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleRemoveTable(tbl.id)}
                        >
                          Remove Table
                        </Button>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Source: {tbl.sourceFile}
                      </Typography>
                      <Box
                        sx={{
                          mt: 1,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          maxHeight: 400,
                          overflow: "auto",
                          "& table": {
                            width: "100%",
                            borderCollapse: "collapse",
                          },
                          "& th, & td": {
                            border: "1px solid",
                            borderColor: "divider",
                            px: 1,
                            py: 0.5,
                            color: "text.primary",
                          },
                          "& th": {
                            color: "primary.main",
                            fontWeight: "bold",
                            backgroundColor: "background.paper",
                          },
                          "& strong": {
                            fontWeight: "bold",
                            color: "primary.main",
                          },
                          "& u": {
                            textDecoration: "underline",
                            color: "text.primary",
                            fontStyle: "italic",
                          },
                          "& ins": {
                            textDecoration: "underline",
                            color: "primary.main",
                            backgroundColor: "background.paper",
                          },
                        }}
                        dangerouslySetInnerHTML={{
                          __html: styleHtmlContent(tbl.htmlContent),
                        }}
                      />
                      {/* AI Fix Section */}
                      <Box
                        sx={{
                          mt: 2,
                          pt: 2,
                          borderTop: 1,
                          borderColor: "divider",
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TextField
                            fullWidth
                            label="Describe how to fix the table with AI"
                            variant="outlined"
                            size="small"
                            value={fixPrompts[tbl.id] || ""}
                            onChange={(e) =>
                              handlePromptChange(tbl.id, e.target.value)
                            }
                            disabled={fixingTableId !== null}
                          />
                          <Button
                            variant="contained"
                            onClick={() => handleFixTableWithAI(tbl.id)}
                            disabled={fixingTableId !== null}
                            startIcon={
                              fixingTableId === tbl.id ? (
                                <CircularProgress color="inherit" size={20} />
                              ) : (
                                <AutoFixHighIcon />
                              )
                            }
                            sx={{ minWidth: "120px" }}
                          >
                            {fixingTableId === tbl.id
                              ? "Fixing..."
                              : "Fix Table"}
                          </Button>
                        </Stack>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<BookIcon />}
                  onClick={handleCreateDatabook}
                  sx={{ mt: 3, width: "100%" }}
                >
                  Join Tables
                </Button>
              </Box>
            )}

            {/* Ready State */}
            {!selectedFiles.length && !extractedTables.length && !isLoading && (
              <Box
                textAlign="center"
                p={3}
                sx={{
                  border: "2px dashed",
                  borderColor: "grey.300",
                  borderRadius: 2,
                  bgcolor: "grey.50",
                }}
              >
                <CheckCircleIcon
                  color="disabled"
                  sx={{ fontSize: 40, mb: 1 }}
                />
                <Typography variant="h6" color="text.secondary">
                  Ready to Start
                </Typography>
                <Typography color="text.secondary">
                  Your extracted tables will appear here.
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={closeSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={closeSnackbar}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
};

export default FinancialStatementUploaderAgentic;
