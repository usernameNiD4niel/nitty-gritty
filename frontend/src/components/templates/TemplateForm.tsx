import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function TemplateForm() {
  return (
    <form className="flex h-full flex-col px-12 py-8">
      <h1 className="mb-5 text-2xl font-extrabold tracking-normal text-neutral-900">
        Create Template
      </h1>

      <label className="mb-2 text-sm text-neutral-800" htmlFor="template-name">
        Template name
      </label>
      <Input id="template-name" name="templateName" />

      <div className="mt-5 text-sm text-neutral-800">Template code</div>
      <div className="mt-4 grid grid-cols-2 gap-8">
        <Button>Upload</Button>
        <Button className="border-transparent">Paste code</Button>
      </div>

      <div className="mt-4 flex h-40 items-center justify-center rounded-xl border border-dashed border-black text-sm text-neutral-400">
        Drag/Drop zip file
      </div>
    </form>
  );
}
