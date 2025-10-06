import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx"; // Assuming App.jsx is the file containing PricingTraining
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

// 1. Create the Emotion cache instance
// This is critical for Material UI to inject its styles correctly into the DOM.
// `prepend: true` helps ensure MUI styles are inserted first, giving your custom styles
// an easier time overriding them if needed.
const muiCache = createCache({
  key: "mui",
  prepend: true,
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* 2. Wrap the entire application with CacheProvider */}
    <CacheProvider value={muiCache}>
      <App />
    </CacheProvider>
  </StrictMode>
);
