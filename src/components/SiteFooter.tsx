import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

const linkClass = "text-sm font-medium text-body underline-offset-2 transition hover:text-primary hover:underline";

export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-6 dark:border-slate-700 dark:bg-surface sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5">
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link to="/grupos" className={linkClass}>
            Comunidades
          </Link>
          <Link to="/faq" className={linkClass}>
            Preguntas Frecuentes
          </Link>
          <Link to="/contacto" className={linkClass}>
            Contacto
          </Link>
          <Link to="/legal/terminos" className={linkClass}>
            Términos y Condiciones
          </Link>
          <Link to="/legal/privacidad" className={linkClass}>
            Aviso de Privacidad
          </Link>
        </nav>

        <div className="flex w-full max-w-md flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <BrandLogo imgClassName="h-7 w-auto max-w-[min(100%,200px)] object-left sm:h-8" />
          <p className="text-center text-sm text-muted sm:text-right">
            © {new Date().getFullYear()} Bestie™
            <br />
            <span className="text-xs">Operado por Enrique Batani Oseguera</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
