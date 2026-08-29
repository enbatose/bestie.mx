import { looksLikePhoneInput } from "@/lib/authIdentifier";

const INPUT_CLASS =
  "mt-1 w-full min-w-0 rounded-xl border border-border bg-bg-light px-3 py-2 text-base text-body outline-none ring-accent focus:ring-2 sm:text-sm";

type Props = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete?: string;
  className?: string;
};

export function AuthIdentifierField({
  id,
  value,
  onChange,
  autoComplete = "username",
  className,
}: Props) {
  const phoneish = looksLikePhoneInput(value);
  return (
    <label className={`block min-w-0 text-sm font-medium text-body ${className ?? ""}`} htmlFor={id}>
      Correo o celular
      <input
        id={id}
        type="text"
        size={1}
        inputMode={phoneish ? "tel" : "email"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Correo electrónico o número de celular"
        className={INPUT_CLASS}
      />
    </label>
  );
}
