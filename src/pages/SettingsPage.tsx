import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useAppTheme } from "../context/themeContext";
import AppLayout from "../components/AppLayout";

function liveCaptionsDefault() {
  return window.localStorage.getItem("meetflow-live-captions") !== "false";
}

export default function SettingsPage() {
  const { mode, toggleMode } = useAppTheme();
  const isDark = mode === "dark";
  const [liveCaptions, setLiveCaptions] = useState(liveCaptionsDefault);

  const toggleLiveCaptions = () => {
    const next = !liveCaptions;
    setLiveCaptions(next);
    window.localStorage.setItem("meetflow-live-captions", String(next));
  };

  return (
    <AppLayout>
      <Box
        sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 720 }}
      >
        <Box>
          <Typography variant="h4" sx={{ color: "text.primary" }}>
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Personalise how MeetFlow looks and behaves for you.
          </Typography>
        </Box>

        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ letterSpacing: "0.08em" }}
        >
          APPEARANCE
        </Typography>
        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(35,29,140,0.12)",
                  }}
                >
                  {isDark ? (
                    <DarkModeIcon sx={{ color: "#231D8C", fontSize: 24 }} />
                  ) : (
                    <LightModeIcon sx={{ color: "#231D8C", fontSize: 24 }} />
                  )}
                </Box>
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 650, color: "text.primary" }}
                  >
                    Dark mode
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Switch between light and dark appearance. Applied instantly
                    and saved.
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={isDark}
                onChange={toggleMode}
                slotProps={{ input: { "aria-label": "Toggle dark mode" } }}
              />
            </Box>
          </CardContent>
        </Card>

        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ letterSpacing: "0.08em" }}
        >
          RECORDED
        </Typography>
        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(35,29,140,0.12)",
                  }}
                >
                  <SubtitlesIcon sx={{ color: "#231D8C", fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 650, color: "text.primary" }}
                  >
                    Live captions while recording
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Show real-time transcription below the dashboard recorder as
                    you speak.
                  </Typography>
                </Box>
              </Box>
              <Switch
                checked={liveCaptions}
                onChange={toggleLiveCaptions}
                slotProps={{ input: { "aria-label": "Toggle live captions" } }}
              />
            </Box>
          </CardContent>
        </Card>

        <Typography
          variant="subtitle2"
          color="text.secondary"
          sx={{ letterSpacing: "0.08em" }}
        >
          ABOUT
        </Typography>
        <Card variant="outlined">
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(35,29,140,0.12)",
                  }}
                >
                  <InfoOutlinedIcon sx={{ color: "#231D8C", fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 650, color: "text.primary" }}
                  >
                    MeetFlow
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Meeting recording &amp; AI transcription · v0.0.0
                  </Typography>
                </Box>
              </Box>
              <Divider />
              <Typography variant="body2" color="text.secondary">
                Record meetings in your browser, get automatic AI transcripts
                with speaker labels, organise recordings into folders, and
                export in TXT, SRT, VTT, or DOCX.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </AppLayout>
  );
}
