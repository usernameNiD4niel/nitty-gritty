import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000";

type UploadState = "idle" | "uploading" | "uploaded" | "failed";
type TemplateStatus = "DRAFT" | "UPLOADED" | "PROCESSING" | "READY" | "FAILED" | "GENERATED";
type DetectedValue = {
  id: string;
  value: string;
  occurrences: number;
};
type DetectedValues = {
  texts: DetectedValue[];
  colors: DetectedValue[];
};
type TemplateFormProps = {
  onPreviewUrlChange?: (previewUrl: string | null) => void;
};
type TextReplacement = {
  from: string;
  to: string;
};

export function TemplateForm({ onPreviewUrlChange }: TemplateFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateStatus, setTemplateStatus] = useState<TemplateStatus | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedValues, setDetectedValues] = useState<DetectedValues | null>(null);
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [replacementRows, setReplacementRows] = useState<TextReplacement[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const matchedText = useMemo(() => {
    const normalizedFromText = fromText.trim().toLowerCase();

    if (!normalizedFromText) {
      return null;
    }

    return (
      detectedValues?.texts.find((text) => text.value.trim().toLowerCase() === normalizedFromText) ?? null
    );
  }, [detectedValues, fromText]);

  useEffect(() => {
    if (!templateId || templateStatus === "READY" || templateStatus === "FAILED") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollTemplateStatus(templateId);
    }, 1500);

    void pollTemplateStatus(templateId);

    return () => window.clearInterval(intervalId);
  }, [templateId, templateStatus]);

  useEffect(() => {
    if (!templateId || templateStatus !== "READY" || detectedValues) {
      return;
    }

    void fetchDetectedValues(templateId);
  }, [detectedValues, templateId, templateStatus]);

  async function uploadTemplateZip(file: File) {
    const trimmedName = templateName.trim();

    if (!trimmedName) {
      setUploadState("failed");
      setErrorMessage("Template name is required.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setUploadState("failed");
      setErrorMessage("Only .zip files are allowed.");
      return;
    }

    setUploadState("uploading");
    setErrorMessage(null);
    setDetectedValues(null);
    setTemplateStatus(null);
    setReplacementRows([]);
    setValidationMessage(null);
    onPreviewUrlChange?.(null);

    try {
      const createResponse = await fetch(`${API_BASE_URL}/api/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      if (!createResponse.ok) {
        throw new Error(await readApiError(createResponse));
      }

      const createdTemplate = (await createResponse.json()) as { id: string };
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch(
        `${API_BASE_URL}/api/templates/${createdTemplate.id}/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!uploadResponse.ok) {
        throw new Error(await readApiError(uploadResponse));
      }

      const uploadedTemplate = (await uploadResponse.json()) as { id: string; status: TemplateStatus };
      setTemplateId(uploadedTemplate.id);
      setTemplateStatus(uploadedTemplate.status);
      setUploadedFileName(file.name);
      setUploadState("uploaded");
    } catch (error) {
      setTemplateId(null);
      setUploadState("failed");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }

    void uploadTemplateZip(file);
  }

  async function pollTemplateStatus(id: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/${id}`);

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const template = (await response.json()) as { status: TemplateStatus; previewUrl: string | null };
      setTemplateStatus(template.status);

      if (template.previewUrl) {
        onPreviewUrlChange?.(`${API_BASE_URL}${template.previewUrl}`);
      }

      if (template.status === "FAILED") {
        setUploadState("failed");
        setErrorMessage("Template scan failed.");
      }
    } catch (error) {
      setUploadState("failed");
      setErrorMessage(error instanceof Error ? error.message : "Could not poll template status.");
    }
  }

  async function fetchDetectedValues(id: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/${id}/detected-values`);

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setDetectedValues((await response.json()) as DetectedValues);
    } catch (error) {
      setUploadState("failed");
      setErrorMessage(error instanceof Error ? error.message : "Could not load detected values.");
    }
  }

  async function addTextReplacement() {
    if (!templateId) {
      setValidationMessage("Upload a template before adding replacements.");
      return;
    }

    try {
      const validateResponse = await fetch(`${API_BASE_URL}/api/templates/${templateId}/texts/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromText,
        }),
      });

      if (!validateResponse.ok) {
        throw new Error(await readApiError(validateResponse));
      }

      const validation = (await validateResponse.json()) as { found: boolean };

      if (!validation.found) {
        setValidationMessage("Not found");
        return;
      }

      const saveResponse = await fetch(`${API_BASE_URL}/api/templates/${templateId}/replacements/texts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromText,
          to: toText,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error(await readApiError(saveResponse));
      }

      const nextReplacement = {
        from: fromText.trim(),
        to: toText.trim(),
      };

      setReplacementRows((currentRows) => [
        ...currentRows.filter((row) => row.from !== nextReplacement.from),
        nextReplacement,
      ]);
      setValidationMessage("FOUND");
      setFromText("");
      setToText("");
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : "Could not save replacement.");
    }
  }

  return (
    <form className="flex h-full flex-col px-12 py-8" onSubmit={(event) => event.preventDefault()}>
      <h1 className="mb-5 text-2xl font-extrabold tracking-normal text-neutral-900">
        Create Template
      </h1>

      <label className="mb-2 text-sm text-neutral-800" htmlFor="template-name">
        Template name
      </label>
      <Input
        id="template-name"
        name="templateName"
        onChange={(event) => setTemplateName(event.target.value)}
        value={templateName}
      />

      <div className="mt-5 text-sm text-neutral-800">Template code</div>
      <div className="mt-4 grid grid-cols-2 gap-8">
        <Button disabled={uploadState === "uploading"} onClick={() => fileInputRef.current?.click()}>
          {uploadState === "uploading" ? "Uploading" : "Upload"}
        </Button>
        <Button className="border-transparent">Paste code</Button>
      </div>

      <input
        accept=".zip,application/zip"
        className="hidden"
        name="file"
        onChange={(event) => handleFile(event.target.files?.[0])}
        ref={fileInputRef}
        type="file"
      />

      <div
        className="mt-4 flex h-40 items-center justify-center rounded-xl border border-dashed border-black px-4 text-center text-sm text-neutral-400"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFile(event.dataTransfer.files[0]);
        }}
      >
        {uploadedFileName ?? "Drag/Drop zip file"}
      </div>

      {uploadState === "uploaded" && templateStatus ? (
        <p className="mt-3 text-xs text-green-700">
          {templateStatus === "READY" ? "Scan complete" : `Template ${templateStatus.toLowerCase()}`}
        </p>
      ) : null}

      {uploadState === "failed" && errorMessage ? (
        <p className="mt-3 text-xs text-red-700">{errorMessage}</p>
      ) : null}

      {detectedValues ? (
        <div className="mt-6 space-y-5 text-sm text-neutral-800">
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs uppercase">Rename Texts</span>
              <span className="h-px flex-1 bg-neutral-300" />
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
              <label className="space-y-2">
                <span>From</span>
                <Input
                  className="h-10 rounded-md"
                  onChange={(event) => setFromText(event.target.value)}
                  value={fromText}
                />
              </label>
              <span className="pb-2 text-lg">-&gt;</span>
              <label className="space-y-2">
                <span>To</span>
                <Input
                  className="h-10 rounded-md"
                  onChange={(event) => setToText(event.target.value)}
                  value={toText}
                />
              </label>
              <Button className="h-10 px-3 text-lg text-green-700" onClick={addTextReplacement}>
                +
              </Button>
            </div>

            {validationMessage ? (
              <p className={`mt-2 text-xs ${validationMessage === "FOUND" ? "text-green-700" : "text-red-700"}`}>
                {validationMessage}
              </p>
            ) : fromText.trim() ? (
              <p className={`mt-2 text-xs ${matchedText ? "text-green-700" : "text-red-700"}`}>
                {matchedText ? "FOUND" : "Not found"}
              </p>
            ) : null}

            <div className="mt-4 space-y-3 text-xs">
              {replacementRows.map((replacement) => (
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3" key={replacement.from}>
                  <span>{replacement.from}</span>
                  <span>-&gt;</span>
                  <span className="text-green-700">{replacement.to}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs uppercase">Colors</span>
              <span className="h-px flex-1 bg-neutral-300" />
            </div>

            <div className="flex flex-wrap gap-2">
              {detectedValues.colors.slice(0, 6).map((color) => (
                <label
                  className="flex h-8 items-center gap-2 rounded-md border border-neutral-400 px-2 text-xs"
                  key={color.id}
                >
                  <span>{color.value}</span>
                  <input className="h-5 w-5" readOnly type="color" value={toColorInputValue(color.value)} />
                </label>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </form>
  );
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Upload failed.";
  } catch {
    return "Upload failed.";
  }
}

function toColorInputValue(value: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }

  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, red, green, blue] = value;
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  return "#000000";
}
