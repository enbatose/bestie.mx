import { Link, NavLink, Outlet } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "rounded-full px-3 py-1.5 text-sm font-medium transition",
    isActive
      ? "bg-surface-elevated text-primary ring-1 ring-border"
      : "text-body hover:bg-surface-elevated",
  ].join(" ");
}

export function AppShellLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandLogo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink to="/buscar" className={navClass}>
              Buscar
            </NavLink>
            <NavLink to="/publicar" className={navClass}>
              Publicar
            </NavLink>
            <Link
              to="/entrar"
              className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-body transition hover:bg-surface-elevated sm:px-4"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <BrandLogo imgClassName="h-7 w-auto max-w-[200px] object-left sm:h-8" />
            <p className="text-sm text-muted">
              © {new Date().getFullYear()} Bestie™ ·{" "}
              <a
                href="mailto:support@bestie.mx"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                support@bestie.mx
              </a>
            </p>
          </div>
          <p className="text-xs text-muted sm:text-right">bestie.mx — MVP en construcción</p>
        </div>
      </footer>
    </div>
  );
}
