import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Archive,
  ChevronDown,
  Eye,
  LayoutGrid,
  Pause,
  Pencil,
  RefreshCw,
  Share2,
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

/**
 * Fixed collapsed-card height so Cuarto and Propiedad match
 * (single-room may show empty space).
 */
const CARD_SHELL =
  "flex h-[14.5rem] flex-col justify-between gap-3 p-4 sm:h-[13.75rem]";

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
type CardTone = "room" | "property";

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

function toneShell(tone: CardTone): string {
  // Same gray-green wash for both; accent stripe + UI chrome differ by type.
  const base = "border-primary/40 bg-primary/[0.04]";
  return tone === "property"
    ? `${base} border-l-primary`
    : `${base} border-l-secondary`;
}

function ProposalBadge({ children, tone }: { children: string; tone: CardTone }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        tone === "property"
          ? "bg-primary text-primary-fg"
          : "bg-secondary text-primary"
      }`}
    >
      {children}
    </span>
  );
}

function IconAction({
  label,
  onClick,
  tone,
  children,
}: {
  label: string;
  onClick?: () => void;
  tone: CardTone;
  children: ReactNode;
}) {
  const ring =
    tone === "property"
      ? "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
      : "border-secondary/40 bg-secondary/20 text-primary hover:bg-secondary/30";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border transition ${ring}`}
    >
      {children}
    </button>
  );
}

