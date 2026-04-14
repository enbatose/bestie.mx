import { analyticsEvent } from "@/lib/authApi";

export type ImagePipelineMetrics = {
  batchId: string;
  step: "convert" | "upload" | "full";
  ms: number;
  inputBytes?: number;
  outputBytes?: number;
  inputType?: string;
  outputType?: string;
  inputW?: number;
  inputH?: number;
  outputW?: number;
  outputH?: number;
  fileCount?: number;
  ok: boolean;
  error?: string;
};

export async function trackImagePipeline(metrics: ImagePipelineMetrics): Promise<void> {
  await analyticsEvent("image_pipeline", metrics as unknown as Record<string, unknown>);
}

