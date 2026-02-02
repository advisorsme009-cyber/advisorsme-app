import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  ThemeProvider,
  createTheme,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Avatar,
  Stack,
} from "@mui/material";
import {
  Home as HomeIcon,
  UploadFile as UploadFileIcon,
  Description as DescriptionIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Calculate as CalculateIcon,
  Insights as InsightsIcon,
  SettingsOutlined,
  UnfoldMore,
} from "@mui/icons-material";
import { useAuth } from "./auth/AuthContext";
import AdminPanel from "./admin/AdminPanel";
import { dashboardItems } from "./dashboardConfig";
import logoImage from "../assets/images/logo_with_words.png";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    text: {
      primary: "#000000",
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
      color: "#1976d2",
    },
    body1: {
      color: "#000000",
    },
  },
});

const drawerWidth = 280;

// Gradient sidebar colors
const sidebarColors = {
  background: "linear-gradient(to bottom, #0A1E37, #12325B, #1F559B)",
  text: "#ffffff",
  textActive: "#ffffff",
  icon: "#ffffff",
  white: "#ffffff",
  divider: "rgba(255, 255, 255, 0.1)",
};

// Modern Dashboard Tile Component
const Tile = ({ title, description, IconCmp, color, onClick }) => {
  const IconComponent = IconCmp;
  return (
    <Card
      elevation={4}
      sx={{
        height: "100%",
        borderRadius: 3,
        overflow: "hidden",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": { transform: "translateY(-4px)", boxShadow: 10 },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
            <Avatar sx={{ bgcolor: color, width: 40, height: 40 }}>
              <IconComponent sx={{ color: "#fff" }} />
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {description}
          </Typography>
          <Chip
            label="Open"
            size="small"
            sx={{ bgcolor: `${color}1A`, color: color, fontWeight: 600 }}
          />
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

// Home Dashboard View
const HomeDashboard = () => {
  const navigate = useNavigate();
  const visibleItems = dashboardItems.filter((i) => i.show);
  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: "primary.main" }}
        >
          Welcome back
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Choose a module to get started
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {visibleItems.map((item) => (
          <Grid key={item.key} item xs={12} sm={6} md={4} lg={3}>
            <Tile
              title={item.title}
              description={item.description}
              IconCmp={item.icon}
              color={item.color}
              onClick={() => navigate(item.path)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// Main Dashboard Component
function Dashboard({ children }) {
  const [adminOpen, setAdminOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const menuItems = dashboardItems.filter((i) => i.show);

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: "flex" }}>
        <CssBaseline />

        {/* Top App Bar */}
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            background: "linear-gradient(to right, #0A1E37, #1F559B)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              Advisors M.E. LLC.
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            {isAdmin && (
              <Button
                color="inherit"
                onClick={() => setAdminOpen(true)}
                sx={{
                  mr: 1,
                  textTransform: "none",
                  "&:hover": { backgroundColor: "rgba(255,255,255, 0.1)" },
                }}
              >
                Admin
              </Button>
            )}
            {user && (
              <Button
                color="inherit"
                onClick={logout}
                sx={{
                  textTransform: "none",
                  "&:hover": { backgroundColor: "rgba(255,255,255, 0.1)" },
                }}
              >
                Logout
              </Button>
            )}
          </Toolbar>
        </AppBar>

        {/* Left-hand Navigation Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: drawerWidth,
              boxSizing: "border-box",
              background: sidebarColors.background,
              color: sidebarColors.text,
              borderRight: "none",
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            {/* Header / Logo */}
            <Box sx={{ p: 3, display: "flex", alignItems: "center", mt: 8 }}>
              <img
                src={logoImage}
                alt="Advisors M.E."
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </Box>

            <Divider sx={{ borderColor: sidebarColors.divider, mb: 1, mx: 3 }} />

            {/* Main Navigation */}
            <Box sx={{ overflow: "auto", flexGrow: 1, px: 2 }}>
              <List>
                {/* Home Item */}
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => navigate("/")}
                    sx={{
                      borderRadius: 2,
                      color:
                        location.pathname === "/"
                          ? sidebarColors.white
                          : sidebarColors.text,
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255, 0.1)",
                        color: sidebarColors.textActive,
                        "& .MuiListItemIcon-root": {
                          color: sidebarColors.textActive,
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color:
                          location.pathname === "/"
                            ? sidebarColors.textActive
                            : sidebarColors.icon,
                      }}
                    >
                      <HomeIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Home"
                      primaryTypographyProps={{
                        fontSize: "0.9rem",
                        fontWeight: location.pathname === "/" ? 600 : 400,
                      }}
                    />
                  </ListItemButton>
                </ListItem>

                {/* Dashboard Menu Items */}
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;

                  return (
                    <ListItem key={item.key} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        onClick={() => navigate(item.path)}
                        sx={{
                          borderRadius: 2,
                          color: isActive
                            ? sidebarColors.textActive
                            : sidebarColors.text,
                          "&:hover": {
                            backgroundColor: "rgba(255,255,255, 0.1)",
                            color: sidebarColors.textActive,
                            "& .MuiListItemIcon-root": {
                              color: sidebarColors.textActive,
                            },
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 40,
                            color: isActive
                              ? sidebarColors.textActive
                              : sidebarColors.icon,
                          }}
                        >
                          <Icon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.title}
                          primaryTypographyProps={{
                            fontSize: "0.9rem",
                            fontWeight: isActive ? 600 : 400,
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>

              <Divider sx={{ borderColor: sidebarColors.divider, my: 2 }} />

              {/* Settings */}
              <List>
                <ListItem disablePadding>
                  <ListItemButton
                    sx={{
                      borderRadius: 2,
                      color: sidebarColors.text,
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255, 0.1)",
                        color: sidebarColors.textActive,
                        "& .MuiListItemIcon-root": {
                          color: sidebarColors.textActive,
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{ minWidth: 40, color: sidebarColors.icon }}
                    >
                      <SettingsOutlined fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Settings"
                      primaryTypographyProps={{ fontSize: "0.9rem" }}
                    />
                  </ListItemButton>
                </ListItem>
              </List>
            </Box>

            {/* Footer / User Profile */}
            <Box sx={{ p: 2, borderTop: `1px solid ${sidebarColors.divider}` }}>
              <ListItemButton
                sx={{
                  borderRadius: 2,
                  px: 1,
                  "&:hover": { backgroundColor: "rgba(255,255,255, 0.1)" },
                }}
              >
                <Avatar
                  alt={user?.email || "User"}
                  sx={{
                    width: 40,
                    height: 40,
                    mr: 2,
                    bgcolor: "#1976d2",
                  }}
                >
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </Avatar>
                <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "white", fontWeight: 600, lineHeight: 1.2 }}
                  >
                    {user?.email?.split("@")[0] || "User"}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: sidebarColors.text, fontSize: "0.75rem" }}
                    noWrap
                  >
                    {user?.email || "user@example.com"}
                  </Typography>
                </Box>
                <UnfoldMore sx={{ color: sidebarColors.text }} fontSize="small" />
              </ListItemButton>
            </Box>
          </Box>
        </Drawer>

        {/* Main Content Area */}
        <Box component="main" sx={{ flexGrow: 1, p: 3, pt: 10 }}>
          {children || <HomeDashboard />}
        </Box>
      </Box>
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    </ThemeProvider>
  );
}

export default Dashboard;
