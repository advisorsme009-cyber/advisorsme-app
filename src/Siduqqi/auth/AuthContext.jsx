import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { apiUrl } from "../hooks/api";

const STORAGE_KEY = "advisorsme_auth_v1";

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { client_id, email, username }
  const isAdmin = user?.email === "admin@admin.com";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user?.client_id) setUser(parsed.user);
      }
    } catch (e) {
      console.debug("AuthContext: failed to restore session", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user }));
    } catch (e) {
      console.debug("AuthContext: failed to persist session", e);
    }
  }, [user]);

  const signup = async ({ email, password, username }) => {
    const res = await fetch(`${apiUrl}/users/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ email, password, username }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data; // { email, password, username, id }
  };

  const loginWithClientId = async (clientId) => {
    const res = await fetch(
      `${apiUrl}/users/login/${encodeURIComponent(clientId)}`,
      {
        method: "GET",
        headers: { accept: "application/json" },
      }
    );
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json(); // { client_id, email, username }
    setUser(data);
    return data;
  };

  const loginWithEmail = async (email, password) => {
    const url = `${apiUrl}/users/login/${encodeURIComponent(email)}/${encodeURIComponent(password)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json(); // { client_id, username, email }
    setUser(data);
    return data;
  };

  const loginBypass = async (clientId) => {
    // Testing-only bypass: accept any provided static client_id
    const fakeUser = {
      client_id: clientId || "TEST_BYPASS",
      email: "tester@bypass.local",
      username: "tester",
    };
    setUser(fakeUser);
    return fakeUser;
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.debug("AuthContext: failed to clear session", e);
    }
  };

  const fetchAllUsers = useCallback(async () => {
    if (!isAdmin) throw new Error("Forbidden");
    const res = await fetch(`${apiUrl}/users/fetch`, {
      method: "GET",
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json(); // expected: array of users
    return data;
  }, [isAdmin]);

  const deleteUser = useCallback(
    async (id) => {
      if (!isAdmin) throw new Error("Forbidden");
      const res = await fetch(
        `${apiUrl}/users/delete/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: { accept: "*/*" },
        }
      );
      if (!res.ok) throw new Error(await res.text());
      return true;
    },
    [isAdmin]
  );

  const value = useMemo(
    () => ({
      user,
      isAdmin,
      signup,
      loginWithClientId,
      loginWithEmail,
      loginBypass,
      logout,
      fetchAllUsers,
      deleteUser,
    }),
    [user, isAdmin, fetchAllUsers, deleteUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