/** All listing actions visible — nothing tucked under “…”. */
function ListingActionRow({
  tone,
  onToggleRooms,
  roomsOpen,
  roomCount,
}: {
  tone: CardTone;
  onToggleRooms?: () => void;
  roomsOpen?: boolean;
  roomCount?: number;
}) {
  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      <IconAction label="Editar" tone={tone}>
        <Pencil className="size-4" aria-hidden />
      </IconAction>
      <IconAction label="Ver publicación" tone={tone}>
        <Eye className="size-4" aria-hidden />
      </IconAction>
      <IconAction label="Pausar" tone={tone}>
        <Pause className="size-4" aria-hidden />
      </IconAction>
      <IconAction label="Compartir" tone={tone}>
        <Share2 className="size-4" aria-hidden />
      </IconAction>
      <IconAction label="Archivar" tone={tone}>
        <Archive className="size-4" aria-hidden />
      </IconAction>
      {onToggleRooms ? (
        <IconAction
          label={roomsOpen ? "Ocultar recámaras" : `Ver ${roomCount ?? ""} recámaras`}
          tone={tone}
          onClick={onToggleRooms}
        >
          <ChevronDown
            className={`size-4 transition ${roomsOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </IconAction>
      ) : null}
    </div>
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

/** Proposed flat single-room card — lime accents, same gray wash as property. */
function ProposedSingleRoomCard({ room }: { room: MockRoom }) {
  const tone: CardTone = "room";
  return (
    <article className={`rounded-2xl border border-l-4 shadow-sm ${toneShell(tone)}`}>
      <div className={CARD_SHELL}>
        <div className="flex min-h-0 min-w-0 flex-1 gap-3">
          <ListingThumb src={room.thumb} className="size-16 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <ListingStatusBadge status={room.status} />
              <ListingReferenceChip code={room.id} label="Anuncio" size="compact" />
              <ProposalBadge tone={tone}>Cuarto</ProposalBadge>
            </div>
            <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-body">
              {room.name}
            </h3>
            <p className="mt-1 text-xs text-muted">Providencia · Guadalajara</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {room.rentLabel ? (
                <span className="text-sm font-semibold text-body">{room.rentLabel}</span>
              ) : null}
              <span className="text-xs text-muted">{room.metrics}</span>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <ListingActionRow tone={tone} />
        </div>
      </div>
    </article>
  );
}

/** Proposed compact property — forest accents; same fixed shell height when collapsed. */
function ProposedPropertyCard({
  rooms,
  defaultOpen = false,
}: {
  rooms: MockRoom[];
  defaultOpen?: boolean;
}) {
  const tone: CardTone = "property";
  const [open, setOpen] = useState(defaultOpen);
  const available = rooms.filter((r) => !r.occupied).length;
  const occupied = rooms.length - available;

  return (
    <section className={`rounded-2xl border border-l-4 shadow-sm ${toneShell(tone)}`}>
      <div className={CARD_SHELL}>
        <div className="flex min-h-0 min-w-0 flex-1 gap-3">
          <div className="relative shrink-0">
            <ListingThumb src={PLACEHOLDER} className="size-16 rounded-xl" />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-fg">
              {rooms.length}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <ListingStatusBadge status="published" noun="property" />
              <ListingReferenceChip code="P90F93372" label="Propiedad" size="compact" />
              <ProposalBadge tone={tone}>Propiedad</ProposalBadge>
            </div>
            <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-body">
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

        <div className="shrink-0">
          <ListingActionRow
            tone={tone}
            roomCount={rooms.length}
            roomsOpen={open}
            onToggleRooms={() => setOpen((v) => !v)}
          />
        </div>
      </div>

      {open ? (
        <ul className="divide-y divide-border border-t border-primary/20">
          {rooms.map((room) => (
            <li key={room.id} className="flex items-center gap-3 px-4 py-3">
              <ListingThumb src={room.thumb} className="size-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-body">{room.name}</p>
                  <ListingStatusBadge status={room.status} />
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {room.occupied ? "Ocupada" : room.rentLabel} · {room.metrics}
                </p>
              </div>
              <ListingActionRow tone={tone} />
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
      <p className="mt-3 text-xs text-muted">
        Mismo fondo gris. Acento: <span className="font-semibold text-secondary">lima</span> =
        cuarto · <span className="font-semibold text-primary">forest</span> = propiedad. Misma
        altura fija (colapsada). Hover en iconos = etiqueta.
      </p>
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
      </div>

      <header className="mt-6 sm:mt-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Mis anuncios · propuesta</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          Menos ruido, más control por tipo de post
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Misma altura y mismo fondo gris. Acentos:{" "}
          <span className="font-semibold text-secondary">lima</span> = cuarto ·{" "}
          <span className="font-semibold text-primary">forest</span> = propiedad. Desktop y mobile =
          mismos iconos (hover = etiqueta). Sin menú “…”.
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
        <a href="#size-compare" className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 font-medium text-body hover:bg-surface-elevated">
          Tamaño
        </a>
      </nav>

      <div className="mt-6">
        <ProblemCallout />
      </div>

      <section id="size-compare" className="mt-10 scroll-mt-24 sm:scroll-mt-8">
        <h2 className="text-lg font-semibold text-body">Misma altura · acento distinto</h2>
        <p className="mt-1 text-sm text-muted">
          Lado a lado (colapsada). Altura fija idéntica; el cuarto puede dejar espacio vacío.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 md:items-start">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
              Cuarto · lima
            </p>
            <ProposedSingleRoomCard room={MOCK_SINGLE} />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
              Propiedad · forest
            </p>
            <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} />
          </div>
        </div>
      </section>

      <section id="single-room" className="mt-14 scroll-mt-24 sm:scroll-mt-8">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-bold text-primary">1. Post de un solo cuarto</h2>
          <ProposalBadge tone="room">Cuarto</ProposalBadge>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Sin shell de propiedad. Fondo gris igual a propiedad; acentos lima. Todas las acciones
          visibles como iconos.
        </p>

        {!isMobile ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Hoy (problema)</p>
              <CurrentSingleRoomPain />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">Propuesta</p>
              <ProposedSingleRoomCard room={MOCK_SINGLE} />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-8">
            <MobileFrame label="Hoy">
              <CurrentSingleRoomPain />
            </MobileFrame>
            <MobileFrame label="Propuesta · iconos">
              <ProposedSingleRoomCard room={MOCK_SINGLE} />
            </MobileFrame>
          </div>
        )}
      </section>

      <section id="property" className="mt-14 scroll-mt-24 sm:scroll-mt-8">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-bold text-primary">2. Post de propiedad</h2>
          <ProposalBadge tone="property">Propiedad</ProposalBadge>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Acento forest. Accordion colapsado por defecto. Misma altura fija que el post de cuarto.
        </p>

        {!isMobile ? (
          <div className="mt-6 space-y-4">
            <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} />
            <p className="text-xs text-muted">Variante abierta:</p>
            <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} defaultOpen />
          </div>
        ) : (
          <div className="mt-6 grid gap-8">
            <MobileFrame label="Colapsado · iconos">
              <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} />
            </MobileFrame>
            <MobileFrame label="Expandido">
              <ProposedPropertyCard rooms={MOCK_PROPERTY_ROOMS} defaultOpen />
            </MobileFrame>
          </div>
        )}
      </section>

      <section id="hub" className="mt-14 scroll-mt-24 sm:scroll-mt-8">
        <h2 className="text-xl font-bold text-primary">3. Hub mezclado</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Un cuarto (lima) + una propiedad colapsada (forest), misma altura y mismo fondo.
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

      <footer className="mt-12 rounded-2xl border border-border bg-surface px-4 py-5 text-sm text-muted">
        <p className="font-semibold text-body">Siguiente paso</p>
        <p className="mt-1">
          Cuando apruebes, implementamos en{" "}
          <code className="rounded bg-bg-light px-1.5 py-0.5 text-xs">/mis-anuncios</code>.
        </p>
        <p className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-4">
          <Link to={MOCK_MOBILE_PATH} className="font-semibold text-primary underline-offset-2 hover:underline">
            Abrir vista mobile
          </Link>
          <Link to={MOCK_DESKTOP_PATH} className="font-semibold text-primary underline-offset-2 hover:underline">
            Abrir vista desktop
          </Link>
          <Link to="/mis-anuncios" className="font-semibold text-primary underline-offset-2 hover:underline">
            Mis anuncios (live)
          </Link>
        </p>
      </footer>
    </div>
  );
}
