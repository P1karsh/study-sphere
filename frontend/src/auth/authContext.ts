import { createContext, useContext } from "react";
import type { User } from "../lib/authApi";

// "checking" is the brief moment on page load while we ask the backend
// whether the browser already has a valid session.
export type AuthStatus = "checking" | "signedIn" | "signedOut";

export type AuthContextValue = {
  user: User | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return auth;
}
