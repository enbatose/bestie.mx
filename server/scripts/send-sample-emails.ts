/**
 * Build and optionally send realistic samples of every transactional template.
 *
 *   npx tsx scripts/send-sample-emails.ts --build-only
 *   npx tsx scripts/send-sample-emails.ts contacto@bestie.mx
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildEmailVerificationEmail } from "../src/emails/emailVerificationEmail.js";
import { buildPasswordResetEmail } from "../src/emails/passwordResetEmail.js";
import { buildMessageDigestEmail } from "../src/emails/messageDigestEmail.js";
import { buildSavedSearchEmail } from "../src/emails/savedSearchEmail.js";
import { sendTransactionalEmail, smtpConfigured, resolveFromAddress } from "../src/mailer.js";
import type { PropertyListing } from "../src/types.js";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function ensureSampleEnv() {
  for (const rel of [".env", ".env.local", "../.env", "../.env.local"]) {
    loadEnvFile(resolve(rel));
  }
  // Prefer friendly no-reply for sample sends even if .env still has an old mailbox.
  if (!process.env.EMAIL_FROM || /@bestie\.mx/i.test(process.env.EMAIL_FROM)) {
    process.env.EMAIL_FROM = "Bestie MX <no-reply@bestie.mx>";
  }
}

const args = process.argv.slice(2);
const buildOnly = args.includes("--build-only");
const to = (args.find((a) => a.includes("@")) || "contacto@bestie.mx").trim().toLowerCase();

function sampleListing(
  partial: Partial<PropertyListing> & Pick<PropertyListing, "id" | "title" | "rentMxn">,
): PropertyListing {
  return {
    propertyId: `prp__${partial.id}`,
    propertyTitle: partial.propertyTitle ?? "Casa en Americana",
    propertyBedroomsTotal: 3,
    propertyBathrooms: 2,
    showWhatsApp: true,
    city: "Guadalajara",
    neighborhood: "Americana",
    lat: 20.6736,
    lng: -103.3656,
    depositMxn: partial.rentMxn,
    roomsAvailable: 1,
    tags: ["wifi", "muebles", "baño-privado"],
    roommateGenderPref: "any",
    ageMin: 22,
    ageMax: 35,
    summary: "Recámara luminosa a 5 min de Av. Chapultepec. Ideal para roomie profesional.",
    contactWhatsApp: "523312345678",
    status: "published",
    lodgingType: "private_room",
    propertyKind: "house",
    propertyImageUrls: [],
    roomImageUrls: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function buildSamples() {
  const listings = [
    sampleListing({
      id: "room-americana-01",
      title: "Recámara privada con baño",
      rentMxn: 7500,
      tags: ["wifi", "muebles", "baño-privado", "mascotas"],
      roommateGenderPref: "female",
    }),
    sampleListing({
      id: "room-providencia-02",
      title: "Cuarto amueblado cerca de Midtown",
      rentMxn: 9200,
      neighborhood: "Providencia",
      propertyTitle: "Departamento en Providencia",
      propertyKind: "apartment",
      tags: ["wifi", "estacionamiento", "lgbt-friendly"],
    }),
    sampleListing({
      id: "room-lafayette-03",
      title: "Loft compartido Lafayette",
      rentMxn: 5800,
      neighborhood: "Lafayette",
      propertyKind: "loft",
      lodgingType: "shared_room",
      summary: "Espacio compartido en loft con mucha luz natural.",
      tags: ["wifi", "muebles"],
    }),
  ];

  return [
    {
      name: "email_verification",
      mail: buildEmailVerificationEmail({ code: "482931", displayName: "Enrique" }),
    },
    {
      name: "password_reset",
      mail: buildPasswordResetEmail({
        resetUrl: "https://www.bestie.mx/perfil/editar?reset=sample-token-demo-only",
        displayName: "Enrique",
      }),
    },
    {
      name: "message_digest",
      mail: buildMessageDigestEmail({
        displayName: "Enrique",
        unreadMessageCount: 3,
        messages: [
          {
            contextTitle: "Casa en Americana · Recámara privada (Guadalajara)",
            whenLabel: "Hoy, 1:12 p. m. (hora de Guadalajara)",
          },
          {
            contextTitle: "Departamento en Providencia · Cuarto amueblado (Guadalajara)",
            whenLabel: "Hoy, 10:05 a. m. (hora de Guadalajara)",
          },
          {
            contextTitle: "Soporte Bestie",
            whenLabel: "Ayer, 6:40 p. m. (hora del centro de México · Ciudad de México)",
          },
        ],
        notifications: [
          {
            text: "Has publicado exitosamente tu anuncio de Cuarto 'Recámara privada con baño'.",
            link: "/mis-anuncios",
            whenLabel: "Hoy, 12:40 p. m. (hora del centro de México · Ciudad de México)",
          },
          {
            text: "Tu nuevo anuncio de Cuarto 'Loft compartido Lafayette' se ha creado. No olvides publicarlo.",
            link: "/publicar",
            whenLabel: "Ayer, 4:15 p. m. (hora del centro de México · Ciudad de México)",
          },
        ],
      }),
    },
    {
      name: "saved_search",
      mail: buildSavedSearchEmail({
        label: "GDL · Americana · máx $9,000",
        searchUrl: "/buscar/gdl?max=9000&lat=20.67&lng=-103.35&z=14",
        unsubscribeToken: "sample-unsub-token-demo",
        mode: "follow_up",
        newListings: [listings[0]!, listings[1]!],
        otherListings: [listings[2]!],
      }),
    },
  ] as const;
}

async function main() {
  ensureSampleEnv();
  const samples = buildSamples();
  const outDir = resolve("_sample_emails");
  mkdirSync(outDir, { recursive: true });
  const payload: Record<string, unknown> = {};
  for (const sample of samples) {
    payload[sample.name] = {
      subject: `[Muestra] ${sample.mail.subject}`,
      previewText: sample.mail.previewText,
      html: sample.mail.html,
      text: sample.mail.text,
      replyTo: sample.mail.replyTo,
      tags: sample.mail.tags,
    };
    writeFileSync(resolve(outDir, `${sample.name}.html`), sample.mail.html, "utf8");
  }
  writeFileSync(resolve(outDir, "payloads.json"), JSON.stringify(payload), "utf8");
  console.log(`Built ${samples.length} templates → ${outDir}`);

  if (buildOnly) return;

  if (!smtpConfigured() || !resolveFromAddress()) {
    console.error("Outbound mail is not configured (need RESEND_API_KEY + EMAIL_FROM, or SMTP).");
    process.exit(1);
  }

  console.log(`Sending ${samples.length} sample emails to ${to}…`);
  for (const sample of samples) {
    const ok = await sendTransactionalEmail({
      to,
      subject: `[Muestra] ${sample.mail.subject}`,
      html: sample.mail.html,
      text: sample.mail.text,
      previewText: sample.mail.previewText,
      replyTo: sample.mail.replyTo,
      tags: [
        ...(sample.mail.tags ?? []),
        { name: "sample", value: "1" },
        { name: "template", value: sample.name },
      ],
    });
    console.log(`  ${sample.name}: ${ok ? "sent" : "FAILED"}`);
    if (!ok) process.exitCode = 1;
  }
}

void main();
