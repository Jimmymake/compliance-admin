'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  userId: string;
  email: string;
  name: string;
  role: 'approver' | 'checker' | 'merchant' | 'admin';
  platformName?: string;
  platformReferenceId?: string;
  profilePic?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ALLOWED_ROLES = new Set(['approver', 'checker']);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionToken = localStorage.getItem('session_token');
        if (sessionToken) {
          // TODO: Validate token with backend
          const userData = localStorage.getItem('user_data');
          if (userData) {
            const storedUser = JSON.parse(userData);
            if (ALLOWED_ROLES.has(storedUser.role)) {
              setUser(storedUser);
            } else {
              logout();
            }
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      if (!ALLOWED_ROLES.has(data.user?.role)) {
        throw new Error('You have no access to this dashboard');
      }

      setUser(data.user);
      localStorage.setItem('session_token', data.sessionToken);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      localStorage.setItem('session_expires_in', data.expiresIn);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('session_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('session_expires_in');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
