import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  fetchConversationMessages,
  fetchConversations,
  postConversationMessage,
  type ChatMessage,
  type ConversationSummary,
} from "@/lib/messagesApi";
import { authMe, type AuthMe } from "@/lib/authApi";

export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get("c");
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [rows, setRows] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);

  const loadMe = useCallback(async () => {
    setMe(await authMe().catch(() => null));
  }, []);

  const loadList = useCallback(async () => {
    try {
      setLoadingList(true);
      setRows(await fetchConversations());
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
      setRows([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async () => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    try {
      setLoadingThread(true);
      setMessages(await fetchConversationMessages(activeId));
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, [activeId]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (me?.id) void loadList();
  }, [me, loadList]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (!activeId || !me?.id) return;
    const t = window.setInterval(() => void loadThread(), 12_000);
    return () => window.clearInterval(t);
  }, [activeId, me?.id, loadThread]);

  const active = useMemo(() => rows.find((r) => r.id === activeId), [rows, activeId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !draft.trim()) return;
    setErr(null);
    try {
      await postConversationMessage(activeId, draft.trim());
      setDraft("");
      await loadThread();
      await loadList();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Error");
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
      <header>
        <h1 className="text-2xl font-bold text-primary">Mensajes</h1>
        <p className="mt-1 text-sm text-muted">
          Conversaciones por anuncio (estilo Roomix). Los mensajes se guardan en Bestie; el anunciante debe tener
          cuenta vinculada a la publicación.
        </p>
      </header>

      {err ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {err}
        </p>
      ) : null}

      <div className="grid min-h-[420px] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <aside className="rounded-2xl border border-border bg-surface p-3 shadow-sm dark:border-slate-600 dark:bg-slate-900">
          <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">Conversaciones</h2>
          {loadingList ? (
            <p className="p-3 text-sm text-muted">Cargando…</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted">Aún no tienes mensajes. Abre un anuncio y usa “Mensaje al anunciante”.</p>
          ) : (
            <ul className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto md:max-h-[70vh]">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchParams({ c: r.id }, { replace: false });
                    }}
                    className={`flex w-full flex-col rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      r.id === activeId ? "bg-secondary/15 ring-1 ring-secondary/40" : "hover:bg-surface-elevated"
                    }`}
                  >
                    <span className="font-semibold text-body">{r.otherDisplayName}</span>
                    <span className="line-clamp-1 text-xs text-muted">{r.contextTitle}</span>
                    {r.lastPreview ? (
                      <span className="line-clamp-1 text-xs text-muted">{r.lastPreview}</span>
                    ) : null}
                    {r.unreadCount > 0 ? (
                      <span className="mt-1 inline-flex w-fit rounded-full bg-error px-2 py-0.5 text-[10px] font-bold text-white">
                        {r.unreadCount} nuevo{r.unreadCount > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="flex min-h-[420px] flex-col rounded-2xl border border-border bg-surface shadow-sm dark:border-slate-600 dark:bg-slate-900">
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
              Elige una conversación a la izquierda.
            </div>
          ) : (
            <>
              <div className="border-b border-border bg-primary px-4 py-3 text-primary-fg dark:border-slate-600">
                <p className="text-xs font-medium uppercase tracking-wide text-primary-fg/80">Publicación</p>
                <p className="text-sm font-semibold">{active?.contextTitle ?? "…"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {active?.listingRoomId ? (
                    <Link
                      to={`/anuncio/${encodeURIComponent(active.listingRoomId)}`}
                      className="text-xs font-semibold underline"
                    >
                      Ver anuncio
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto p-4">
                  {loadingThread ? (
                    <p className="text-sm text-muted">Cargando mensajes…</p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.senderUserId === me.id;
                      return (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? "ml-auto bg-primary text-primary-fg"
                              : "mr-auto border border-border bg-bg-light text-body dark:border-slate-600 dark:bg-slate-800"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{m.body}</p>
                          <p className={`mt-1 text-[10px] ${mine ? "text-primary-fg/70" : "text-muted"}`}>
                            {new Date(m.createdAt).toLocaleString("es-MX", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
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
                      className="min-h-[44px] flex-1 resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none ring-accent focus:ring-2 dark:border-slate-600 dark:bg-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      className="shrink-0 self-end rounded-full bg-secondary px-4 py-2 text-sm font-bold text-primary disabled:opacity-40"
                    >
                      Enviar
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}
        </section>
      </div>

      <p className="text-center text-xs text-muted">
        <button type="button" className="font-semibold text-primary underline" onClick={() => void loadList()}>
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
