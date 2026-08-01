import { useCallback, useEffect, useRef, useState } from "react";
import { ContactInlineAuth } from "@/components/contact/ContactInlineAuth";
import { AttachmentPicker } from "@/components/messaging/AttachmentPicker";
import { authMe, type AuthMe } from "@/lib/authApi";
import { consumeContactPendingDraft } from "@/lib/contactSupportSession";
import {
  startSupportConversation,
  uploadMessageAttachment,
  type MessageAttachment,
} from "@/lib/messagesApi";

export const SUPPORT_SUBJECT_MAX_LEN = 200;

type Props = {
  oauthReturnTo: string;
  /** When true, restore an OAuth draft and auto-send once signed in. */
  autoResume?: boolean;
  onSuccess: (conversationId: string) => void;
  /** Optional class on the outer form stack (modal may tighten spacing). */
  className?: string;
};

/**
 * Shared Contacto support chat form: asunto, mensaje, adjuntos,
 * guest auth gate, and support-conversation submit.
 */
export function ContactSupportForm({
  oauthReturnTo,
  autoResume = false,
  onSuccess,
  className = "",
}: Props) {
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
  const [postLoginSend, setPostLoginSend] = useState(false);
  const autoSendRef = useRef(false);
  const resumedRef = useRef(false);

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
      onSuccess(conversationId);
    } catch (x) {
      setSendError(x instanceof Error ? x.message : "No se pudo enviar tu mensaje. Intenta de nuevo.");
      setSending(false);
      setPostLoginSend(false);
    }
  }, [onSuccess]);

  useEffect(() => {
    void authMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!autoResume || resumedRef.current) return;
    resumedRef.current = true;
    const pending = consumeContactPendingDraft();
    if (!pending) return;
    subjectRef.current = pending.subject;
    messageRef.current = pending.message;
    uploadedRef.current = pending.attachments;
    filesRef.current = [];
    setSubject(pending.subject);
    setMessage(pending.message);
    setUploadedAttachments(pending.attachments);
    setFiles([]);
    autoSendRef.current = true;
    setPostLoginSend(true);
    setSending(true);
  }, [autoResume]);

  useEffect(() => {
    if (!autoSendRef.current || me === undefined) return;
    if (!me) {
      autoSendRef.current = false;
      setPostLoginSend(false);
      setSending(false);
      setShowAuth(true);
      return;
    }
    if (!subjectRef.current.trim() || !messageRef.current.trim()) {
      autoSendRef.current = false;
      setPostLoginSend(false);
      setSending(false);
      return;
    }
    autoSendRef.current = false;
    void submitContact();
  }, [me, submitContact]);

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

  if (postLoginSend) {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <p className="text-lg font-semibold text-primary">Enviando tu mensaje…</p>
        <p className="mt-2 text-sm text-muted">Un momento, por favor.</p>
        {sendError ? (
          <div className="mt-6 w-full">
            <p className="rounded-xl border border-error/30 bg-error/5 p-3 text-sm text-error" role="alert">
              {sendError}
            </p>
            <button
              type="button"
              onClick={() => {
                setPostLoginSend(false);
                setSendError(null);
              }}
              className="mt-4 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-body hover:bg-surface-elevated"
            >
              Volver al formulario
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="ph-no-capture space-y-3">
        <label className="block text-sm font-medium text-body">
          Asunto
          <input
            type="text"
            value={subject}
            maxLength={SUPPORT_SUBJECT_MAX_LEN}
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

      {showAuth && !me ? (
        <ContactInlineAuth
          subject={subject}
          message={message}
          files={files}
          uploadedAttachments={uploadedAttachments}
          oauthReturnTo={oauthReturnTo}
          onClose={() => setShowAuth(false)}
          onAuthenticated={(nextMe) => {
            setMe(nextMe);
            setShowAuth(false);
            setPostLoginSend(true);
            void submitContact();
          }}
        />
      ) : null}
    </div>
  );
}
