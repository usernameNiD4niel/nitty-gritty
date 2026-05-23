import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const TEMPLATE_PROCESSING_QUEUE = "template-processing";
export const SCAN_TEMPLATE_JOB = "scan-template";

export type ScanTemplateJobData = {
  templateId: string;
  zipUrl: string;
};

export function createRedisConnection() {
  return new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
  });
}

export function createTemplateProcessingQueue() {
  return new Queue<ScanTemplateJobData>(TEMPLATE_PROCESSING_QUEUE, {
    connection: createRedisConnection(),
  });
}
