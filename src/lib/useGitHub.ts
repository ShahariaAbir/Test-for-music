import { useState, useEffect, useCallback } from "react";
import { getToken, setToken as saveToken, clearToken, getUser } from "./github";

export function useGitHub() {
  const [token, setTokenState] = useState<string | null>(getToken());
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (newToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const u = await getUser(newToken);
      saveToken(newToken);
      setTokenState(newToken);
      setUser(u);
    } catch {
      setError("Invalid or expired token. Please check and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (token && !user) {
      connect(token);
    }
  }, []);

  return { token, user, loading, error, connect, disconnect, isConnected: !!token && !!user };
}
