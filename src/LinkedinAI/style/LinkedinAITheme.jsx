// src/theme.js
import { createTheme } from "@mui/material/styles";

const LinkedinAITheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#FF5622" },
    text: { primary: "#000000" },
    background: { default: "transparent", paper: "rgba(255,255,255,0.8)" },
  },
  typography: {
    allVariants: {
      color: "#000000", // black for normal text
    },
    h1: { color: "#FF5622", fontWeight: 700 },
    h2: { color: "#FF5622", fontWeight: 700 },
    h3: { color: "#FF5622", fontWeight: 700 },
    h4: { color: "#FF5622", fontWeight: 700 },
    h5: { color: "#FF5622", fontWeight: 700 },
    h6: { color: "#FF5622", fontWeight: 700 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backdropFilter: "blur(8px)" } } },
  },
});

export default LinkedinAITheme;
