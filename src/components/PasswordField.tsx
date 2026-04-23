import { useState, type InputHTMLAttributes } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

function PasswordToggleIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.6 10.6a2 2 0 102.8 2.8M9.9 5.2A10.7 10.7 0 0112 5c5.2 0 8.9 4.2 10 7-.4 1-1.3 2.5-2.8 3.8M6.1 6.1C4 7.5 2.6 9.7 2 12c.7 2.1 2.9 4.9 6.4 6.3A11.3 11.3 0 0012 19c1.1 0 2.1-.1 3-.4"
      />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2 12c1.1-2.8 4.8-7 10-7s8.9 4.2 10 7c-1.1 2.8-4.8 7-10 7S3.1 14.8 2 12z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function PasswordField({ className = "", disabled, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} disabled={disabled} className={`${className} pr-11`} />
      <button
        type="button"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted transition hover:text-body focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PasswordToggleIcon visible={visible} />
      </button>
    </div>
  );
}
