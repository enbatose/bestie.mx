import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { MyListingsReturnLink } from "@/components/myListings/MyListingsReturnLink";
import {
  buildMyListingsRestorePath,
  readMyListingsReturn,
} from "@/lib/myListingsReturn";

/** Effective / last-updated date shared across every legal document. */
export const LEGAL_LAST_UPDATED = "4 de agosto de 2026";

/** Legal identity of the operator, reused verbatim across documents. */
export const LEGAL_OPERATOR = {
  responsible: "ENRIQUE BATANI OSEGUERA",
  brand: "Bestie",
  domain: "bestie.mx",
  site: "https://www.bestie.mx",
  contactEmail: "contacto@bestie.mx",
  fiscalRegime: "Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios",
  address: "Calle Herodoto 55, Vallarta San Jorge, C.P. 44690, Guadalajara, Jalisco, México",
} as const;

export type LegalTocItem = { id: string; label: string };

/** Smoothly scrolls to the hash target after render (used by #eliminacion-de-datos, etc.). */
function useScrollToHash() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 });
      return;
    }
    const id = decodeURIComponent(hash.replace("#", ""));
    const el = document.getElementById(id);
    if (el) {
      window.requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [hash]);
}

export function LegalShell({
  kicker,
  title,
  intro,
  toc,
  children,
}: {
  kicker: string;
  title: string;
  intro?: ReactNode;
  toc?: LegalTocItem[];
  children: ReactNode;
}) {
  useScrollToHash();
  const location = useLocation();
  const myListingsRestorePath = (() => {
    const ctx = readMyListingsReturn(location.state);
    return ctx ? buildMyListingsRestorePath(ctx) : null;
  })();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {myListingsRestorePath ? (
        <div className="mb-4">
          <MyListingsReturnLink to={myListingsRestorePath} placement="top" />
        </div>
      ) : null}
      <nav className="mb-6 text-xs font-medium text-muted">
        <Link to="/legal" className="text-primary underline-offset-2 hover:underline">
          Centro legal
        </Link>
        <span className="mx-2">/</span>
        <span>{kicker}</span>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{kicker}</p>
        <h1 className="mt-1 text-3xl font-bold text-primary">{title}</h1>
        <p className="mt-3 text-sm text-muted">
          Última actualización: {LEGAL_LAST_UPDATED} · Operado por {LEGAL_OPERATOR.responsible} ·{" "}
          <a
            className="font-medium text-primary underline-offset-2 hover:underline"
            href={`mailto:${LEGAL_OPERATOR.contactEmail}`}
          >
            {LEGAL_OPERATOR.contactEmail}
          </a>
        </p>
        {intro ? <div className="mt-6 space-y-4 text-sm leading-relaxed text-body">{intro}</div> : null}
      </header>

      {toc && toc.length > 0 ? (
        <nav className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Contenido</p>
          <ol className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {toc.map((item, index) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-body underline-offset-2 hover:text-primary hover:underline"
                >
                  <span className="text-muted">{index + 1}.</span> {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="mt-10 space-y-10">{children}</div>

      <LegalFooterNav />
    </div>
  );
}

export function LegalSection({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-primary">
        <span className="text-muted">{index}.</span> {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-body">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-2 text-sm leading-relaxed text-body marker:text-muted">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/** Reusable identity block for the responsible party (LFPDPPP requires identity + domicile). */
export function LegalOperatorReference() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 text-sm leading-relaxed text-body">
      <dl className="space-y-1.5">
        <div>
          <dt className="inline font-semibold text-primary">Responsable: </dt>
          <dd className="inline">{LEGAL_OPERATOR.responsible}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-primary">Marca comercial: </dt>
          <dd className="inline">
            Bestie (bestie.mx), en trámite de registro ante el IMPI (expediente 3678152, clase 35)
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-primary">Régimen fiscal: </dt>
          <dd className="inline">{LEGAL_OPERATOR.fiscalRegime}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-primary">Correo de contacto: </dt>
          <dd className="inline">
            <LegalMail />
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold text-primary">Domicilio: </dt>
          <dd className="inline">{LEGAL_OPERATOR.address}</dd>
        </div>
      </dl>
    </div>
  );
}

export function LegalMail() {
  return (
    <a
      className="font-medium text-primary underline-offset-2 hover:underline"
      href={`mailto:${LEGAL_OPERATOR.contactEmail}`}
    >
      {LEGAL_OPERATOR.contactEmail}
    </a>
  );
}

function LegalFooterNav() {
  return (
    <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
      <Link to="/legal" className="font-semibold text-primary underline-offset-2 hover:underline">
        Centro legal
      </Link>
      <Link to="/legal/terminos" className="text-body underline-offset-2 hover:text-primary hover:underline">
        Términos y Condiciones
      </Link>
      <Link to="/legal/privacidad" className="text-body underline-offset-2 hover:text-primary hover:underline">
        Aviso de Privacidad
      </Link>
      <Link to="/contacto" className="text-body underline-offset-2 hover:text-primary hover:underline">
        Contacto
      </Link>
    </div>
  );
}
