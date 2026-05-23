import { TemplateForm } from "../../components/templates/TemplateForm";
import { TemplatePreview } from "../../components/templates/TemplatePreview";

export function CreateTemplatePage() {
  return (
    <main className="min-h-screen bg-white px-3 py-3 sm:bg-neutral-50 sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[700px] w-full max-w-[1000px] overflow-hidden rounded-xl border border-black bg-white lg:grid-cols-[40%_60%]">
        <section className="border-b border-black lg:border-b-0 lg:border-r">
          <TemplateForm />
        </section>
        <TemplatePreview />
      </div>
    </main>
  );
}
