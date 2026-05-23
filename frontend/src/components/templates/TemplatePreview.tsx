type TemplatePreviewProps = {
  previewState?: "idle" | "loading" | "ready" | "failed";
  previewUrl?: string | null;
};

export function TemplatePreview({ previewState = "idle", previewUrl }: TemplatePreviewProps) {
  return (
    <section className="h-full px-4 py-6 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-extrabold tracking-normal text-neutral-900">Preview</h2>
      <div
        className="mt-6 flex h-[calc(100%-4rem)] items-center justify-center text-sm text-neutral-500"
        aria-label="Template preview area"
      >
        {previewState === "loading" ? "Generating preview..." : null}
        {previewState === "failed" ? "Preview unavailable." : null}
        {previewState !== "loading" && previewState !== "failed" && previewUrl ? (
          <iframe
            className="h-full w-full border-0"
            src={previewUrl}
            title="Template preview"
          />
        ) : null}
      </div>
    </section>
  );
}
