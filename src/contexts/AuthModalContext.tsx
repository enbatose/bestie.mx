import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type AuthTab = "login" | "register";

type AuthModalContextValue = {
  open: boolean;
  tab: AuthTab;
  openLogin: () => void;
  openRegister: () => void;
  /** Opens the auth modal on the login tab (same as `openLogin`). */
  openAuthModal: () => void;
  close: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AuthTab>("login");

  const openLogin = useCallback(() => {
    setTab("login");
    setOpen(true);
  }, []);

  const openRegister = useCallback(() => {
    setTab("register");
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, tab, openLogin, openRegister, openAuthModal: openLogin, close }),
    [open, tab, openLogin, openRegister, close],
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
