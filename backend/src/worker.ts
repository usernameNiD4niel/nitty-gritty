import { Worker } from "bullmq";
import { prisma } from "./lib/prisma.js";
import {
  createRedisConnection,
  SCAN_TEMPLATE_JOB,
  type ScanTemplateJobData,
  TEMPLATE_PROCESSING_QUEUE,
} from "./lib/template-processing-queue.js";
import { downloadZip, scanTemplateZip } from "./modules/templates/template-scanner.js";

const worker = new Worker<ScanTemplateJobData>(
  TEMPLATE_PROCESSING_QUEUE,
  async (job) => {
    if (job.name !== SCAN_TEMPLATE_JOB) {
      return;
    }

    const { templateId, zipUrl } = job.data;

    try {
      const zipBuffer = await downloadZip(zipUrl);
      const detectedValues = await scanTemplateZip(zipBuffer);

      await prisma.template.update({
        where: {
          id: templateId,
        },
        data: {
          status: "READY",
          detectedTexts: detectedValues.texts,
          detectedColors: detectedValues.colors,
        },
      });
    } catch (error) {
      await prisma.template.update({
        where: {
          id: templateId,
        },
        data: {
          status: "FAILED",
        },
      });

      throw error;
    }
  },
  {
    connection: createRedisConnection(),
  },
);

worker.on("completed", (job) => {
  console.log(`Completed ${job.name} for template ${job.data.templateId}`);
});

worker.on("failed", (job, error) => {
  console.error(`Failed ${job?.name ?? "job"} for template ${job?.data.templateId ?? "unknown"}`, error);
});
