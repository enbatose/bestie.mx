import { analyticsEvent } from "@/lib/authApi";
import { isPostHogConfigured, posthog } from "@/lib/posthog";
import {
  classifyFileName,
  classifyImageError,
  clientUploadEnv,
  type ImageDecodePath,
  type ImageErrorCode,
  type ImageUploadSource,
} from "@/lib/imageUploadDiagnostics";

export type ImagePipelineMetrics = {
  batchId: string;
  step: "persist" | "convert" | "upload" | "full";
  ms: number;
  ok: boolean;
  surface?: "publish_wizard" | "profile" | "attachment" | "other";
  source?: ImageUploadSource;
  inputBytes?: number;
  outputBytes?: number;
  inputType?: string;
  outputType?: string;
  declaredMime?: string;
  sniffedMime?: string | null;
  nameExt?: string;
  nameKind?: string;
  decodePath?: ImageDecodePath;
  heicConverted?: boolean;
  inputW?: number;
  inputH?: number;
  outputW?: number;
  outputH?: number;
  fileCount?: number;
  successCount?: number;
  failureCount?: number;
  error?: string;
  errorCode?: ImageErrorCode;
  httpStatus?: number;
};

function sanitizeErrorMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.slice(0, 280);
}

export async function trackImagePipeline(metrics: ImagePipelineMetrics): Promise<void> {
  const env = clientUploadEnv();
  const errorCode = metrics.errorCode ?? (metrics.ok ? undefined : classifyImageError(metrics.error));

  const payload: Record<string, unknown> = {
    ...metrics,
    ...env,
    error: sanitizeErrorMessage(metrics.error),
    errorCode,
    v: 2,
  };

  await analyticsEvent("image_pipeline", payload);

  // Always mirror failures to PostHog; sample successes lightly for volume.
  if (!isPostHogConfigured()) return;
  try {
    if (!metrics.ok || metrics.step === "full" || Math.random() < 0.15) {
      posthog.capture("publish_image_pipeline", payload);
    }
  } catch {
    /* never break UX */
  }
}

export function fileAuditFields(file: File): Pick<
  ImagePipelineMetrics,
  "inputBytes" | "inputType" | "declaredMime" | "nameExt" | "nameKind"
> {
  const { nameExt, nameKind } = classifyFileName(file.name);
  return {
    inputBytes: file.size,
    inputType: file.type || "unknown",
    declaredMime: file.type || "unknown",
    nameExt,
    nameKind,
  };
}
