import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type AuthTab = "login" | "register";

type AuthModalContextValue = {
  open: boolean;
  tab: AuthTab;
  redirectTo: string;
  openLogin: (redirectTo?: string) => void;
  openRegister: (redirectTo?: string) => void;
  /** Opens the auth modal on the login tab (same as `openLogin`). */
  openAuthModal: (redirectTo?: string) => void;
  close: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AuthTab>("login");
  const [redirectTo, setRedirectTo] = useState("/mis-anuncios");

  const openLogin = useCallback((to?: string) => {
    setTab("login");
    setRedirectTo(to ?? "/mis-anuncios");
    setOpen(true);
  }, []);

  const openRegister = useCallback((to?: string) => {
    setTab("register");
    setRedirectTo(to ?? "/mis-anuncios");
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, tab, redirectTo, openLogin, openRegister, openAuthModal: openLogin, close }),
    [open, tab, redirectTo, openLogin, openRegister, close],
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
