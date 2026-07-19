import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ContactInlineAuth } from "@/components/contact/ContactInlineAuth";
import { AttachmentPicker } from "@/components/messaging/AttachmentPicker";
import { authMe, type AuthMe } from "@/lib/authApi";
import { consumeContactPendingDraft } from "@/lib/contactSupportSession";
import {
  startSupportConversation,
  uploadMessageAttachment,
  type MessageAttachment,
} from "@/lib/messagesApi";

const SUBJECT_MAX_LEN = 200;

export function ContactPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<MessageAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [sending, setSending] = useState(false);
  const [resumedNotice, setResumedNotice] = useState(false);
  const autoSendRef = useRef(false);

  const subjectRef = useRef(subject);
  const messageRef = useRef(message);
  const filesRef = useRef(files);
  const uploadedRef = useRef(uploadedAttachments);
  subjectRef.current = subject;
  messageRef.current = message;
  filesRef.current = files;
  uploadedRef.current = uploadedAttachments;

  const submitContact = useCallback(async () => {
    setSending(true);
    setSendError(null);
    try {
      const uploaded: MessageAttachment[] = [...uploadedRef.current];
      for (const file of filesRef.current) {
        uploaded.push(await uploadMessageAttachment(file));
      }
      const { conversationId } = await startSupportConversation({
        subject: subjectRef.current.trim(),
        body: messageRef.current.trim(),
        attachments: uploaded,
      });
      navigate(`/mensajes?c=${encodeURIComponent(conversationId)}`);
    } catch (x) {
      setSendError(x instanceof Error ? x.message : "No se pudo enviar tu mensaje. Intenta de nuevo.");
      setSending(false);
    }
  }, [navigate]);

  useEffect(() => {
    void authMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    const pending = consumeContactPendingDraft();
    const resume = searchParams.get("resume") === "1";
    if (pending) {
      setSubject(pending.subject);
      setMessage(pending.message);
      setUploadedAttachments(pending.attachments);
      setFiles([]);
      setResumedNotice(true);
      if (resume) autoSendRef.current = true;
    }
    if (resume) {
      const next = new URLSearchParams(searchParams);
      next.delete("resume");
      setSearchParams(next, { replace: true });
    }
    // Restore OAuth draft once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only
  }, []);

  useEffect(() => {
    if (!autoSendRef.current || me === undefined) return;
    if (!me) {
      autoSendRef.current = false;
      setShowAuth(true);
      return;
    }
    if (!subject.trim() || !message.trim()) {
      autoSendRef.current = false;
      return;
    }
    autoSendRef.current = false;
    void submitContact();
  }, [me, subject, message, submitContact]);

  const handleSendClick = () => {
    setFormError(null);
    setSendError(null);
    if (!subject.trim()) {
      setFormError("Escribe un asunto para tu mensaje.");
      return;
    }
    if (!message.trim()) {
      setFormError("Escribe tu mensaje.");
      return;
    }
    if (me === undefined) return;
    if (!me) {
      setShowAuth(true);
      return;
    }
    void submitContact();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-primary">Contacto</h1>
      <p className="mt-3 text-sm text-muted">
        ¿Problemas con la búsqueda, un anuncio o tu cuenta? Elige la opción que mejor se ajuste a tu caso.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-semibold text-body">Chat directo con Bestie</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Cuéntanos tu comentario, pregunta sobre el producto o solicitud. Inicia sesión para una
          respuesta personalizada: seguimos la conversación dentro de tu chat de Mensajes en Bestie. Las
          respuestas pueden tardar hasta 48 horas.
        </p>

        {resumedNotice ? (
          <p className="mt-3 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-xs text-body">
            Recuperamos tu asunto, mensaje
            {uploadedAttachments.length > 0
              ? ` y ${uploadedAttachments.length} imagen${uploadedAttachments.length > 1 ? "es" : ""}`
              : ""}
            .
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-body">
            Asunto
            <input
              type="text"
              value={subject}
              maxLength={SUBJECT_MAX_LEN}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Por ejemplo: Sugerencia para el buscador"
              disabled={sending}
              className="mt-1 w-full rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2 disabled:opacity-60"
            />
          </label>
          <label className="block text-sm font-medium text-body">
            Mensaje
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cuéntanos con detalle qué necesitas…"
              disabled={sending}
              className="mt-1 w-full resize-y rounded-xl border border-border bg-bg-light px-3 py-2 text-sm text-body outline-none ring-accent focus:ring-2 disabled:opacity-60"
            />
          </label>

          <AttachmentPicker
            files={files}
            onFilesChange={setFiles}
            uploadedAttachments={uploadedAttachments}
            onUploadedAttachmentsChange={setUploadedAttachments}
            disabled={sending}
            onError={setAttachError}
          />
          {attachError ? <p className="text-xs text-error">{attachError}</p> : null}

          {formError ? (
            <p className="text-sm text-error" role="alert">
              {formError}
            </p>
          ) : null}
          {sendError ? (
            <p className="text-sm text-error" role="alert">
              {sendError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={handleSendClick}
            disabled={sending}
            className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-fg transition hover:brightness-110 disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {sending ? "Enviando…" : "Enviar mensaje"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm font-medium text-body">Escríbenos por correo</p>
        <p className="mt-1 text-xs text-muted">Para cualquier otra consulta que no necesite chat.</p>
        <a
          href="mailto:contacto@bestie.mx?subject=Bestie%20—%20Contacto"
          className="mt-2 inline-block text-lg font-semibold text-primary underline-offset-2 hover:underline"
        >
          contacto@bestie.mx
        </a>
        <p className="mt-2 text-xs text-muted">
          Asegúrate de que el dominio <span className="font-medium">bestie.mx</span> esté permitido en tu
          bandeja si usas filtros de spam.
        </p>
      </div>

      <p className="mt-8 text-sm text-muted">
        <Link to="/buscar" className="font-semibold text-primary underline-offset-2 hover:underline">
          Volver a buscar
        </Link>
      </p>

      {showAuth && !me ? (
        <ContactInlineAuth
          subject={subject}
          message={message}
          files={files}
          uploadedAttachments={uploadedAttachments}
          onClose={() => setShowAuth(false)}
          onAuthenticated={(nextMe) => {
            setMe(nextMe);
            setShowAuth(false);
            void submitContact();
          }}
        />
      ) : null}
    </div>
  );
}
