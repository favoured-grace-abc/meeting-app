import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import GridViewIcon from "@mui/icons-material/GridView";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import type { ReactNode } from "react";
import { useAuth } from "../context/authContext";

const DRAWER_WIDTH = 250;

interface NavItem {
  label: string;
  icon: ReactNode;
  path: string;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems: NavItem[] = [
    { label: "Dashboard", icon: <GridViewIcon />, path: "/" },
    { label: "Recordings", icon: <FolderOpenIcon />, path: "/recordings" },
    { label: "Settings", icon: <SettingsIcon />, path: "/settings" },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar />
      <List sx={{ pt: 10, px: 1.5 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => handleNav(item.path)}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive ? "rgba(35,29,140,0.10)" : "transparent",
                  "&:hover": {
                    bgcolor: isActive
                      ? "rgba(35,29,140,0.14)"
                      : "rgba(35,29,140,0.06)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 44,
                    color: isActive ? "primary.main" : "text.secondary",
                    "& svg": { fontSize: 26 },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  slotProps={{
                    primary: {
                      sx: {
                        fontSize: 15,
                        fontWeight: isActive ? 900 : 800,
                        color: isActive ? "primary.main" : "text.primary",
                      },
                    },
                  }}
                >
                  {item.label}
                </ListItemText>
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ flex: 1 }} />

      <Divider />
      <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        <Avatar
          src={user?.photoURL || undefined}
          sx={{
            width: 40,
            height: 40,
            bgcolor: "#f6f6f7",
            border: "1px solid #e4e4e7",
            color: "#3f3f46",
            fontSize: 18,
          }}
        >
          {(user?.displayName?.[0] || "U").toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, fontSize: 17, color: "text.primary" }}
            noWrap
          >
            {user?.displayName || "User"}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontSize: 14, color: "text.secondary" }}
            noWrap
          >
            {user?.email}
          </Typography>
        </Box>
        <Tooltip title="Sign out">
          <IconButton
            onClick={handleSignOut}
            sx={{ color: "text.secondary", "& svg": { fontSize: 26 } }}
          >
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: "#ffffff",
          color: "#3f3f46",
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: { xs: 64, md: 80 }, py: 1 }}>
          <IconButton
            onClick={() => setMobileOpen(true)}
            sx={{
              display: { xs: "inline-flex", md: "none" },
              mr: 0.5,
              color: "#3f3f46",
            }}
            title="Open menu"
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 900,
              fontSize: 24,
              letterSpacing: "-0.02em",
              color: "#3f3f46",
            }}
          >
            MeetFlow
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        open
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "background.paper",
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "background.paper",
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flex: 1,
          width: 0,
          maxWidth: 900,
          mx: "auto",
          px: { xs: 2, md: 3 },
          pt: { xs: "80px", md: "96px" },
          pb: 4,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
