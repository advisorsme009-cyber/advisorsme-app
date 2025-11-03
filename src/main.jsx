import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx"; // Assuming App.jsx is the file containing PricingTraining
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
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
