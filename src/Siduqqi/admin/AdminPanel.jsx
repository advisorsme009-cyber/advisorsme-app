import React, { useEffect, useState } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
} from "@mui/material";
import { Delete as DeleteIcon, Close as CloseIcon } from "@mui/icons-material";
import { useAuth } from "../auth/AuthContext";

const AdminPanel = ({ open, onClose }) => {
  const { fetchAllUsers, deleteUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetchAllUsers();
      setUsers(Array.isArray(res) ? res : (res?.users ?? []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleDelete = async (id) => {
    try {
      await deleteUser(id);
      await refresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Admin: Users
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box>
          <List>
            {loading && (
              <ListItem>
                <ListItemText primary="Loading..." />
              </ListItem>
            )}
            {!loading && users.length === 0 && (
              <ListItem>
                <ListItemText primary="No users found." />
              </ListItem>
            )}
            {!loading &&
              users.map((u) => (
                <ListItem
                  key={u.id || u.client_id}
                  secondaryAction={
                    <Tooltip title="Delete user">
                      <IconButton
                        edge="end"
                        onClick={() => handleDelete(u.id || u.client_id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemText
                    primary={u.email || u.username || u.id || u.client_id}
                    secondary={u.id || u.client_id}
                  />
                </ListItem>
              ))}
          </List>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;
