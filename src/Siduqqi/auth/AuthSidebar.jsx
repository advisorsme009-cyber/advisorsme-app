// AuthSidebar.jsx
import React from "react";
import { Box, Grid } from "@mui/material";
// Adjust this import path if your file structure is different
import logoImg from "/src/assets/images/logo_alone.png"; 

const AuthSidebar = () => {
  return (
    <Grid
      item
      xs={12}
      md={5}
      sx={{
        // The Blue Gradient Background
        background: `linear-gradient(135deg, #0A1E37 0%, #12325B 50%, #1F559B 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        // Ensure it takes full height on desktop, but has a minimum height on mobile
        minHeight: { xs: "300px", md: "100vh" } 
      }}
    >
      {/* Optional: Geometric overlay texture */}
      <Box
        sx={{
          position: "absolute",
          width: "100%",
          height: "100%",
          opacity: 0.05,
          backgroundSize: "60px 60px",
          backgroundPosition: "0 0, 30px 30px",
        }}
      />

      {/* Logo Container */}
      <Box
        sx={{
          width: 140,
          height: 140,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <img
          src={logoImg}
          alt="Advisors M.E."
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </Box>
    </Grid>
  );
};

export default AuthSidebar;