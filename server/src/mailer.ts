import nodemailer from "nodemailer";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

export async function sendVerificationEmail(toEmail: string, verifyUrl: string): Promise<void> {
  if (!smtpConfigured()) return;

  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = (process.env.SMTP_FROM ?? "Bestie <no-reply@bestie.mx>").trim();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });

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

