import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import GoogleIcon from "@mui/icons-material/Google";
import { useState } from "react";
import { useAuth } from "../context/authContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
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
        bgcolor: "background.default",
        backgroundImage:
          "linear-gradient(135deg, rgba(35,29,140,0.12), rgba(6,182,212,0.10))",
      }}
    >
      <Card
        sx={{
          maxWidth: 420,
          width: "100%",
          borderRadius: 4,
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 5 }, textAlign: "center" }}>
          <Box
            component="img"
            src="/logo.png"
            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
              e.currentTarget.style.display = "none";
            }}
            alt="MeetFlow logo"
            sx={{
              width: 65,
              height: 65,
              mx: "auto",
              mb: 3,
              borderRadius: 4,
              objectFit: "contain",
            }}
          />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: "-0.02em",
              mb: 1,
              color: "text.primary",
            }}
          >
            Welcome to MeetFlow
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Record meetings, get AI transcripts and speaker labels
            automatically.
          </Typography>

          {error && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={
              busy ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <GoogleIcon />
              )
            }
            onClick={handleSignIn}
            disabled={busy}
            sx={{ py: 1.5, borderRadius: 12, textTransform: "none" }}
          >
            {busy ? "Signing in..." : "Continue with Google"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
