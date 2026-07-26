import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { listingPublicPath } from "@/lib/listingReference";
import { AttachmentPicker } from "@/components/messaging/AttachmentPicker";
import { MessageAttachmentList } from "@/components/messaging/MessageAttachmentList";
import { MyListingsReturnLink } from "@/components/myListings/MyListingsReturnLink";
import { UserAvatar } from "@/components/UserAvatar";
import {
  formatRelativeUpdatedAt,
  sortUserConversations,
  USER_CONVERSATION_SORT_OPTIONS,
  type UserConversationSortKey,
} from "@/lib/conversationInbox";
import {
  fetchConversationMessages,
  fetchConversations,
  postConversationMessage,
  uploadMessageAttachment,
  type ChatMessage,
  type ConversationSummary,
  type MessageAttachment,
} from "@/lib/messagesApi";
import {
  buildMyListingsRestorePath,
  readMyListingsReturn,
} from "@/lib/myListingsReturn";
import { authMe, type AuthMe } from "@/lib/authApi";

function SupportBadge() {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
      Soporte
    </span>
  );
}

const AVATAR_SIZE = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
} as const;

/** Profile photo / initials, or Bestie mark for Soporte threads. */
function ParticipantAvatar({
  displayName,
  profilePictureUrl,
  useSupportMark = false,
  size = "sm",
  className = "",
}: {
  displayName?: string | null;
  profilePictureUrl?: string | null;
  useSupportMark?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  if (useSupportMark) {
    return (
      <span
        aria-hidden
        className={[
          "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-border",
          AVATAR_SIZE[size],
          className,
        ].join(" ")}
      >
        <img src="/brand/logo-mark.svg" alt="" className="h-[70%] w-[70%] object-contain" />
      </span>
    );
  }
  return (
    <UserAvatar
      displayName={displayName}
      profilePictureUrl={profilePictureUrl}
      size={size}
      className={className}
    />
  );
}

function messageDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatThreadDayLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("es-MX", { day: "numeric", month: "long" })
    .toUpperCase();
}

function formatThreadTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessagesPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get("c");
  const qParam = searchParams.get("q") ?? "";
  const myListingsRestorePath = useMemo(() => {
    const ctx = readMyListingsReturn(location.state);
    return ctx ? buildMyListingsRestorePath(ctx) : null;
  }, [location.state]);
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [rows, setRows] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachFiles, setAttachFiles] = useState<File[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [searchInput, setSearchInput] = useState(() => qParam);
  const [debouncedSearch, setDebouncedSearch] = useState(() => qParam.trim());
  const [sortKey, setSortKey] = useState<UserConversationSortKey>("updated");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const listSeqRef = useRef(0);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const lastSeededQRef = useRef<string | null>(qParam || null);

  const loadMe = useCallback(async () => {
    setMe(await authMe().catch(() => null));
  }, []);

  const loadList = useCallback(async (q?: string) => {
    const seq = ++listSeqRef.current;
    try {
      setLoadingList(true);
      const next = await fetchConversations({ q });
      if (seq !== listSeqRef.current) return;
      setRows((prev) => {
        // Preserve a cleared unread chip if the active thread was opened while this list was in flight.
        if (!activeIdRef.current) return next;
        return next.map((row) => {
          if (row.id !== activeIdRef.current) return row;
          const prevRow = prev.find((p) => p.id === row.id);
          if (prevRow && prevRow.unreadCount === 0) return { ...row, unreadCount: 0 };
          return row;
        });
      });
    } catch (x) {
      if (seq !== listSeqRef.current) return;
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
      setRows([]);
    } finally {
      if (seq === listSeqRef.current) setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async () => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    try {
      setLoadingThread(true);
      const { messages: nextMessages, unreadCount } = await fetchConversationMessages(activeId);
      setMessages(nextMessages);
      setRows((prev) =>
        prev.map((row) => (row.id === activeId ? { ...row, unreadCount: 0 } : row)),
      );
      window.dispatchEvent(
        new CustomEvent("bestie:messages-read-changed", { detail: { unreadCount } }),
      );
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, [activeId]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  // Seed / refresh the search bar when arriving from Mis Anuncios (`?q=title id`).
  useEffect(() => {
    if (qParam === lastSeededQRef.current) return;
    lastSeededQRef.current = qParam;
    setSearchInput(qParam);
    setDebouncedSearch(qParam.trim());
    if (qParam.trim()) setFiltersOpen(true);
  }, [qParam]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // Keep `?q=` in sync with the search bar so clearing it restores the full inbox.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (debouncedSearch === current) return;
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch) next.set("q", debouncedSearch);
    else next.delete("q");
    lastSeededQRef.current = debouncedSearch;
    setSearchParams(next, { replace: true, state: location.state });
  }, [debouncedSearch, location.state, searchParams, setSearchParams]);

  useEffect(() => {
    if (me?.id) void loadList(debouncedSearch || undefined);
  }, [me, loadList, debouncedSearch]);

  useEffect(() => {
    void loadThread();
    setDraft("");
    setAttachFiles([]);
    setAttachError(null);
  }, [loadThread]);

  useEffect(() => {
    if (!activeId || !me?.id) return;
    const t = window.setInterval(() => void loadThread(), 12_000);
    return () => window.clearInterval(t);
  }, [activeId, me?.id, loadThread]);

  const sortedRows = useMemo(() => sortUserConversations(rows, sortKey), [rows, sortKey]);
  const active = useMemo(() => rows.find((r) => r.id === activeId), [rows, activeId]);
  const isSupportThread = active?.kind === "support";

  const clearActive = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("c");
    setSearchParams(next, { replace: false, state: location.state });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || (!draft.trim() && attachFiles.length === 0)) return;
    setErr(null);
    setSendingMessage(true);
    try {
      const attachments: MessageAttachment[] = [];
      for (const file of attachFiles) {
        attachments.push(await uploadMessageAttachment(file));
      }
      await postConversationMessage(activeId, draft.trim(), attachments);
      setDraft("");
      setAttachFiles([]);
      await loadThread();
      await loadList(debouncedSearch || undefined);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo completar la acción.");
    } finally {
      setSendingMessage(false);
    }
  };

  if (me === undefined) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-sm text-muted">Cargando…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-primary">Mensajes</h1>
        <p className="mt-2 text-sm text-muted">Inicia sesión para ver tus conversaciones.</p>
        <Link to="/entrar" className="mt-6 inline-block text-sm font-semibold text-primary underline">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6">
      {myListingsRestorePath ? (
        <MyListingsReturnLink to={myListingsRestorePath} placement="top" />
      ) : null}
      <header className={activeId ? "hidden md:block" : undefined}>
        <h1 className="text-2xl font-bold text-primary">Mensajes</h1>
        <p className="mt-1 text-sm text-muted">
          Conversaciones agrupadas por anuncio, más tu chat con Soporte de Bestie si nos escribiste desde
          Contacto.
        </p>
      </header>

      {err ? (
        <p className="rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error" role="alert">
          {err}
        </p>
      ) : null}

      <div className="grid min-h-[min(70vh,640px)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <aside
          className={`flex min-h-0 flex-col rounded-2xl border border-border bg-surface p-3 shadow-sm dark:border-slate-600 dark:bg-slate-900 ${
            activeId ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Conversaciones</h2>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              aria-expanded={filtersOpen}
            >
              {filtersOpen ? "Ocultar filtros" : "Buscar y ordenar"}
            </button>
          </div>

          {filtersOpen ? (
            <div className="mt-3 space-y-2 border-b border-border px-1 pb-3 dark:border-slate-600">
              <label className="block">
                <span className="sr-only">Buscar conversaciones</span>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar por título, código o mensajes…"
                  className="min-h-11 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2 dark:border-slate-600 dark:bg-slate-800"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Ordenar
                </span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as UserConversationSortKey)}
                  className="min-h-11 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm outline-none ring-accent focus:ring-2 dark:border-slate-600 dark:bg-slate-800"
                >
                  {USER_CONVERSATION_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {loadingList ? (
            <p className="p-3 text-sm text-muted">Cargando…</p>
          ) : sortedRows.length === 0 ? (
            <p className="p-3 text-sm text-muted">
              {debouncedSearch
                ? "No hay conversaciones que coincidan con tu búsqueda."
                : "Aún no tienes mensajes. Abre un anuncio y usa “Mensaje al anunciante”."}
            </p>
          ) : (
            <ul className="mt-2 min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto dark:divide-slate-600/60 md:max-h-[70vh]">
              {sortedRows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.set("c", r.id);
                      setSearchParams(next, { replace: false, state: location.state });
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                      r.id === activeId ? "bg-secondary/15 ring-1 ring-secondary/40" : "hover:bg-surface-elevated"
                    }`}
                  >
                    <ParticipantAvatar
                      displayName={r.otherDisplayName}
                      profilePictureUrl={r.otherProfilePictureUrl}
                      useSupportMark={r.kind === "support"}
                      size="sm"
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-body">
                          <span className="truncate">{r.otherDisplayName}</span>
                          {r.kind === "support" ? <SupportBadge /> : null}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted">
                          {formatRelativeUpdatedAt(r.updatedAt)}
                        </span>
                      </span>
                      <span className="line-clamp-1 text-xs text-muted">{r.contextTitle}</span>
                      {r.lastPreview ? (
                        <span className="line-clamp-1 text-xs text-muted">{r.lastPreview}</span>
                      ) : null}
                      {r.unreadCount > 0 ? (
                        <span className="mt-1 inline-flex w-fit rounded-full bg-error px-2 py-0.5 text-[10px] font-bold text-white">
                          {r.unreadCount} nuevo{r.unreadCount > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section
          className={`min-h-[min(70vh,640px)] flex-col rounded-2xl border border-border bg-surface shadow-sm dark:border-slate-600 dark:bg-slate-900 ${
            activeId ? "flex" : "hidden md:flex"
          }`}
        >
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
              Elige una conversación a la izquierda.
            </div>
          ) : (
            <>
              <div className="border-b border-border bg-primary px-4 py-3 text-primary-fg dark:border-slate-600">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={clearActive}
                    className="mt-0.5 shrink-0 rounded-full border border-primary-fg/30 px-3 py-1 text-xs font-semibold text-primary-fg md:hidden"
                  >
                    Volver
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-primary-fg/80">
                      {isSupportThread ? "Asunto" : "Publicación"}
                    </p>
                    <p className="text-sm font-semibold">{active?.contextTitle ?? "…"}</p>
                    <p className="mt-0.5 truncate text-xs text-primary-fg/80">{active?.otherDisplayName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {active?.listingRoomId ? (
                        <Link
                          to={listingPublicPath(active.listingRoomId)}
                          className="text-xs font-semibold underline"
                        >
                          Ver anuncio
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {isSupportThread ? (
                <p className="border-b border-secondary/40 bg-secondary/10 px-4 py-2 text-xs text-body">
                  Soporte de Bestie · las respuestas pueden tardar hasta 48 horas.
                </p>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-[200px] flex-1 space-y-4 overflow-y-auto p-4">
                  {loadingThread ? (
                    <p className="text-sm text-muted">Cargando mensajes…</p>
                  ) : (
                    messages.map((m, index) => {
                      const mine = m.senderUserId === me.id;
                      const otherIsSupport = Boolean(isSupportThread && !mine);
                      const displayName = mine
                        ? me.displayName
                        : (active?.otherDisplayName ?? "Usuario");
                      const showDay =
                        index === 0 ||
                        messageDayKey(m.createdAt) !== messageDayKey(messages[index - 1]!.createdAt);
                      return (
                        <div key={m.id}>
                          {showDay ? (
                            <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                              {formatThreadDayLabel(m.createdAt)}
                            </p>
                          ) : null}
                          <article
                            className={`flex items-start gap-3 ${mine ? "flex-row-reverse" : ""}`}
                          >
                            <ParticipantAvatar
                              displayName={displayName}
                              profilePictureUrl={
                                mine ? me.profilePictureUrl : active?.otherProfilePictureUrl
                              }
                              useSupportMark={otherIsSupport}
                              size="sm"
                            />
                            <div className={`min-w-0 max-w-[85%] ${mine ? "text-right" : ""}`}>
                              <header
                                className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${
                                  mine ? "justify-end" : ""
                                }`}
                              >
                                {mine ? (
                                  <>
                                    <time dateTime={m.createdAt} className="text-xs text-muted">
                                      {formatThreadTime(m.createdAt)}
                                    </time>
                                    <span className="text-xs text-muted" aria-hidden>
                                      ·
                                    </span>
                                    <span className="text-sm font-semibold text-body">{displayName}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-sm font-semibold text-body">{displayName}</span>
                                    {otherIsSupport ? <SupportBadge /> : null}
                                    <span className="text-xs text-muted" aria-hidden>
                                      ·
                                    </span>
                                    <time dateTime={m.createdAt} className="text-xs text-muted">
                                      {formatThreadTime(m.createdAt)}
                                    </time>
                                  </>
                                )}
                              </header>
                              {m.body || m.attachments.length > 0 ? (
                                <div
                                  className={`mt-1 inline-block max-w-full rounded-2xl px-3 py-2 text-left ${
                                    mine
                                      ? "rounded-tr-sm bg-secondary text-primary"
                                      : "rounded-tl-sm bg-surface-elevated text-body dark:bg-slate-700 dark:text-slate-100"
                                  }`}
                                >
                                  {m.body ? (
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                      {m.body}
                                    </p>
                                  ) : null}
                                  <MessageAttachmentList attachments={m.attachments} />
                                </div>
                              ) : null}
                            </div>
                          </article>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={send} className="border-t border-border bg-bg-light p-3 dark:border-slate-600 dark:bg-slate-800">
                  <label className="sr-only" htmlFor="msg-body">
                    Mensaje
                  </label>
                  <div className="flex gap-2">
                    <textarea
                      id="msg-body"
                      rows={2}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Escribe un mensaje…"
                      disabled={sendingMessage}
                      className="min-h-[44px] flex-1 resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={sendingMessage || (!draft.trim() && attachFiles.length === 0)}
                      className="shrink-0 self-end rounded-full bg-secondary px-4 py-2 text-sm font-bold text-primary disabled:opacity-40"
                    >
                      {sendingMessage ? "Enviando…" : "Enviar"}
                    </button>
                  </div>
                  {isSupportThread ? (
                    <>
                      <AttachmentPicker
                        files={attachFiles}
                        onFilesChange={setAttachFiles}
                        disabled={sendingMessage}
                        onError={setAttachError}
                        className="mt-2"
                      />
                      {attachError ? <p className="mt-1 text-xs text-error">{attachError}</p> : null}
                    </>
                  ) : null}
                </form>
                <div className="border-t border-border p-3 md:hidden dark:border-slate-600">
                  <button
                    type="button"
                    onClick={clearActive}
                    className="w-full min-h-11 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-body hover:bg-surface-elevated"
                  >
                    Volver
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <p className={`text-center text-xs text-muted ${activeId ? "hidden md:block" : ""}`}>
        <button
          type="button"
          className="font-semibold text-primary underline"
          onClick={() => void loadList(debouncedSearch || undefined)}
        >
          Actualizar lista
        </button>
        {" · "}
        <Link to="/buscar" className="font-semibold text-primary underline">
          Buscar
        </Link>
      </p>
    </div>
  );
}
