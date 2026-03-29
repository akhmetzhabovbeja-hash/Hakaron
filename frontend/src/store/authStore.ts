import { create } from "zustand";
import apiClient from "../api/client";
import type { User, UserRole } from "../types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => void;
  getDefaultRoute: () => string;
}

function defaultRouteForRole(role: UserRole): string {
  switch (role) {
    case "manager":
      return "/manager";
    case "hr":
      return "/hr/approved";
    case "candidate":
    default:
      return "/vacancies";
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await apiClient.post("/auth/login", { email, password });
    localStorage.setItem("access_token", data.access_token);

    const { data: user } = await apiClient.get("/auth/me");
    set({ user, isAuthenticated: true });
  },

  register: async (name, email, password) => {
    const { data } = await apiClient.post("/auth/register", {
      name,
      email,
      password,
    });
    localStorage.setItem("access_token", data.access_token);

    const { data: user } = await apiClient.get("/auth/me");
    set({ user, isAuthenticated: true });
  },

  hydrate: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data: user } = await apiClient.get("/auth/me");
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem("access_token");
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("access_token");
    set({ user: null, isAuthenticated: false });
  },

  getDefaultRoute: () => {
    const user = get().user;
    return user ? defaultRouteForRole(user.role) : "/auth";
  },
}));
