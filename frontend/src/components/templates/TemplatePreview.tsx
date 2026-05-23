type TemplatePreviewProps = {
  previewUrl?: string | null;
};

export function TemplatePreview({ previewUrl }: TemplatePreviewProps) {
  return (
    <section className="h-full px-4 py-6 sm:px-6 lg:px-8">
      <h2 className="text-2xl font-extrabold tracking-normal text-neutral-900">Preview</h2>
      <div className="mt-6 h-[calc(100%-4rem)]" aria-label="Template preview area">
        {previewUrl ? (
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
