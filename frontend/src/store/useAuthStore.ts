import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/lib/api';
import type { User, AuthToken, LoginRequest, RegisterRequest } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  loadUser: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Actions
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true });
        try {
          const response = await apiClient.post<{ data: AuthToken }>('/auth/login', credentials);
          const authToken = response.data.data;

          // Store tokens
          localStorage.setItem('access_token', authToken.access_token);
          localStorage.setItem('refresh_token', authToken.refresh_token);

          set({
            token: authToken.access_token,
            refreshToken: authToken.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Load user profile after login
          await get().loadUser();
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterRequest) => {
        set({ isLoading: true });
        try {
          const response = await apiClient.post<{ data: AuthToken }>('/auth/register', data);
          const authToken = response.data.data;

          // Store tokens
          localStorage.setItem('access_token', authToken.access_token);
          localStorage.setItem('refresh_token', authToken.refresh_token);

          set({
            token: authToken.access_token,
            refreshToken: authToken.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Load user profile after registration
          await get().loadUser();
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        // Clear tokens from localStorage
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          get().logout();
          return;
        }

        try {
          const response = await apiClient.post<{ data: AuthToken }>('/auth/refresh', {
            refresh_token: refreshToken,
          });
          const authToken = response.data.data;

          localStorage.setItem('access_token', authToken.access_token);
          localStorage.setItem('refresh_token', authToken.refresh_token);

          set({
            token: authToken.access_token,
            refreshToken: authToken.refresh_token,
          });
        } catch {
          // Refresh failed - logout user
          get().logout();
        }
      },

      loadUser: async () => {
        const { token } = get();
        if (!token) return;

        set({ isLoading: true });
        try {
          const response = await apiClient.get<{ data: User }>('/auth/profile');
          set({
            user: response.data.data,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Token might be invalid
          set({ isLoading: false });
          get().logout();
        }
      },
    }),
    {
      name: 'auth-storage',
      // Only persist token-related fields, not loading state
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
