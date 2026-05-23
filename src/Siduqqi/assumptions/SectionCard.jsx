import React from "react";
import { Card, CardContent, Typography, Box, Alert } from "@mui/material";
import FieldRenderer from "./FieldRenderer";

// One assumption section, rendered as a card with a header and the recursive
// field renderer as its body.
export default function SectionCard({
  id,
  title,
  description,
  data,
  basePath,
  onFieldChange,
  classifyLineItem,
  moduleHint,
}) {
  const hasData = data !== null && data !== undefined;

  return (
    <Card
      id={id}
      variant="outlined"
      sx={{
        borderRadius: 2,
        scrollMarginTop: 96, // so anchor scroll lands below the sticky header
      }}
    >
      <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0A1E37", mb: 0.5 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
        )}
        <Box sx={{ mt: 2 }}>
          {hasData ? (
            <FieldRenderer
              value={data}
              path={basePath}
              parentKey={basePath.split(".").pop()}
              onFieldChange={onFieldChange}
              classifyLineItem={classifyLineItem}
              moduleHint={moduleHint}
            />
          ) : (
            <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
              Not configured for this client.
            </Alert>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
