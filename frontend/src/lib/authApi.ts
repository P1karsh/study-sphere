import { apiRequest } from "./api";

export type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export const authApi = {
  me: () => apiRequest<User>("/auth/me"),

  login: (email: string, password: string) =>
    apiRequest<User>("/auth/login", { method: "POST", body: { email, password } }),

  register: (name: string, email: string, password: string) =>
    apiRequest<User>("/auth/register", { method: "POST", body: { name, email, password } }),

  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),
};
