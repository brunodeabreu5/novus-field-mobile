import React, { createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { dismissProfilePromptStorage } from "../lib/auth-data";
import { useAuthSession } from "../hooks/use-auth-session";

export type AppRole = "admin" | "manager" | "vendor";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role_title: string | null;
  created_at: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  profileIncomplete: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
  dismissProfilePrompt: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isVendor: boolean;
  isManagerOrAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const {
    session,
    user,
    profile,
    role,
    loading,
    profileIncomplete,
    refreshProfile,
    setProfileIncomplete,
  } = useAuthSession();

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(data).eq("id", user.id);
    if (error) throw error;
    await refreshProfile(user.id);
  };

  const dismissProfilePrompt = () => {
    dismissProfilePromptStorage();
    setProfileIncomplete(false);
  };

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isVendor = role === "vendor";
  const isManagerOrAdmin = isAdmin || isManager;

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        loading,
        profileIncomplete,
        signIn,
        signUp,
        signOut,
        updateProfile,
        dismissProfilePrompt,
        isAdmin,
        isManager,
        isVendor,
        isManagerOrAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
