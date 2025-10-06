// ImageDialog.js
import React, { useState } from "react";
import { Dialog, Icon, IconButton, Stack } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

const ImageDialog = ({ imageData }) => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      {/* This is the button that will trigger the dialog to open */}
      <IconButton onClick={handleOpen}>
        <Icon sx={{ color: "primary.main", m: 2 }}>visibility_icon</Icon>
      </IconButton>

      <Dialog open={open} onClose={handleClose} maxWidth="md">
        <Stack
          direction="row"
          justifyContent="flex-end"
          sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
        >
          <IconButton onClick={handleClose}>
            <Icon sx={{ color: "black", m: 2 }}>close_icon</Icon>
          </IconButton>
        </Stack>
        {imageData && (
          <img
            src={`data:image/png;base64,${imageData}`}
            alt="Table from original document page"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        )}
      </Dialog>
    </>
  );
};

export default ImageDialog;
