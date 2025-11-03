import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

const AuthPage = () => {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup, loginWithEmail, loginBypass } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const handleSignup = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await signup({ email, password, username });
      if (res?.id) {
        await loginWithEmail(email, password);
        navigate(from, { replace: true });
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleBypass = async () => {
    setError("");
    setLoading(true);
    try {
      await loginBypass(clientId);
      navigate(from, { replace: true });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Card
        sx={{ width: 480, maxWidth: "100%", borderRadius: 3, boxShadow: 8 }}
      >
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Sign in to Advisors M.E.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Login" />
            <Tab label="Sign up" />
          </Tabs>

          {tab === 0 && (
            <Box>
              <TextField
                label="Email"
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                variant="contained"
                fullWidth
                disabled={loading || !email || !password}
                onClick={async () => {
                  setError("");
                  setLoading(true);
                  try {
                    await loginWithEmail(email, password);
                    navigate(from, { replace: true });
                  } catch (e) {
                    setError(String(e.message || e));
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading ? "Signing in..." : "Login"}
              </Button>
              {/* <Button
                variant="text"
                fullWidth
                sx={{ mt: 1 }}
                onClick={handleBypass}
              >
                Testing: Bypass with static client_id
              </Button> */}
            </Box>
          )}

          {tab === 1 && (
            <Box>
              <TextField
                label="Email"
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Username"
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                variant="contained"
                fullWidth
                disabled={loading || !email || !password || !username}
                onClick={handleSignup}
              >
                {loading ? "Creating account..." : "Sign up"}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default AuthPage;
