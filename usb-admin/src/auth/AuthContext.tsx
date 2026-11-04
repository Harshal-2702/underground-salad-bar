import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isPasswordResetUrl() {
  return new URLSearchParams(window.location.search).get("mode") === "reset";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(isPasswordResetUrl);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY" || isPasswordResetUrl()) {
        setPasswordRecovery(true);
      }
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setSession(error ? null : data.session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    passwordRecovery,
    signIn: async (email, password) => {
      if (!supabase) {
        throw new Error("Admin login is not configured. Check the VITE_SUPABASE_* settings.");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    sendPasswordReset: async (email) => {
      if (!supabase) {
        throw new Error("Admin login is not configured. Check the VITE_SUPABASE_* settings.");
      }
      const redirectTo = `${window.location.origin}/?mode=reset`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },
    updatePassword: async (password) => {
      if (!supabase) {
        throw new Error("Admin login is not configured. Check the VITE_SUPABASE_* settings.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPasswordRecovery(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    },
    signOut: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [session, loading, passwordRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
