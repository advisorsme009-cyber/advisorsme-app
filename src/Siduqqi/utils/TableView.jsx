/* eslint-disable react/prop-types */
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
  IconButton,
  Tooltip,
  Icon,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Book as BookIcon,
  AutoFixHigh as AutoFixHighIcon,
  Visibility as VisibilityIcon,
  ContentCopy as ContentCopyIcon, // 1. Import the copy icon
  Close as CloseIcon,
} from "@mui/icons-material";
import ImageDialog from "./ZoomDialog";
import CsvViewer from "./CsvViewer";

const TablesUI = ({ tables, pages }) => {
  const [localTables, setLocalTables] = useState([]);
  const [fixPrompts, setFixPrompts] = useState({});
  const [fixingTableId, setFixingTableId] = useState(null);

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

  const handleCopyTable = (textToCopy) => {
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        // You could add a temporary state here to show a "Copied!" message
        console.log("Table copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy table: ", err);
      });
  };

  const handleFixTableWithAI = async (tbl) => {
    const userPrompt = fixPrompts[tbl.id];
    if (!userPrompt?.trim()) return;
    setFixingTableId(tbl.id);
    console.log(localTables);
    return;

    try {
      const bodyParam = JSON.stringify({
        prompt: userPrompt,
        base64_image: `${pages[tbl.page_number]}`,
      });
      const response = await fetch("http://127.0.0.1:8000/fix-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyParam,
        wrong_table: tbl.table_english,
      });

      if (!response.ok) throw new Error(response.statusText);
      const corrected = await response.json();

      console.log(corrected);

      setLocalTables((prev) =>
        prev.map((t) =>
          t.id === tbl ? { ...t, table_english: corrected.table_english } : t
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setFixingTableId(null);
    }
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen font-sans">
      <script src="https://cdn.tailwindcss.com"></script>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>
        {`
          body { font-family: 'Inter', sans-serif; }
        `}
      </style>
      <Box className="max-w-4xl mx-auto mt-8">
        <Stack spacing={6}>
          {localTables.map((tbl) => (
            <Paper
              key={tbl.id}
              elevation={3}
              className="p-6 rounded-lg shadow-lg bg-white"
            >
              <Stack
                bgcolor={tbl.has_error ? "red" : ""}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography margin={2} color="black" variant="h5">
                  {tbl.id}
                </Typography>
                {/* The Eye and Copy Icon Buttons */}
                <Stack direction="row" spacing={1}>
                  {pages.length !== 0 && (
                    <ImageDialog imageData={pages[tbl.page_number]} />
                  )}
                  {/* Copy Icon Button */}
                  <Tooltip title="Copy Table">
                    <IconButton
                      onClick={() => handleCopyTable(tbl.table_english)}
                      aria-label="copy table"
                    >
                      <Icon sx={{ color: "primary.main", m: 2 }}>
                        content_copy_icon
                      </Icon>
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              {/* Name & Remove */}
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
                sx={{ m: 3 }}
              >
                <TextField
                  label="Table Name"
                  size="small"
                  value={tbl.title_english}
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
              {/* English Table Content */}
              <Typography margin={3} color="orange" variant="h6">
                Financial Bucket: {tbl.financial_bucket}
              </Typography>
              <Typography color="black" variant="h6" sx={{ m: 3 }}>
                page number: {tbl.page_number}
              </Typography>

              <Box sx={{ m: 3 }}>
                <CsvViewer csvString={tbl.table_english} />;
              </Box>

              <Divider className="my-8 border-gray-300" />
            </Paper>
          ))}
        </Stack>
      </Box>
    </div>
  );
};

export default TablesUI;
