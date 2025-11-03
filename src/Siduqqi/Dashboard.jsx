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
} from "@mui/icons-material";
import { useAuth } from "./auth/AuthContext";
import AdminPanel from "./admin/AdminPanel";
import { dashboardItems } from "./dashboardConfig";

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

const drawerWidth = 240;

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
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              Advisors M.E. LLC.
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            {user && (
              <Typography sx={{ mr: 2 }} variant="body2">
                {user.email}
              </Typography>
            )}
            {isAdmin && (
              <Button
                color="inherit"
                onClick={() => setAdminOpen(true)}
                sx={{ mr: 1 }}
              >
                Admin
              </Button>
            )}
            {user && (
              <Button color="inherit" onClick={logout}>
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
              backgroundColor: "#e3f2fd",
            },
          }}
        >
          <Toolbar />
          <Box sx={{ overflow: "auto" }}>
            <List>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => navigate("/")}
                  selected={location.pathname === "/"}
                >
                  <ListItemIcon>
                    <HomeIcon sx={{ color: "black", m: 2 }} />
                  </ListItemIcon>
                  <ListItemText primary="Home" />
                </ListItemButton>
              </ListItem>
              <Divider />
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <ListItem key={item.key} disablePadding>
                    <ListItemButton
                      onClick={() => navigate(item.path)}
                      selected={location.pathname === item.path}
                    >
                      <ListItemIcon>
                        <Icon sx={{ color: "black", m: 2 }} />
                      </ListItemIcon>
                      <ListItemText primary={item.title} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
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
