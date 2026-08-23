import type { DatabaseSync } from "node:sqlite";
import { buildPostReportEmail, POST_REPORT_OPS_EMAIL } from "./emails/postReportEmail.js";
import { sendTransactionalEmail } from "./mailer.js";
import { adminReportThreadUrl } from "./listingReports.js";
import { categoryLabels, CHAT_REPORT_CATEGORIES, POST_REPORT_CATEGORIES } from "./reportCategories.js";
import { isProductionPublicSite, publicBaseUrl } from "./publicBaseUrl.js";
import type { ReportTargetType } from "./reportsSchema.js";

export type PostReportNotifyPayload = {
  postReportId: string;
  conversationId: string;
  reportCount: number;
  targetType: ReportTargetType | "room" | "property" | "chat";
  viewPath: string | null;
  shortId: string | null;
  categories: readonly string[];
  detailText: string | null;
  reporterLabel: string;
};

export function scheduleNotifyPostReported(_db: DatabaseSync, payload: PostReportNotifyPayload): void {
  if (!isProductionPublicSite()) return;
  void notifyPostReported(payload).catch((err) => {
    console.error("[postReportNotify] failed:", err);
  });
}

async function notifyPostReported(payload: PostReportNotifyPayload): Promise<void> {
  const isChat = payload.targetType === "chat";
  const categoryList = categoryLabels(
    payload.categories,
    isChat ? CHAT_REPORT_CATEGORIES : POST_REPORT_CATEGORIES,
  );
  const postUrl = payload.viewPath ? `${publicBaseUrl()}${payload.viewPath}` : null;
  const adminUrl = adminReportThreadUrl(payload.conversationId);

  const built = buildPostReportEmail({
    reportCount: payload.reportCount,
    targetType: payload.targetType,
    shortId: payload.shortId,
    postUrl,
    adminUrl,
    categories: categoryList,
    detailText: payload.detailText,
    reporterLabel: payload.reporterLabel,
  });

  await sendTransactionalEmail({
    to: POST_REPORT_OPS_EMAIL,
    subject: built.subject,
    html: built.html,
    text: built.text,
  });
}
