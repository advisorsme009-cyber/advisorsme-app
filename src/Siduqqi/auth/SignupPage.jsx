// SignupPage.jsx
import React, { useState } from "react";
import {
  Box,
  Button,
  Grid,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Import the reusable sidebar
import AuthSidebar from "./AuthSidebar";

const COLORS = {
  primaryBlue: "#153a73",
  inputBg: "#f8f9fb",
  textDark: "#153a73",
  textGrey: "#6c757d",
};

const SignupPage = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async () => {
    setError("");

    // Validation
    if (!email || !username || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 3) {
      setError("Password must be at least 3 characters long");
      return;
    }

    setLoading(true);
    try {
      await signup({ email, password, username });
      // After successful signup, redirect to login page
      navigate("/auth", { state: { message: "Account created successfully! Please sign in." } });
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  return (
    <Grid container sx={{ minHeight: "100vh" }}>
      {/* 1. Reusable Left Side Component */}
      <AuthSidebar />

      {/* 2. Right Side Signup Form */}
      <Grid
        item
        xs={12}
        md={7}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "white",
          px: 4,
          py: 4,
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 450 }}>
          {/* Header Section */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: COLORS.textDark,
                mb: 1,
                fontSize: { xs: "1.5rem", md: "1.75rem" },
              }}
            >
              Create Your Account
            </Typography>
            <Typography variant="body2" sx={{ color: COLORS.textGrey }}>
              Join Advisors M.E. and get started today
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Form Inputs */}
          <Box component="form" noValidate>
            <TextField
              fullWidth
              placeholder="Email"
              variant="outlined"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{
                mb: 2.5,
                "& .MuiOutlinedInput-root": {
                  backgroundColor: COLORS.inputBg,
                  borderRadius: "8px",
                  "& fieldset": { borderColor: "#e0e0e0" },
                  "&:hover fieldset": { borderColor: "#b0b0b0" },
                  "&.Mui-focused fieldset": { borderColor: COLORS.primaryBlue },
                },
                "& input": { py: 1.5 },
              }}
            />

            <TextField
              fullWidth
              placeholder="Username"
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{
                mb: 2.5,
                "& .MuiOutlinedInput-root": {
                  backgroundColor: COLORS.inputBg,
                  borderRadius: "8px",
                  "& fieldset": { borderColor: "#e0e0e0" },
                  "&:hover fieldset": { borderColor: "#b0b0b0" },
                  "&.Mui-focused fieldset": { borderColor: COLORS.primaryBlue },
                },
                "& input": { py: 1.5 },
              }}
            />

            <TextField
              fullWidth
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              variant="outlined"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={togglePasswordVisibility}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 2.5,
                "& .MuiOutlinedInput-root": {
                  backgroundColor: COLORS.inputBg,
                  borderRadius: "8px",
                  "& fieldset": { borderColor: "#e0e0e0" },
                  "&:hover fieldset": { borderColor: "#b0b0b0" },
                  "&.Mui-focused fieldset": { borderColor: COLORS.primaryBlue },
                },
                "& input": { py: 1.5 },
              }}
            />

            <TextField
              fullWidth
              placeholder="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              variant="outlined"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={toggleConfirmPasswordVisibility}
                      edge="end"
                      size="small"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 4,
                "& .MuiOutlinedInput-root": {
                  backgroundColor: COLORS.inputBg,
                  borderRadius: "8px",
                  "& fieldset": { borderColor: "#e0e0e0" },
                  "&:hover fieldset": { borderColor: "#b0b0b0" },
                  "&.Mui-focused fieldset": { borderColor: COLORS.primaryBlue },
                },
                "& input": { py: 1.5 },
              }}
            />

            {/* Submit Button */}
            <Button
              variant="contained"
              fullWidth
              disabled={loading || !email || !username || !password || !confirmPassword}
              onClick={handleSignup}
              sx={{
                bgcolor: COLORS.primaryBlue,
                py: 1.5,
                textTransform: "none",
                fontSize: "1rem",
                borderRadius: "8px",
                boxShadow: "none",
                mb: 2,
                "&:hover": {
                  bgcolor: "#102d5e",
                  boxShadow: "none",
                },
              }}
            >
              {loading ? "Creating Account..." : "Sign Up"}
            </Button>

            {/* Link to Login */}
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: COLORS.textGrey }}>
                Already have an account?{" "}
                <Link
                  component="button"
                  variant="body2"
                  underline="none"
                  onClick={() => navigate("/auth")}
                  sx={{ color: COLORS.primaryBlue, fontWeight: 500 }}
                >
                  Sign In
                </Link>
              </Typography>
            </Box>
          </Box>
        </Box>
      </Grid>
    </Grid>
  );
};

export default SignupPage;
