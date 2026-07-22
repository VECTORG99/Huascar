import { useEffect, useMemo, useState } from "react";
import { useStep } from "../context/stepContextValue";

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function Choice({ option, selected, multiple, name, onChange }) {
  return (
    <label className={`block rounded-xl border p-4 cursor-pointer transition ${selected ? "border-emerald-500 bg-emerald-950/40" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}>
      <input
        className="sr-only"
        type={multiple ? "checkbox" : "radio"}
        name={name}
        checked={selected}
        onChange={onChange}
      />
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${multiple ? "rounded" : "rounded-full"} ${selected ? "border-emerald-400 bg-emerald-500 text-zinc-950" : "border-zinc-600"}`}>
          {selected ? "✓" : ""}
        </span>
        <span>
          <span className="block font-medium text-zinc-100">{option.label}</span>
          {option.description && <span className="mt-1 block text-sm text-zinc-400">{option.description}</span>}
        </span>
      </div>
    </label>
  );
}

export default function DynamicQuestion() {
  const { currentQuestion: question, answers, updateAnswer, catalog, currentIssue } = useStep();
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const value = question ? answers[question.id] : undefined;

  useEffect(() => {
    setSearch("");
    setCustom("");
  }, [question?.id]);

  const catalogOptions = useMemo(() => {
    if (!question?.catalogCategories || !catalog) return [];
    const query = search.trim().toLowerCase();
    return catalog.items.filter(item =>
      question.catalogCategories.includes(item.category) &&
      (!query || [item.label, item.description, item.id, ...item.tags].some(text => text.toLowerCase().includes(query)))
    );
  }, [catalog, question, search]);

  if (!question) return null;

  const multiple = question.type === "multiselect" || question.type === "catalog-multiselect";
  const selected = Array.isArray(value) ? value : [];
  const customSelections = multiple
    ? selected.filter(item => item.startsWith("custom:"))
    : (typeof value === "string" && value.startsWith("custom:") ? [value] : []);
  const toggle = id => {
    if (!multiple) {
      updateAnswer(question.id, id);
      return;
    }
    updateAnswer(question.id, selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]);
  };

  const addCustom = () => {
    const slug = slugify(custom);
    if (!slug) return;
    const id = `custom:${slug}`;
    if (multiple) updateAnswer(question.id, selected.includes(id) ? selected : [...selected, id]);
    else updateAnswer(question.id, id);
    setCustom("");
  };

  const renderInput = () => {
    if (question.type === "text" || question.type === "textarea") {
      const Component = question.type === "textarea" ? "textarea" : "input";
      return (
        <Component
          id={`${question.id}-input`}
          aria-labelledby={`${question.id}-prompt`}
          autoFocus
          value={typeof value === "string" ? value : ""}
          onChange={event => updateAnswer(question.id, event.target.value)}
          placeholder={question.placeholder}
          rows={question.type === "textarea" ? 6 : undefined}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
      );
    }

    if (question.type === "boolean") {
      return (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">{question.prompt}</legend>
          <Choice name={question.id} option={{ label: "Sí", description: "Activar esta capacidad en el blueprint." }} selected={value === true} onChange={() => updateAnswer(question.id, true)} />
          <Choice name={question.id} option={{ label: "No", description: "Omitirla y documentar la decisión." }} selected={value === false} onChange={() => updateAnswer(question.id, false)} />
        </fieldset>
      );
    }

    const options = question.options || [];
    if (question.type === "select" || question.type === "multiselect") {
      return (
        <fieldset className="grid gap-3 md:grid-cols-2">
          <legend className="sr-only">{question.prompt}</legend>
          {options.map(item => <Choice key={item.id} name={question.id} option={item} multiple={multiple} selected={multiple ? selected.includes(item.id) : value === item.id} onChange={() => toggle(item.id)} />)}
        </fieldset>
      );
    }

    const categories = question.catalogCategories.map(categoryId => catalog.categories.find(category => category.id === categoryId)).filter(Boolean);
    return (
      <fieldset className="space-y-5">
        <legend className="sr-only">{question.prompt}</legend>
        <div className="sticky top-0 z-10 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur">
          <input
            aria-label={`Buscar opciones para ${question.prompt}`}
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={`Buscar en ${categories.map(category => category.label).join(", ")}...`}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div className="max-h-[28rem] space-y-6 overflow-y-auto pr-1">
          {categories.map(category => {
            const items = catalogOptions.filter(item => item.category === category.id);
            if (items.length === 0) return null;
            return (
              <section key={category.id}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{category.label}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map(item => <Choice key={item.id} name={question.id} option={item} multiple={multiple} selected={multiple ? selected.includes(item.id) : value === item.id} onChange={() => toggle(item.id)} />)}
                </div>
              </section>
            );
          })}
          {catalogOptions.length === 0 && <p className="py-8 text-center text-sm text-zinc-500">No encontramos opciones con esa búsqueda.</p>}
        </div>
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-4">
          <label htmlFor={`${question.id}-custom`} className="mb-2 block text-sm font-medium">¿No aparece tu tecnología?</label>
          <div className="flex gap-2">
            <input id={`${question.id}-custom`} value={custom} onChange={event => setCustom(event.target.value)} placeholder="Nombre personalizado" className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
            <button type="button" onClick={addCustom} disabled={!custom.trim()} className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium hover:bg-zinc-600 disabled:opacity-40">Agregar</button>
          </div>
          {customSelections.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {customSelections.map(item => (
                <button type="button" aria-label={`Quitar ${item.replace("custom:", "")}`} key={item} onClick={() => multiple ? toggle(item) : updateAnswer(question.id, "")} className="rounded-full border border-amber-700 bg-amber-950/30 px-3 py-1 text-xs text-amber-300">{item.replace("custom:", "")} ×</button>
              ))}
            </div>
          )}
        </div>
      </fieldset>
    );
  };

  return (
    <div key={question.id} className="animate-fade-in">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">{question.section}</div>
      <h2 id={`${question.id}-prompt`} className="text-2xl font-bold text-zinc-50 sm:text-3xl">{question.prompt}</h2>
      <p className="mb-6 mt-3 text-zinc-400">{question.description}</p>
      {renderInput()}
      {question.maxSelections && multiple && <p className="mt-3 text-xs text-zinc-500">Seleccionadas: {selected.length} / {question.maxSelections}</p>}
      {currentIssue && <p role="alert" aria-live="polite" className="mt-3 text-sm text-red-400">{currentIssue.message}</p>}
    </div>
  );
}
