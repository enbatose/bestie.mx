import nodemailer from "nodemailer";

/** True when generic SMTP host is set, or Gmail credentials are set for `SMTP_SERVICE=gmail`. */
export function smtpConfigured(): boolean {
  if (process.env.SMTP_SERVICE?.trim().toLowerCase() === "gmail") {
    return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
  }
  return Boolean(process.env.SMTP_HOST?.trim());
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function createTransporter(): nodemailer.Transporter {
  const service = process.env.SMTP_SERVICE?.trim().toLowerCase();
  if (service === "gmail") {
    const user = requireEnv("SMTP_USER");
    const pass = requireEnv("SMTP_PASS");
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(port === 587 ? { requireTLS: true } : {}),
    ...(user && pass ? { auth: { user, pass } } : {}),
  });
}

export async function sendVerificationEmail(toEmail: string, verifyUrl: string): Promise<void> {
  if (!smtpConfigured()) return;

  const transporter = createTransporter();
  const gmailUser = process.env.SMTP_SERVICE?.trim().toLowerCase() === "gmail" ? requireEnv("SMTP_USER") : null;
  const fromDefault = gmailUser ? `Bestie <${gmailUser}>` : "Bestie <no-reply@bestie.mx>";
  const from = (process.env.SMTP_FROM ?? fromDefault).trim();

  const subject = "Confirma tu correo — Bestie";
  const text =
    `Hola,\n\n` +
    `Para confirmar tu correo y activar tu cuenta, abre este enlace:\n\n` +
    `${verifyUrl}\n\n` +
    `Si tú no pediste este registro, puedes ignorar este mensaje.\n`;

  const html =
    `<p>Hola,</p>` +
    `<p>Para confirmar tu correo y activar tu cuenta, abre este enlace:</p>` +
    `<p><a href="${verifyUrl}">${verifyUrl}</a></p>` +
    `<p>Si tú no pediste este registro, puedes ignorar este mensaje.</p>`;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html,
  });
}
