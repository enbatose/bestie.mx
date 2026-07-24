import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  Home,
  LayoutGrid,
  MoreHorizontal,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { ListingReferenceChip } from "@/components/myListings/ListingReferenceChip";
import { ListingStatusBadge } from "@/components/myListings/ListingStatusBadge";
import { ListingThumb } from "@/components/myListings/ListingThumb";

/**
 * UX proposal mockups for Mis Anuncios IA.
 * Not wired to live data — do not confuse with /mis-anuncios.
 *
 * Desktop: /mockups/mis-anuncios-proposal
 * Mobile:  /mockups/mis-anuncios-proposal?v=mobile
 */
const MOCK_PATH = "/mockups/mis-anuncios-proposal";
const MOCK_MOBILE_PATH = `${MOCK_PATH}?v=mobile`;
const MOCK_DESKTOP_PATH = `${MOCK_PATH}?v=desktop`;

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect fill="#E2E8F0" width="160" height="160"/><text x="50%" y="54%" text-anchor="middle" fill="#64748B" font-family="system-ui" font-size="14">foto</text></svg>`,
  );

type MockRoom = {
  id: string;
  name: string;
  rentLabel: string | null;
  occupied: boolean;
  status: "published" | "paused" | "draft" | "archived";
  metrics: string;
  thumb?: string;
};

type Viewport = "desktop" | "mobile";

const MOCK_SINGLE: MockRoom = {
  id: "A11111111",
  name: "Recámara iluminada cerca de Chapultepec",
  rentLabel: "$6,500 /mes",
  occupied: false,
  status: "published",
  metrics: "12 vistas · 2 mensajes",
  thumb: PLACEHOLDER,
};

const MOCK_PROPERTY_ROOMS: MockRoom[] = [
  {
    id: "A22222221",
    name: "Recámara 1",
    rentLabel: null,
    occupied: true,
    status: "published",
    metrics: "0 vistas · 0 mensajes",
    thumb: PLACEHOLDER,
  },
  {
    id: "A22222222",
    name: "Recámara 2",
    rentLabel: null,
    occupied: true,
    status: "published",
    metrics: "0 vistas · 0 mensajes",
    thumb: PLACEHOLDER,
  },
  {
    id: "A22222223",
    name: "Recámara 3",
    rentLabel: "$5,200 /mes",
    occupied: false,
    status: "published",
    metrics: "8 vistas · 1 mensaje",
    thumb: PLACEHOLDER,
  },
  {
    id: "A22222224",
    name: "Recámara 4",
    rentLabel: null,
    occupied: true,
    status: "published",
    metrics: "0 vistas · 0 mensajes",
    thumb: PLACEHOLDER,
  },
  {
    id: "A22222225",
    name: "Recámara 5",
    rentLabel: "$4,800 /mes",
    occupied: false,
    status: "paused",
    metrics: "3 vistas · 0 mensajes",
    thumb: PLACEHOLDER,
  },
];

function ProposalBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full bg-secondary/20 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
      {children}
    </span>
  );
}

function ProblemCallout() {
  return (
    <aside className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-4 text-sm text-warning-fg">
      <p className="font-semibold">Problema actual</p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-warning-fg/90">
        <li>
          En posts de <strong>un solo cuarto</strong>, la tarjeta de propiedad + la fila de
          recámara repiten título, estado y acciones.
        </li>
        <li>
          En posts de <strong>propiedad</strong>, 5 recámaras abiertas de golpe ocupan casi dos
          pantallas antes de llegar al siguiente anuncio.
        </li>
      </ul>
    </aside>
  );
}

function CurrentSingleRoomPain() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border border-l-4 border-l-primary/50 bg-surface opacity-80 shadow-sm">
      <div className="border-b border-border bg-surface-elevated px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <ListingStatusBadge status="published" noun="property" />
          <ListingReferenceChip code="P90F93372" label="Propiedad" size="compact" />
        </div>
        <h3 className="mt-2 text-lg font-semibold text-body">Recámara iluminada cerca de Chapultepec</h3>
        <p className="mt-1 text-xs text-muted">Providencia · Guadalajara</p>
        <p className="mt-1 text-xs text-muted">1 recámara</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <span className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            Editar anuncio
          </span>
          <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-body">
            Ver publicación
          </span>
          <span className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-body">
            Pausar propiedad
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <ListingThumb src={PLACEHOLDER} className="size-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-body">Recámara iluminada cerca de Chapultepec</p>
          <p className="text-xs text-muted">$6,500 /mes · 12 vistas · 2 mensajes</p>
        </div>
        <ListingStatusBadge status="published" />
      </div>
      <p className="border-t border-border bg-bg-light px-4 py-2 text-xs text-muted">
        Hoy: misma info dos veces (propiedad + fila). Acciones duplicadas.
      </p>
    </section>
  );
}

function ProposedSingleRoomCard({ room }: { room: MockRoom }) {
  return (
    <article className="rounded-2xl border border-border border-l-4 border-l-primary/50 bg-surface shadow-sm">
      <div className="flex gap-3 p-4 sm:gap-4">
        <ListingThumb src={room.thumb} className="size-16 shrink-0 rounded-xl sm:size-24" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={room.status} />
            <ListingReferenceChip code={room.id} label="Anuncio" size="compact" />
            <ProposalBadge>Cuarto</ProposalBadge>
          </div>
          <h3 className="mt-2 text-base font-semibold leading-snug text-body sm:text-lg">{room.name}</h3>
          <p className="mt-1 text-xs text-muted">Providencia · Guadalajara</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {room.rentLabel ? (
              <span className="text-sm font-semibold text-body">{room.rentLabel}</span>
            ) : null}
            <span className="text-xs text-muted">{room.metrics}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-3 sm:flex sm:flex-wrap">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/15"
        >
          Editar
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-body hover:bg-surface-elevated"
        >
          Ver publicación
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-body hover:bg-surface-elevated"
        >
          Pausar
        </button>
        <button
          type="button"
          aria-label="Más acciones"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border text-body hover:bg-surface-elevated"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      </div>
    </article>
  );
}

function ProposedPropertyCard({
  rooms,
  defaultOpen = false,
}: {
  rooms: MockRoom[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const available = rooms.filter((r) => !r.occupied).length;
  const occupied = rooms.length - available;

  return (
    <section className="rounded-2xl border border-border border-l-4 border-l-primary/50 bg-surface shadow-sm">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex min-w-0 gap-3">
          <div className="relative shrink-0">
            <ListingThumb src={PLACEHOLDER} className="size-16 rounded-xl sm:size-20" />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg">
              {rooms.length}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ListingStatusBadge status="published" noun="property" />
              <ListingReferenceChip code="P90F93372" label="Propiedad" size="compact" />
              <ProposalBadge>Propiedad</ProposalBadge>
            </div>
            <h3 className="mt-2 text-base font-semibold leading-snug text-body sm:text-lg">
              Casa amplia en Mezquitán Country
            </h3>
            <p className="mt-1 text-xs text-muted">Providencia · Guadalajara</p>
            <p className="mt-2 text-sm text-body">
              <span className="font-semibold">{rooms.length} recámaras</span>
              <span className="text-muted">
                {" "}
                · {available} disponible{available === 1 ? "" : "s"} · {occupied} ocupada
                {occupied === 1 ? "" : "s"}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted">23 vistas · 3 mensajes (suma)</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/15"
          >
            Editar anuncio
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-body hover:bg-surface-elevated"
          >
            Ver publicación
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-bg-light px-4 text-sm font-semibold text-body hover:bg-surface-elevated"
          >
            <ChevronDown
              className={`size-4 transition ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
            {open ? "Ocultar recámaras" : `Ver ${rooms.length} recámaras`}
          </button>
        </div>
      </div>

      {open ? (
        <ul className="divide-y divide-border border-t border-border">
          {rooms.map((room) => (
            <li key={room.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <ListingThumb src={room.thumb} className="size-12 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-body">{room.name}</p>
                    <ListingStatusBadge status={room.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {room.occupied ? "Ocupada" : room.rentLabel} · {room.metrics}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary sm:min-h-9"
                >
                  Editar
                </button>
                <button
                  type="button"
                  aria-label="Más acciones"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-border sm:min-h-9 sm:min-w-9"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function HubComposition() {
  return (
    <div className="rounded-2xl border border-border bg-bg-light/50 p-3 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-primary sm:text-2xl">Mis anuncios</h3>
          <p className="mt-1 text-sm text-muted">1 publicado · 1 propiedad</p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg sm:flex-none">
            Publicar anuncio
          </span>
          <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border bg-surface">
            <RefreshCw className="size-4" aria-hidden />
          </span>
        </div>
      </div>
      <div className="mb-4 border-b border-border pb-3">
        <h4 className="text-lg font-semibold text-body">Publicados</h4>
        <p className="text-sm text-muted">Anuncios visibles para quienes buscan roomie.</p>
      </div>
      <div className="space-y-4">
        <ProposedSingleRoomCard room={MOCK_SINGLE} />
        <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} />
      </div>
    </div>
  );
}

function MobileFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="mx-auto w-full max-w-[24rem]">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div className="overflow-hidden rounded-2xl border border-border bg-bg-light shadow-sm md:rounded-[1.75rem] md:border-[6px] md:border-body/90 md:shadow-lg">
        <div className="hidden h-7 items-center justify-center bg-body/90 md:flex">
          <span className="h-1.5 w-16 rounded-full bg-surface/40" />
        </div>
        <div className="space-y-3 p-3 md:max-h-[36rem] md:overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function parseViewport(raw: string | null): Viewport | null {
  if (raw === "mobile" || raw === "desktop") return raw;
  return null;
}

export function MyListingsProposalMockupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramViewport = parseViewport(searchParams.get("v"));
  const [viewport, setViewport] = useState<Viewport>(() => {
    if (paramViewport) return paramViewport;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      return "mobile";
    }
    return "desktop";
  });

  useEffect(() => {
    if (paramViewport && paramViewport !== viewport) {
      setViewport(paramViewport);
    }
  }, [paramViewport, viewport]);

  useEffect(() => {
    if (paramViewport) return;
    const mq = window.matchMedia("(max-width: 767px)");
    function sync() {
      setViewport(mq.matches ? "mobile" : "desktop");
    }
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [paramViewport]);

  function chooseViewport(next: Viewport) {
    setViewport(next);
    setSearchParams(next === "mobile" ? { v: "mobile" } : { v: "desktop" }, { replace: true });
  }

  const isMobile = viewport === "mobile";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10 xl:max-w-6xl">
      <div className="rounded-2xl border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-body">
        <p className="font-semibold text-primary">Propuesta UX — no es la app real</p>
        <p className="mt-1 text-muted">
          Desktop:{" "}
          <Link to={MOCK_DESKTOP_PATH} className="font-semibold text-primary underline-offset-2 hover:underline">
            {MOCK_DESKTOP_PATH}
          </Link>
          <br className="sm:hidden" />
          <span className="hidden sm:inline"> · </span>
          Mobile:{" "}
          <Link to={MOCK_MOBILE_PATH} className="font-semibold text-primary underline-offset-2 hover:underline">
            {MOCK_MOBILE_PATH}
          </Link>
        </p>
        <p className="mt-2 text-muted">
          Live:{" "}
          <Link to="/mis-anuncios" className="font-semibold text-primary underline-offset-2 hover:underline">
            /mis-anuncios
          </Link>
          . Nada de esto está implementado en producción todavía.
        </p>
      </div>

      <div className="sticky top-0 z-[1200] -mx-4 mt-4 border-b border-border bg-bg-light/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-8 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="flex flex-wrap items-center gap-2">
          <p className="w-full text-sm font-medium text-body sm:w-auto">Vista del mockup</p>
          <button
            type="button"
            onClick={() => chooseViewport("desktop")}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold sm:flex-none ${
              !isMobile
                ? "bg-primary text-primary-fg"
                : "border border-border bg-surface text-body hover:bg-surface-elevated"
            }`}
          >
            <LayoutGrid className="size-4" aria-hidden />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => chooseViewport("mobile")}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold sm:flex-none ${
              isMobile
                ? "bg-primary text-primary-fg"
                : "border border-border bg-surface text-body hover:bg-surface-elevated"
            }`}
          >
            <Smartphone className="size-4" aria-hidden />
            Mobile
          </button>
        </div>
        {isMobile ? (
          <p className="mt-2 flex items-start gap-2 text-xs text-muted">
            <Home className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Modo mobile activo. En el teléfono abre{" "}
            <span className="break-all font-mono text-[11px] text-body">{MOCK_MOBILE_PATH}</span>
          </p>
        ) : null}
      </div>

      <header className="mt-6 sm:mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Mis anuncios · propuesta</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Menos ruido, más control por tipo de post
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Separar la presentación de posts de <strong className="text-body">cuarto</strong> y de{" "}
          <strong className="text-body">propiedad</strong>. Hoy ambos usan el mismo shell de
          propiedad + tabla de recámaras; eso sobra en single-room y abruma en multi-room.
        </p>
      </header>

      <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 text-sm sm:flex-wrap">
        <a href="#single-room" className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-medium text-body hover:bg-surface-elevated">
          1. Cuarto
        </a>
        <a href="#property" className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-medium text-body hover:bg-surface-elevated">
          2. Propiedad
        </a>
        <a href="#hub" className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-medium text-body hover:bg-surface-elevated">
          3. Hub
        </a>
        <a href="#decisions" className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-medium text-body hover:bg-surface-elevated">
          Decisiones
        </a>
      </nav>

      <div className="mt-6">
        <ProblemCallout />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-body">Principios</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          <li className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">01</p>
            <p className="mt-2 font-semibold text-body">Un objeto = una tarjeta</p>
            <p className="mt-1 text-sm text-muted">
              Si publicaste un cuarto, ves un anuncio. Si publicaste una casa con N recámaras, ves
              la propiedad.
            </p>
          </li>
          <li className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">02</p>
            <p className="mt-2 font-semibold text-body">Detalle bajo demanda</p>
            <p className="mt-1 text-sm text-muted">
              Las recámaras de una propiedad viven en un accordion colapsado. El default es escanear
              propiedades, no filas.
            </p>
          </li>
          <li className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">03</p>
            <p className="mt-2 font-semibold text-body">Acciones en el nivel correcto</p>
            <p className="mt-1 text-sm text-muted">
              Pausar/archivar propiedad en el shell. Editar/pausar recámara solo al expandir.
              Single-room: un solo set de acciones.
            </p>
          </li>
        </ol>
      </section>

      <section id="single-room" className="mt-10 scroll-mt-24 sm:scroll-mt-8">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-bold text-primary">1. Post de un solo cuarto</h2>
          <ProposalBadge>Cuarto</ProposalBadge>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Sin shell de propiedad. Una tarjeta plana: foto, título, renta, métricas y acciones.
        </p>

        {!isMobile ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Hoy (problema)</p>
              <CurrentSingleRoomPain />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Propuesta</p>
              <ProposedSingleRoomCard room={MOCK_SINGLE} />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-8">
            <MobileFrame label="Hoy">
              <CurrentSingleRoomPain />
            </MobileFrame>
            <MobileFrame label="Propuesta">
              <ProposedSingleRoomCard room={MOCK_SINGLE} />
            </MobileFrame>
          </div>
        )}
      </section>

      <section id="property" className="mt-14 scroll-mt-24 sm:scroll-mt-8">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-bold text-primary">2. Post de propiedad (multi-recámara)</h2>
          <ProposalBadge>Propiedad</ProposalBadge>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Shell compacto + accordion de recámaras{" "}
          <strong className="text-body">colapsado por defecto</strong>. Prueba el botón
          interactivo.
        </p>

        {!isMobile ? (
          <div className="mt-6 space-y-4">
            <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} />
            <p className="text-xs text-muted">Variante abierta (para comparar densidad):</p>
            <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} defaultOpen />
          </div>
        ) : (
          <div className="mt-6 grid gap-8">
            <MobileFrame label="Colapsado (default)">
              <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} />
            </MobileFrame>
            <MobileFrame label="Expandido">
              <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} defaultOpen />
            </MobileFrame>
          </div>
        )}
      </section>

      <section id="hub" className="mt-14 scroll-mt-24 sm:scroll-mt-8">
        <h2 className="text-xl font-bold text-primary">3. Cómo se ve el hub mezclado</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Misma sección Publicados: un cuarto + una propiedad colapsada.
        </p>
        <div className="mt-6">
          {!isMobile ? (
            <HubComposition />
          ) : (
            <MobileFrame label="Hub mobile">
              <HubComposition />
            </MobileFrame>
          )}
        </div>
      </section>

      <section id="decisions" className="mt-14 scroll-mt-24 sm:scroll-mt-8">
        <h2 className="text-lg font-semibold text-body">Decisiones a validar contigo</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Tema</th>
                <th className="px-4 py-3">Recomendación</th>
                <th className="px-4 py-3">Alternativa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-body">
              <tr>
                <td className="px-4 py-3 font-medium">Accordion default</td>
                <td className="px-4 py-3">Colapsado</td>
                <td className="px-4 py-3 text-muted">Abierto si ≤2 recámaras</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Badge de tipo</td>
                <td className="px-4 py-3">Cuarto / Propiedad</td>
                <td className="px-4 py-3 text-muted">Solo icono; sin texto</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Métricas propiedad</td>
                <td className="px-4 py-3">Suma de recámaras</td>
                <td className="px-4 py-3 text-muted">Solo en filas al expandir</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Pausar en single-room</td>
                <td className="px-4 py-3">Un botón Pausar</td>
                <td className="px-4 py-3 text-muted">Mantener “Pausar propiedad”</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium">Desktop rooms UI</td>
                <td className="px-4 py-3">Lista compacta</td>
                <td className="px-4 py-3 text-muted">Tabla solo al expandir</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-12 rounded-2xl border border-border bg-surface px-4 py-5 text-sm text-muted">
        <p className="font-semibold text-body">Siguiente paso</p>
        <p className="mt-1">
          Cuando apruebes esta dirección, implementamos en{" "}
          <code className="rounded bg-bg-light px-1.5 py-0.5 text-xs">/mis-anuncios</code> según{" "}
          <code className="rounded bg-bg-light px-1.5 py-0.5 text-xs">propertyPostMode</code>.
        </p>
        <p className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-4">
          <Link to={MOCK_MOBILE_PATH} className="font-semibold text-primary underline-offset-2 hover:underline">
            Abrir vista mobile
          </Link>
          <Link to="/mis-anuncios" className="font-semibold text-primary underline-offset-2 hover:underline">
            Volver a Mis anuncios (live)
          </Link>
        </p>
      </footer>
    </div>
  );
}
