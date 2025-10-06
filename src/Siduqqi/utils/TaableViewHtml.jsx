import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  TextField,
  CircularProgress,
  Divider,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Book as BookIcon,
  AutoFixHigh as AutoFixHighIcon,
} from "@mui/icons-material";

/**
 * Standalone component to render and manage an array of tables.
 * Props:
 * - tables: Array of table objects { id, name, htmlContent, sourceFile }.
 */
const TablesUI = ({ tables }) => {
  const [localTables, setLocalTables] = useState([]);
  const [fixPrompts, setFixPrompts] = useState({});
  const [fixingTableId, setFixingTableId] = useState(null);

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

  // Sync local state when `tables` prop changes
  useEffect(() => {
    setLocalTables(tables);
  }, [tables]);

  const handleTableNameChange = (id, newName) => {
    setLocalTables((prev) =>
      prev.map((tbl) => (tbl.id === id ? { ...tbl, name: newName } : tbl))
    );
  };

  const handleRemoveTable = (id) => {
    setLocalTables((prev) => prev.filter((tbl) => tbl.id !== id));
  };

  const handlePromptChange = (id, value) => {
    setFixPrompts((prev) => ({ ...prev, [id]: value }));
  };

  const handleFixTableWithAI = async (id) => {
    const userPrompt = fixPrompts[id];
    const table = localTables.find((t) => t.id === id);
    if (!userPrompt?.trim()) return;

    setFixingTableId(id);
    try {
      // Call your AI fix API here (e.g. Gemini or other)
      const corrected = await fixTableAPI(table.htmlContent, userPrompt);
      setLocalTables((prev) =>
        prev.map((t) => (t.id === id ? { ...t, htmlContent: corrected } : t))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setFixingTableId(null);
    }
  };

  const handleExportingTable = () => {
    // Implement logic to join or export tables as needed
    console.log(localTables);
  };

  return (
    <Box>
      <Stack spacing={3}>
        {localTables.map((tbl) => (
          <Paper key={tbl.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            {/* Name & Remove */}
            <Typography color="black" variant="h5" marginBottom={3}>
              {tbl.id}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
              <TextField
                label="Table Name"
                size="small"
                value={tbl.title_english}
                onChange={(e) => handleTableNameChange(tbl.id, e.target.value)}
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

            {/* Table Content */}

            <Typography color="black" variant="h6" marginBottom={3}>
              English Table
            </Typography>
            <Box
              sx={{
                mt: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                maxHeight: 400,
                overflow: "auto",
                "& table": { width: "100%", borderCollapse: "collapse" },
                "& th, & td": {
                  border: "1px solid",
                  borderColor: "divider",
                  color: "black",
                  px: 1,
                  py: 0.5,
                },
                "& th": {
                  color: "primary.main",
                  fontWeight: "bold",
                  backgroundColor: "background.paper",
                },
              }}
              dangerouslySetInnerHTML={{
                __html: styleHtmlContent(tbl.table_english),
              }}
            />
            <Divider sx={{ m: 5 }} />
            <Typography color="black" variant="h6" marginBottom={3}>
              Arabic Table
            </Typography>
            <Box
              sx={{
                mt: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                maxHeight: 400,
                overflow: "auto",
                "& table": { width: "100%", borderCollapse: "collapse" },
                "& th, & td": {
                  border: "1px solid",
                  borderColor: "divider",
                  color: "black",
                  px: 1,
                  py: 0.5,
                },
                "& th": {
                  color: "primary.main",
                  fontWeight: "bold",
                  backgroundColor: "background.paper",
                },
              }}
              dangerouslySetInnerHTML={{
                __html: styleHtmlContent(tbl.table_arabic),
              }}
            />

            {/* AI Fix Section */}
            {/* <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth
                  size="small"
                  label="Describe how to fix the table"
                  value={fixPrompts[tbl.id] || ""}
                  onChange={(e) => handlePromptChange(tbl.id, e.target.value)}
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
                  {fixingTableId === tbl.id ? "Fixing..." : "Fix Table"}
                </Button>
              </Stack>
            </Box> */}
            <Button
              variant="contained"
              size="large"
              startIcon={<BookIcon />}
              onClick={handleExportingTable}
              sx={{ mt: 3, width: "100%" }}
            >
              Export Tables
            </Button>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

export default TablesUI;
