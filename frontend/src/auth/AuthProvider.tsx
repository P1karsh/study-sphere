import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { onUnauthorized } from "../lib/api";
import { authApi, type User } from "../lib/authApi";
import { AuthContext, type AuthStatus } from "./authContext";

// Keeps track of who is signed in. The backend is the real source of truth:
// this just mirrors what /auth/me says, so a stale or forged value here can't
// unlock anything on the server.
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");

  const signedIn = useCallback((nextUser: User) => {
    setUser(nextUser);
    setStatus("signedIn");
  }, []);

  const signedOut = useCallback(() => {
    setUser(null);
    setStatus("signedOut");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkSession = () => {
      authApi
        .me()
        .then((me) => !cancelled && signedIn(me))
        .catch(() => !cancelled && signedOut());
    };

    checkSession();

    // Any 401 from the API means our session is gone (expired, or signed out
    // in another tab), so fall back to the signed-out view.
    onUnauthorized(signedOut);

    // Re-check when the user comes back to the tab, so an expired session
    // doesn't leave them looking at a dashboard that no longer works.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkSession();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      onUnauthorized(null);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [signedIn, signedOut]);

  const value = useMemo(
    () => ({
      user,
      status,
      signIn: async (email: string, password: string) => {
        signedIn(await authApi.login(email, password));
      },
      signUp: async (name: string, email: string, password: string) => {
        signedIn(await authApi.register(name, email, password));
      },
      signOut: async () => {
        try {
          await authApi.logout();
        } finally {
          // Even if the request fails, don't leave the UI looking signed in.
          signedOut();
        }
      },
    }),
    [user, status, signedIn, signedOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
