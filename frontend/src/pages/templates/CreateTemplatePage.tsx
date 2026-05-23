import { TemplateForm } from "../../components/templates/TemplateForm";
import { TemplatePreview } from "../../components/templates/TemplatePreview";
import { useState } from "react";

export function CreateTemplatePage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "failed">("idle");

  return (
    <main className="min-h-screen bg-white px-3 py-3 sm:bg-neutral-50 sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[700px] w-full max-w-[1000px] overflow-hidden rounded-xl border border-black bg-white lg:grid-cols-[40%_60%]">
        <section className="border-b border-black lg:border-b-0 lg:border-r">
          <TemplateForm
            onPreviewStateChange={setPreviewState}
            onPreviewUrlChange={setPreviewUrl}
          />
        </section>
        <TemplatePreview previewState={previewState} previewUrl={previewUrl} />
      </div>
    </main>
  );
}
