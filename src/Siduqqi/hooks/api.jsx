const isLive = false;
const isAdvisors = true;
export const apiUrl = isLive
  ? isAdvisors
    ? "https://advisorsme-api.onrender.com"
    : "https://whilelearn.onrender.com"
  : "http://127.0.0.1:8000";
