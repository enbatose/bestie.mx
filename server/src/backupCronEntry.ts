import { runBackupCronJob } from "./backup/backupCron.js";
import { backupAlertTo } from "./backup/backupConfig.js";
import { sendTransactionalEmail } from "./mailer.js";

async function alert(reason: string, detail?: string): Promise<void> {
  await sendTransactionalEmail({
    to: backupAlertTo(),
    subject: "[Bestie] Falló el respaldo diario de producción",
    text: `reason=${reason}\n${detail ?? ""}`,
    html: `<p><code>reason=${reason}</code></p><pre>${(detail ?? "").slice(0, 2000)}</pre>`,
    tags: [
      { name: "category", value: "backup_alert" },
      { name: "product", value: "bestie" },
    ],
  });
}

async function main(): Promise<void> {
  try {
    const code = await runBackupCronJob();
    process.exit(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[backup-cron] fatal: ${message}`);
    try {
      await alert("warm_cron_fatal", message);
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

void main();
