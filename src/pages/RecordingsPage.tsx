import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import TextField from "@mui/material/TextField";
import Snackbar from "@mui/material/Snackbar";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import FolderIcon from "@mui/icons-material/Folder";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import MoveToInboxIcon from "@mui/icons-material/MoveToInbox";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { api, ApiError } from "../services/api";
import type { Folder, Recording } from "../types";
import AppLayout from "../components/AppLayout";

interface RecordingRow extends Recording {
  meetingTitle: string;
  transcriptText?: string;
  transcriptReady?: boolean;
}

function formatClock(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecordingsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuRow, setMenuRow] = useState<RecordingRow | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameRow, setRenameRow] = useState<RecordingRow | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveRow, setMoveRow] = useState<RecordingRow | null>(null);
  const [moveFolderId, setMoveFolderId] = useState("none");
  const [moveBusy, setMoveBusy] = useState(false);

  const [complainOpen, setComplainOpen] = useState(false);
  const [complainRow, setComplainRow] = useState<RecordingRow | null>(null);
  const [complainText, setComplainText] = useState("");
  const [complainBusy, setComplainBusy] = useState(false);

  const [deleteRow, setDeleteRow] = useState<RecordingRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);

  const load = useCallback(async () => {
    const [bulkRows, folderList] = await Promise.all([
      api.listAllRecordings().catch(() => [] as RecordingRow[]),
      api.listFolders().catch(() => [] as Folder[]),
    ]);
    const unique = new Map<string, RecordingRow>();
    bulkRows.forEach((row) => unique.set(row.id, row));
    const sorted = Array.from(unique.values()).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
    return { rows: sorted, folders: folderList };
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(({ rows, folders }) => {
        if (!cancelled) {
          setRows(rows);
          setFolders(folders);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : "Failed to load recordings",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const folderNameOf = useCallback(
    (folderId: string | null | undefined) =>
      folders.find((f) => f.id === folderId)?.name || null,
    [folders],
  );

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((row) => {
      if (row.folderId) counts[row.folderId] = (counts[row.folderId] || 0) + 1;
    });
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (activeFolder !== null && row.folderId !== activeFolder) return false;
      return true;
    });
  }, [rows, activeFolder]);

  const openMenu = (event: React.MouseEvent, row: RecordingRow) => {
    setMenuRow(row);
    setMenuAnchor(event.currentTarget);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuRow(null);
  };

  const refresh = useCallback(async () => {
    const next = await load();
    setRows(next.rows);
    setFolders(next.folders);
  }, [load]);

  const showNotice = (message: string) => setNotice(message);

  const handleRenameSave = async () => {
    if (!renameRow) return;
    setRenameBusy(true);
    try {
      await api.updateRecording(renameRow.meetingId, renameRow.id, {
        title: renameName.trim(),
      });
      setRenameOpen(false);
      showNotice("Recording renamed.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to rename recording",
      );
    } finally {
      setRenameBusy(false);
    }
  };

  const handleCreateFolderSave = async () => {
    setCreateBusy(true);
    try {
      await api.createFolder(createName.trim());
      setCreateOpen(false);
      setCreateName("");
      showNotice("Folder created.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setCreateBusy(false);
    }
  };

  const handleMoveSave = async () => {
    if (!moveRow) return;
    setMoveBusy(true);
    try {
      const folderId = moveFolderId === "none" ? null : moveFolderId;
      await api.updateRecording(moveRow.meetingId, moveRow.id, { folderId });
      setMoveOpen(false);
      showNotice(
        folderId
          ? "Recording moved to folder."
          : "Recording moved out of folder.",
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move recording");
    } finally {
      setMoveBusy(false);
    }
  };

  const handleComplainSave = async () => {
    if (!complainRow) return;
    setComplainBusy(true);
    try {
      await api.updateRecording(complainRow.meetingId, complainRow.id, {
        complaint: {
          message: complainText.trim(),
          createdAt: new Date().toISOString(),
        },
      });
      setComplainOpen(false);
      showNotice("Thanks — your complaint has been submitted.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit complaint",
      );
    } finally {
      setComplainBusy(false);
    }
  };

  const handleComplainClear = async () => {
    if (!complainRow) return;
    setComplainBusy(true);
    try {
      await api.updateRecording(complainRow.meetingId, complainRow.id, {
        complaint: null,
      });
      setComplainOpen(false);
      showNotice("Complaint cleared.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to clear complaint",
      );
    } finally {
      setComplainBusy(false);
    }
  };

  const handleDeleteSave = async () => {
    if (!deleteRow) return;
    setDeleteBusy(true);
    try {
      await api.deleteRecording(deleteRow.meetingId, deleteRow.id);
      setDeleteRow(null);
      showNotice("Recording deleted.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete recording",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleDeleteFolderSave = async () => {
    if (!deleteFolder) return;
    setDeleteBusy(true);
    try {
      await api.deleteFolder(deleteFolder.id);
      if (activeFolder === deleteFolder.id) setActiveFolder(null);
      setDeleteFolder(null);
      showNotice("Folder deleted. Its recordings were kept.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete folder");
    } finally {
      setDeleteBusy(false);
    }
  };

  const openRename = (row: RecordingRow) => {
    setRenameRow(row);
    setRenameName(row.title || row.meetingTitle);
    closeMenu();
    setRenameOpen(true);
  };

  const openMove = (row: RecordingRow) => {
    setMoveRow(row);
    setMoveFolderId(row.folderId || "none");
    closeMenu();
    setMoveOpen(true);
  };

  const openComplain = (row: RecordingRow) => {
    setComplainRow(row);
    setComplainText(row.complaint?.message || "");
    closeMenu();
    setComplainOpen(true);
  };

  const openCreate = () => {
    closeMenu();
    setCreateOpen(true);
  };

  const openDelete = (row: RecordingRow) => {
    setDeleteRow(row);
    closeMenu();
  };

  const titleOf = (row: RecordingRow) => {
    const t = row.title || row.meetingTitle || "";
    return t.replace(/^Recording(?=[\s·]|$)/, "Recorded");
  };

  return (
    <AppLayout>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{ fontWeight: 800, letterSpacing: "-0.02em" }}
            >
              Recordings
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Audio captured during your sessions, ready to play back.
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {folders.length > 0 && (
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap" }}
            useFlexGap
          >
            <Chip
              label={`All (${rows.length})`}
              color={activeFolder === null ? "primary" : "default"}
              onClick={() => setActiveFolder(null)}
              sx={{ cursor: "pointer", fontWeight: 700 }}
            />
            {folders.map((folder) => (
              <Chip
                key={folder.id}
                icon={<FolderIcon />}
                label={`${folder.name} (${folderCounts[folder.id] || 0})`}
                color={activeFolder === folder.id ? "primary" : "default"}
                onClick={() => setActiveFolder(folder.id)}
                onDelete={() => setDeleteFolder(folder)}
                sx={{ cursor: "pointer", fontWeight: 700 }}
              />
            ))}
          </Stack>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : filteredRows.length === 0 ? (
          <Card
            variant="outlined"
            sx={{
              borderStyle: "dashed",
              py: 8,
              textAlign: "center",
              bgcolor: "transparent",
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                mx: "auto",
                mb: 3,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(35,29,140,0.12)",
              }}
            >
              <FolderOpenIcon sx={{ fontSize: 34, color: "#231D8C" }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {rows.length === 0
                ? "No recordings yet"
                : `No results in ${activeFolder ? folderNameOf(activeFolder) : "this folder"}`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {rows.length === 0
                ? ""
                : "Try a different search term or folder."}
            </Typography>
          </Card>
        ) : (
          <Stack spacing={1.5}>
            {filteredRows.map((row) => {
              const folderName = folderNameOf(row.folderId);
              return (
                <Card
                  key={row.id}
                  onClick={() => navigate(`/meeting/${row.meetingId}`)}
                  sx={{ cursor: "pointer", position: "relative" }}
                >
                  <CardContent sx={{ py: 1.75, pl: 2, pr: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            minWidth: 0,
                          }}
                        >
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 650 }}
                            noWrap
                          >
                            {titleOf(row)}
                          </Typography>
                          {row.complaint && (
                            <Tooltip
                              title={`Reported: ${row.complaint.message}`}
                            >
                              <Chip
                                size="small"
                                color="error"
                                variant="outlined"
                                icon={
                                  <ReportProblemIcon sx={{ fontSize: 15 }} />
                                }
                                label="Reported"
                                sx={{ height: 22, flexShrink: 0 }}
                              />
                            </Tooltip>
                          )}
                        </Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                        >
                          {row.fileExtension.toUpperCase()} ·{" "}
                          {formatClock(row.durationMs)} ·{" "}
                          {formatDate(row.createdAt)}
                          {folderName && ` · ${folderName}`}
                        </Typography>
                      </Box>
                      {/* status chip removed as requested */}
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openMenu(e, row);
                        }}
                        title="Recording options"
                      >
                        <MoreVertIcon sx={{ fontSize: 22 }} />
                      </IconButton>
                    </Box>
                    {row.transcriptText ? (
                      <Box
                        sx={{
                          mt: 1.5,
                          pt: 1.5,
                          borderTop: "1px dashed",
                          borderColor: "divider",
                          maxHeight: 96,
                          overflowY: "auto",
                          pr: 1.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ display: "block", mb: 0.5 }}
                        >
                          Transcript
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {row.transcriptText}
                        </Typography>
                      </Box>
                    ) : (
                      !row.transcriptReady &&
                      row.status === "Ready" && (
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ display: "block", mt: 1.5 }}
                        >
                          Transcript not available yet.
                        </Typography>
                      )
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {menuRow && (
          <MenuItem
            onClick={() => {
              navigate(`/meeting/${menuRow.meetingId}`);
            }}
          >
            <ListItemIcon>
              <PlayArrowIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Open transcript</ListItemText>
          </MenuItem>
        )}
        {menuRow && (
          <MenuItem onClick={() => openRename(menuRow)}>
            <ListItemIcon>
              <DriveFileRenameOutlineIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename</ListItemText>
          </MenuItem>
        )}
        {folders.length > 0 && menuRow && (
          <MenuItem onClick={() => openMove(menuRow)}>
            <ListItemIcon>
              <MoveToInboxIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Move</ListItemText>
          </MenuItem>
        )}
        {menuRow && (
          <MenuItem onClick={() => openComplain(menuRow)}>
            <ListItemIcon>
              <ReportProblemIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Complain about transcription</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={openCreate}>
          <ListItemIcon>
            <CreateNewFolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Create folder</ListItemText>
        </MenuItem>
        {menuRow && (
          <MenuItem
            onClick={() => openDelete(menuRow)}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: "error.main" }} />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Rename recorded</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Recording name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!renameName.trim() || renameBusy}
            onClick={handleRenameSave}
          >
            {renameBusy ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Create folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Folder name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && createName.trim() && !createBusy) {
                void handleCreateFolderSave();
              }
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!createName.trim() || createBusy}
            onClick={handleCreateFolderSave}
          >
            {createBusy ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Move recording</DialogTitle>
        <DialogContent>
          <RadioGroup
            value={moveFolderId}
            onChange={(e) => setMoveFolderId(e.target.value)}
          >
            <FormControlLabel
              value="none"
              control={<Radio />}
              label="No folder"
            />
            {folders.map((folder) => (
              <FormControlLabel
                key={folder.id}
                value={folder.id}
                control={<Radio />}
                label={folder.name}
              />
            ))}
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={moveBusy}
            onClick={handleMoveSave}
          >
            {moveBusy ? "Moving…" : "Move"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={complainOpen}
        onClose={() => setComplainOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Complain about transcription
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Let us know what went wrong with this recording's transcription so
            we can improve it.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            placeholder="e.g. The transcription missed the client's name, and some technical terms are wrong…"
            value={complainText}
            onChange={(e) => setComplainText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          {complainRow?.complaint && (
            <Button
              onClick={handleComplainClear}
              disabled={complainBusy}
              sx={{ mr: "auto" }}
            >
              Clear complaint
            </Button>
          )}
          <Button onClick={() => setComplainOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!complainText.trim() || complainBusy}
            onClick={handleComplainSave}
          >
            {complainBusy ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteRow)}
        onClose={() => setDeleteRow(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete recording?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            “{deleteRow ? titleOf(deleteRow) : ""}” and its audio will be
            permanently removed. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteRow(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteBusy}
            onClick={handleDeleteSave}
          >
            {deleteBusy ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deleteFolder)}
        onClose={() => setDeleteFolder(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Delete folder?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Folder “{deleteFolder?.name}” will be removed, but its recordings
            will be kept and moved to “All”.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteFolder(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteBusy}
            onClick={handleDeleteFolderSave}
          >
            {deleteBusy ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={3000}
        onClose={() => setNotice(null)}
        message={notice || undefined}
      />
    </AppLayout>
  );
}
