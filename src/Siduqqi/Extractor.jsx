import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  TextField,
  Stack,
  Paper,
  Divider,
} from "@mui/material";
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Article as ArticleIcon,
  CheckCircle as CheckCircleIcon,
  Book as BookIcon,
  TableChart as TableChartIcon,
  AutoFixHigh as AutoFixHighIcon,
  TableView,
} from "@mui/icons-material";
import PdfPreviewGrid from "./utils/PdfGrid";
import TablesUI from "./utils/TableView";
import { ExpandableMessageCard } from "./utils/ThinkingComponnet";
import ExcelDownloadButton from "./utils/ExportingTables";
import { apiUrl } from "./hooks/api";

const TableExtractor = () => {
  const [file, setFile] = useState(null);
  const [streamMessages, setStreamMessages] = useState([]);
  const [tables, setTables] = useState([]);
  const [isLoading, setLoading] = useState(false);
  const [pages, setPages] = useState([]);
  const [usage, setUsage] = useState(0);
  const [processed, setProcessed] = useState(1);
  const [clientId, setClientId] = useState("pwc-test-123456");
  const [statementYear, setStatementYear] = useState("2019");

  // Handle file input change & split into pages
  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
  };

  const extractTablesBatch = async () => {
    if (pages.length === 0) return;
    setTables([]); // Clear previous tables
    setStreamMessages([]); // Clear previous messages

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      await extractTables(p);
      setProcessed((prev) => prev + 1);
    }
  };

  const extractTables = async (page) => {
    const bodyParam = JSON.stringify({
      base64_image: `${page.image}`,
      page_number: page.page_number,
      client_id: clientId,
      statement_year: statementYear,
    });
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/extract-tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyParam,
      });

      if (!response.ok) throw new Error(response.statusText);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "",
        done = false;
      const marker = "--JSON--";
      let found = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value);
        buffer += chunk + "\n";
        if (buffer.includes(marker)) {
          found = true;
        }
        if (!found) setStreamMessages((m) => [...m, chunk]);
      }

      if (found) {
        const idx = buffer.indexOf(marker) + marker.length;
        const jsonText = buffer.slice(idx).trim();
        const data = JSON.parse(jsonText);
        setUsage((prevUsage) => prevUsage + data.usage.total_cost);
        if (data?.tables) {
          setTables((prevTables) => [...prevTables, ...data.tables]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Check if all pages are processed
  useEffect(() => {
    if (isLoading && pages.length > 0 && tables.length === pages.length) {
      setLoading(false);
    }
  }, [tables.length, pages.length, isLoading]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        p: 3,
        bgcolor: "grey.100",
      }}
    >
      {/* Floating Progress UI */}
      {isLoading && (
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            borderRadius: "50px",
            p: 2,
            boxShadow: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 150,
            transition: "transform 0.3s ease-in-out",
            transform: "scale(1)",
            "&:hover": {
              transform: "scale(1.05)",
            },
          }}
        >
          <CircularProgress size={24} color="inherit" sx={{ mr: 2 }} />
          <Typography margin={2} variant="body1" fontWeight="bold">
            Pages parsing {processed}/{pages.length}
          </Typography>
        </Box>
      )}

      <Card
        sx={{
          maxWidth: 999,
          width: "100%",
          boxShadow: 6,
          borderRadius: 3,
          p: 2,
        }}
      >
        <CardContent>
          {/* Uploader */}
          <Box mb={4}>
            <Typography
              color="black"
              variant="h5"
              fontWeight="bold"
              gutterBottom
            >
              Add Client
            </Typography>
            <TextField
              fullWidth
              label="Client ID"
              variant="outlined"
              size="small"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Statement Year"
              variant="outlined"
              size="small"
              value={statementYear}
              onChange={(e) => setStatementYear(e.target.value)}
              sx={{ mb: 3 }}
            />

            <Typography
              color="black"
              variant="h5"
              fontWeight="bold"
              gutterBottom
            >
              Upload Financial Statement
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Select one PDF document containing financial data
            </Typography>
            <Box
              textAlign="center"
              p={3}
              sx={{
                border: "2px dashed",
                borderColor: "grey.400",
                borderRadius: 2,
                bgcolor: "grey.50",
                mb: 3,
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
                  Select PDF
                </Button>
              </label>
            </Box>
          </Box>

          {/* Pdf Viewer */}
          <Box>
            {file && tables.length === 0 && (
              <PdfPreviewGrid file={file} pages={pages} setPages={setPages} />
            )}
          </Box>
          {/* Extract Tables button */}
          {tables.length === 0 && (
            <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
              <Button
                variant="contained"
                onClick={extractTablesBatch}
                disabled={isLoading || !file}
                sx={{
                  borderRadius: "50px",
                  px: 4,
                  py: 1.5,
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  minWidth: 200,
                }}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Extract Tables"
                )}
              </Button>
            </Box>
          )}

          {/* Stream thinking */}
          {streamMessages.length > 0 && (
            <ExpandableMessageCard
              msg={streamMessages}
              isThinking={isLoading}
              title="Extracting Tables..."
            />
          )}

          {usage !== 0 && (
            <Typography color="black" variant="h5" m={3} textAlign="center">
              Total Cost: ${usage.toFixed(4)}
            </Typography>
          )}

          {/* Render extracted tables */}
          {tables.length > 0 && <TablesUI tables={tables} pages={pages} />}
        </CardContent>
      </Card>
      {tables.length > 0 && !isLoading && (
        <Box sx={{ my: 4, display: "flex", justifyContent: "center" }}>
          <ExcelDownloadButton jsonData={tables} />
        </Box>
      )}
    </Box>
  );
};

export default TableExtractor;
