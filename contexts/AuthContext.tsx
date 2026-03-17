import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { dismissProfilePromptStorage } from "../lib/auth-data";
import { useAuthSession } from "../hooks/use-auth-session";
import {
  authenticateWithBiometrics,
  getBiometricAvailability,
  isBiometricEnabledForUser,
  setBiometricEnabledForUser,
} from "../lib/biometric-auth";
import {
  type AuthSession as Session,
  type AuthUser as User,
  signIn as backendSignIn,
  signOut as backendSignOut,
  signUp as backendSignUp,
  updateProfileRequest,
} from "../lib/backend-auth";

export type AppRole = "admin" | "manager" | "vendor";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role_title: string | null;
  document?: string | null;
  created_at: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  profileIncomplete: boolean;
  biometricAvailable: boolean;
  biometricEnrolled: boolean;
  biometricEnabled: boolean;
  biometricLabel: string;
  biometricLoading: boolean;
  biometricUnlocking: boolean;
  biometricRequired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
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
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("biometria");
  const [biometricLoading, setBiometricLoading] = useState(true);
  const [biometricUnlocking, setBiometricUnlocking] = useState(false);
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const skipNextBiometricLockRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const syncBiometricState = useCallback(async (userId: string | null, hasSession: boolean) => {
    setBiometricLoading(true);

    try {
      const availability = await getBiometricAvailability();
      setBiometricAvailable(availability.available);
      setBiometricEnrolled(availability.enrolled);
      setBiometricLabel(availability.label);

      if (!userId || !hasSession || !availability.available || !availability.enrolled) {
        setBiometricEnabled(false);
        setBiometricUnlocked(true);
        return;
      }

      const enabled = await isBiometricEnabledForUser(userId);
      setBiometricEnabled(enabled);

      if (!enabled || skipNextBiometricLockRef.current) {
        setBiometricUnlocked(true);
        skipNextBiometricLockRef.current = false;
        return;
      }

      setBiometricUnlocked(false);
    } catch {
      setBiometricAvailable(false);
      setBiometricEnrolled(false);
      setBiometricEnabled(false);
      setBiometricLabel("biometria");
      setBiometricUnlocked(true);
    } finally {
      setBiometricLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    skipNextBiometricLockRef.current = true;
    setBiometricUnlocked(true);

    try {
      await backendSignIn(email, password);
    } catch (error) {
      skipNextBiometricLockRef.current = false;
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    await backendSignUp(email, password, fullName);
  };

  const signOut = async () => {
    await backendSignOut();
    setBiometricUnlocked(false);
  };

  const enableBiometrics = async () => {
    if (!user) {
      return false;
    }

    setBiometricUnlocking(true);

    try {
      const availability = await getBiometricAvailability();
      setBiometricAvailable(availability.available);
      setBiometricEnrolled(availability.enrolled);
      setBiometricLabel(availability.label);

      if (!availability.available || !availability.enrolled) {
        return false;
      }

      const authenticated = await authenticateWithBiometrics(
        `Confirme su identidad para habilitar ${availability.label}`,
      );

      if (!authenticated) {
        return false;
      }

      await setBiometricEnabledForUser(user.id, true);
      setBiometricEnabled(true);
      setBiometricUnlocked(true);

      return true;
    } finally {
      setBiometricUnlocking(false);
    }
  };

  const disableBiometrics = async () => {
    if (!user) {
      return;
    }

    await setBiometricEnabledForUser(user.id, false);
    setBiometricEnabled(false);
    setBiometricUnlocked(true);
  };

  const unlockWithBiometrics = async () => {
    if (!user) {
      return false;
    }

    setBiometricUnlocking(true);

    try {
      const authenticated = await authenticateWithBiometrics(
        `Desbloquee la aplicacion con ${biometricLabel}`,
      );

      if (!authenticated) {
        return false;
      }

      setBiometricUnlocked(true);
      return true;
    } finally {
      setBiometricUnlocking(false);
    }
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return;
    await updateProfileRequest(data);
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
  const biometricRequired = !!session && biometricEnabled && !biometricUnlocked;

  useEffect(() => {
    void syncBiometricState(user?.id ?? null, !!session);
  }, [session, syncBiometricState, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const prevAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (
        (prevAppState === "active" || prevAppState === "inactive") &&
        nextAppState === "background" &&
        biometricEnabled &&
        session
      ) {
        setBiometricUnlocked(false);
      }
    });

    return () => subscription.remove();
  }, [biometricEnabled, session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        role,
        loading,
        profileIncomplete,
        biometricAvailable,
        biometricEnrolled,
        biometricEnabled,
        biometricLabel,
        biometricLoading,
        biometricUnlocking,
        biometricRequired,
        signIn,
        signUp,
        signOut,
        enableBiometrics,
        disableBiometrics,
        unlockWithBiometrics,
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
