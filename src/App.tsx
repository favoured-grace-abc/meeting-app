import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./context/authContext";
import { AppThemeProvider } from "./context/ThemeProvider";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const MeetingRoomPage = lazy(() => import("./pages/MeetingRoomPage"));
const RecordingsPage = lazy(() => import("./pages/RecordingsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function FullScreenLoader() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress />
    </Box>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function MeetingRoomRoute() {
  const { meetingId } = useParams();
  return <MeetingRoomPage key={meetingId} />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/meeting/:meetingId"
          element={
            <RequireAuth>
              <MeetingRoomRoute />
            </RequireAuth>
          }
        />
        <Route
          path="/recordings"
          element={
            <RequireAuth>
              <RecordingsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </AppThemeProvider>
  );
}
