import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  adminCatalog, catalogError,
  type AdminCategory, type AdminCatalogService, type CategoryInput, type ServiceInput, type SuggestionPreview,
} from "../services/adminCatalog";
import "./AdminCatalogManager.css";

export type CatalogSection = "categories" | "services" | "suggestions";
type Kind = "category" | "service";
type FormValues = {
  name: string; description: string; keywords: string; active: boolean;
  icon: string; order: string; category: string; minimum: string; maximum: string; hours: string;
};
type Editor = { kind: Kind; id: number | null; values: FormValues };
type PendingAction = { kind: Kind; id: number; name: string; active: boolean; action: "delete" | "toggle" };
type Props = {
  section: CatalogSection;
  onSectionChange: (section: CatalogSection) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onChanged?: () => void;
};

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function keywordsFromText(value: string): string[] {
  const seen = new Set<string>();
  return value.split(/[\n,;]+/).map((term) => term.trim().replace(/\s+/g, " "))
    .filter((term) => {
      const key = normalize(term);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
const currency = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });
function priceRange(service: AdminCatalogService) {
  if (service.price_min === null && service.price_max === null) return "A convenir";
  if (service.price_min === null) return `Hasta ${currency.format(Number(service.price_max))}`;
  if (service.price_max === null) return `Desde ${currency.format(Number(service.price_min))}`;
  return `${currency.format(Number(service.price_min))} – ${currency.format(Number(service.price_max))}`;
}

const Dialog: React.FC<React.PropsWithChildren<{ title: string; busy: boolean; onClose: () => void }>> = ({ title, busy, onClose, children }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return (
    <dialog ref={ref} className="ac-dialog" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <div className="ac-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="ac-icon-button" aria-label="Cerrar" disabled={busy} onClick={onClose}>×</button>
      </div>
      {children}
    </dialog>
  );
};

function KeywordTags({ values }: { values: string[] }) {
  return values.length ? <div className="ac-tags">{values.map((value) => <span key={value} className="ac-tag">{value}</span>)}</div>
    : <span className="ac-muted">Sin palabras clave</span>;
}

export const AdminCatalogManager: React.FC<Props> = ({ section, onSectionChange, searchQuery, onSearchChange, onChanged }) => {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [services, setServices] = useState<AdminCatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<SuggestionPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const generation = useRef(0);
  const previewGeneration = useRef(0);

  const loadCatalog = useCallback(async () => {
    const current = ++generation.current;
    previewGeneration.current += 1;
    setPreview(null);
    setPreviewError("");
    setPreviewing(false);
    setLoading(true);
    setLoadError("");
    try {
      const [nextCategories, nextServices] = await Promise.all([adminCatalog.categories(), adminCatalog.services()]);
      if (current !== generation.current) return;
      setCategories(nextCategories);
      setServices(nextServices);
    } catch (error) {
      if (current === generation.current) {
        setCategories([]);
        setServices([]);
        setLoadError(catalogError(error));
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    return () => { generation.current += 1; previewGeneration.current += 1; };
  }, [loadCatalog]);

  useEffect(() => {
    if (categoryFilter && !categories.some((item) => String(item.id) === categoryFilter)) setCategoryFilter("");
  }, [categories, categoryFilter]);

  const afterChange = async (notice: string) => {
    previewGeneration.current += 1;
    setPreviewing(false);
    setPreview(null);
    setPreviewError("");
    setMessage(notice);
    onChanged?.();
    await loadCatalog();
  };

  const openCategory = (category?: AdminCategory) => {
    setFormError("");
    setEditor({ kind: "category", id: category?.id ?? null, values: {
      name: category?.name ?? "", description: category?.description ?? "",
      keywords: category?.keywords.join("\n") ?? "", active: category?.is_active ?? true,
      icon: category?.icon_key ?? "", order: String(category?.sort_order ?? 0),
      category: "", minimum: "", maximum: "", hours: "",
    } });
  };
  const openService = (service?: AdminCatalogService) => {
    setFormError("");
    setEditor({ kind: "service", id: service?.id ?? null, values: {
      name: service?.name ?? "", description: service?.description ?? "",
      keywords: service?.keywords.join("\n") ?? "", active: service?.is_active ?? true,
      category: String(service?.category ?? (categoryFilter || categories[0]?.id || "")),
      minimum: service?.price_min ?? "", maximum: service?.price_max ?? "", hours: service?.estimated_hours ?? "",
      icon: "", order: "0",
    } });
  };
  const setValue = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setEditor((current) => current ? { ...current, values: { ...current.values, [key]: value } } : null);
  };

  const saveEditor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    setFormError("");
    try {
      const values = editor.values;
      const keywords = keywordsFromText(values.keywords);
      if (keywords.length > 50 || keywords.some((term) => term.length > 120)) {
        throw new Error("Usa hasta 50 palabras o frases clave, con un máximo de 120 caracteres cada una.");
      }
      if (editor.kind === "category") {
        const data: CategoryInput = {
          name: values.name.trim(), description: values.description.trim(), keywords,
          is_active: values.active, icon_key: values.icon.trim(), sort_order: Number(values.order),
        };
        if (editor.id === null) await adminCatalog.createCategory(data);
        else await adminCatalog.updateCategory(editor.id, data);
      } else {
        const data: ServiceInput = {
          name: values.name.trim(), description: values.description.trim(), keywords, is_active: values.active,
          category: Number(values.category), price_min: values.minimum || null, price_max: values.maximum || null,
          estimated_hours: values.hours || null,
        };
        if (editor.id === null) await adminCatalog.createService(data);
        else await adminCatalog.updateService(editor.id, data);
      }
      setEditor(null);
      await afterChange(editor.kind === "category" ? "Categoría guardada correctamente." : "Servicio guardado correctamente.");
    } catch (error) {
      setFormError(catalogError(error));
    } finally { setSaving(false); }
  };

  const confirmAction = async () => {
    if (!pending || saving) return;
    setSaving(true);
    setFormError("");
    try {
      if (pending.action === "delete") {
        if (pending.kind === "category") await adminCatalog.deleteCategory(pending.id);
        else await adminCatalog.deleteService(pending.id);
      } else if (pending.kind === "category") {
        await adminCatalog.updateCategory(pending.id, { is_active: !pending.active });
      } else {
        await adminCatalog.updateService(pending.id, { is_active: !pending.active });
      }
      const notice = pending.action === "delete" ? "Elemento eliminado del catálogo."
        : pending.active ? "Elemento desactivado. Su historial se conserva." : "Elemento activado correctamente.";
      setPending(null);
      await afterChange(notice);
    } catch (error) { setFormError(catalogError(error)); }
    finally { setSaving(false); }
  };

  const runPreview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (previewing) return;
    const current = ++previewGeneration.current;
    setPreviewing(true);
    setPreviewError("");
    setPreview(null);
    try {
      const result = await adminCatalog.preview(description.trim());
      if (current === previewGeneration.current) setPreview(result);
    } catch (error) {
      if (current === previewGeneration.current) setPreviewError(catalogError(error));
    } finally {
      if (current === previewGeneration.current) setPreviewing(false);
    }
  };

  const query = normalize(searchQuery.trim());
  const matches = (item: AdminCategory | AdminCatalogService) =>
    (!query || normalize([item.name, item.description, ...item.keywords,
      "category_name" in item ? item.category_name : ""].join(" ")).includes(query)) &&
    (statusFilter === "all" || item.is_active === (statusFilter === "active"));
  const visibleCategories = categories.filter(matches);
  const visibleServices = services.filter((item) => matches(item) && (!categoryFilter || String(item.category) === categoryFilter));
  const selectedCategory = categories.find((item) => String(item.id) === editor?.values.category);
  const actions = (kind: Kind, item: AdminCategory | AdminCatalogService) => (
    <div className="ac-row-actions">
      <button type="button" className="ac-button ac-button-small" disabled={saving || loading}
        onClick={() => kind === "category" ? openCategory(item as AdminCategory) : openService(item as AdminCatalogService)}>Editar</button>
      <button type="button" className="ac-text-button" disabled={saving || loading} onClick={() => {
        setFormError(""); setPending({ kind, id: item.id, name: item.name, active: item.is_active, action: "toggle" });
      }}>{item.is_active ? "Desactivar" : "Activar"}</button>
      <button type="button" className="ac-text-button ac-danger" disabled={saving || loading} onClick={() => {
        setFormError(""); setPending({ kind, id: item.id, name: item.name, active: item.is_active, action: "delete" });
      }}>Eliminar</button>
    </div>
  );

  return (
    <section className="ac-manager" aria-label="Administración del catálogo">
      <header className="ac-heading">
        <div><span className="ac-eyebrow">ADMINISTRACIÓN / CATÁLOGO</span><h1>Servicios para cada necesidad</h1>
          <p>Gestiona categorías, servicios y las palabras que conectan a tus clientes con la ayuda adecuada.</p></div>
        <div className="ac-heading-actions">
          <button type="button" className="ac-button" onClick={() => { void loadCatalog(); }} disabled={loading || saving}>Actualizar</button>
          {section !== "suggestions" && <button type="button" className="ac-button ac-primary" disabled={loading || saving || !!loadError || (section === "services" && !categories.length)}
            onClick={() => section === "categories" ? openCategory() : openService()}>+ {section === "categories" ? "Nueva categoría" : "Nuevo servicio"}</button>}
        </div>
      </header>

      <div className="ac-stats">
        <div><span>Categorías activas</span><strong>{categories.filter((item) => item.is_active).length}<small> / {categories.length}</small></strong></div>
        <div><span>Servicios visibles</span><strong>{services.filter((item) => item.is_active && item.category_active).length}<small> / {services.length}</small></strong></div>
        <div><span>Servicios con palabras clave</span><strong>{services.filter((item) => item.keywords.length).length}<small> / {services.length}</small></strong></div>
      </div>

      <nav className="ac-tabs" aria-label="Secciones del catálogo">
        {([['categories', 'Categorías'], ['services', 'Servicios'], ['suggestions', 'Sugerencias']] as const).map(([id, label]) =>
          <button key={id} type="button" aria-current={section === id ? "page" : undefined} className={section === id ? "active" : ""}
            onClick={() => onSectionChange(id)}>{label}</button>)}
      </nav>

      {message && <div className="ac-notice ac-success" role="status"><span>{message}</span>
        <button type="button" className="ac-text-button" onClick={() => setMessage("")} aria-label="Cerrar aviso">×</button></div>}
      {loadError && <div className="ac-notice ac-error" role="alert">{loadError} <button type="button" className="ac-text-button" onClick={() => { void loadCatalog(); }}>Reintentar</button></div>}

      {section !== "suggestions" ? (
        <div className="ac-card">
          <div className="ac-toolbar">
            <label className="ac-search">Buscar en el catálogo<input type="search" placeholder="Nombre, descripción o palabra clave"
              value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} /></label>
            {section === "services" && <label>Categoría<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">Todas las categorías</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_active ? "" : " (inactiva)"}</option>)}
            </select></label>}
            <label>Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option>
            </select></label>
          </div>
          {loading ? <div className="ac-empty" role="status">Cargando el catálogo…</div> : (
            <>
              <div className="ac-table-scroll">
                {section === "categories" ? <table className="ac-table"><caption className="ac-sr-only">Categorías del catálogo</caption>
                  <thead><tr><th>Categoría</th><th>Palabras clave</th><th>Servicios</th><th>Orden</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>{visibleCategories.map((item) => <tr key={item.id}>
                    <td><strong>{item.name}</strong><p className="ac-description">{item.description || "Sin descripción"}</p></td>
                    <td><KeywordTags values={item.keywords} /></td><td>{item.services_count}</td><td>{item.sort_order}</td>
                    <td><span className={`ac-status ${item.is_active ? "is-active" : "is-inactive"}`}>{item.is_active ? "Activa" : "Inactiva"}</span></td>
                    <td>{actions("category", item)}</td>
                  </tr>)}</tbody>
                </table> : <table className="ac-table"><caption className="ac-sr-only">Servicios del catálogo</caption>
                  <thead><tr><th>Servicio</th><th>Categoría</th><th>Palabras clave</th><th>Tarifa orientativa</th><th>Estado</th><th>Acciones</th></tr></thead>
                  <tbody>{visibleServices.map((item) => <tr key={item.id}>
                    <td><strong>{item.name}</strong><p className="ac-description">{item.description || "Sin descripción"}</p><small className="ac-muted">{item.professionals_count} profesionales ofrecen este servicio</small></td>
                    <td>{item.category_name}{!item.category_active && <small className="ac-warning-text">Categoría inactiva</small>}</td>
                    <td><KeywordTags values={item.keywords} /></td><td>{priceRange(item)}{item.estimated_hours !== null && <small className="ac-muted ac-block">{item.estimated_hours} horas estimadas</small>}</td>
                    <td><span className={`ac-status ${item.is_active ? "is-active" : "is-inactive"}`}>{item.is_active ? "Activo" : "Inactivo"}</span></td>
                    <td>{actions("service", item)}</td>
                  </tr>)}</tbody>
                </table>}
              </div>
              {(section === "categories" ? visibleCategories : visibleServices).length === 0 && <div className="ac-empty">
                <h3>No hay {section === "categories" ? "categorías" : "servicios"} para mostrar</h3>
                <p>{searchQuery || statusFilter !== "all" || categoryFilter ? "Prueba otros filtros para encontrar lo que buscas." : section === "services" && !categories.length ? "Crea una categoría antes de añadir su primer servicio." : "Añade el primer elemento con el botón de la parte superior."}</p>
                {(searchQuery || statusFilter !== "all" || categoryFilter) && <button type="button" className="ac-button" onClick={() => { onSearchChange(""); setStatusFilter("all"); setCategoryFilter(""); }}>Limpiar filtros</button>}
              </div>}
              <footer className="ac-table-footer">{section === "categories" ? visibleCategories.length : visibleServices.length} resultados · Los cambios guardados se aplican al catálogo de la aplicación.</footer>
            </>
          )}
        </div>
      ) : (
        <div className="ac-suggestions-layout">
          <div className="ac-card ac-padded">
            <span className="ac-eyebrow">BUSQUEDA ORIENTADA</span><h2>Prueba tus sugerencias</h2>
            <p className="ac-muted">Escribe como lo haría un cliente. Verás las coincidencias del catálogo guardado, sin crear solicitudes ni sesiones de diagnóstico.</p>
            <form onSubmit={runPreview}>
              <label className="ac-field">Descripción del problema<textarea required minLength={5} maxLength={1000} rows={5}
                placeholder="Tengo una fuga de agua debajo del lavaplatos" value={description} onChange={(event) => {
                  setDescription(event.target.value); setPreview(null); setPreviewError("");
                  previewGeneration.current += 1; setPreviewing(false);
                }} /></label>
              <small className="ac-muted">{description.length}/1000 caracteres</small>
              <button type="submit" className="ac-button ac-primary ac-preview-button" disabled={previewing || loading || !!loadError || description.trim().length < 5}>
                {previewing ? "Buscando coincidencias…" : "Probar sugerencias"}
              </button>
            </form>
            {previewError && <div className="ac-notice ac-error" role="alert">{previewError}</div>}
          </div>
          <aside className="ac-card ac-padded ac-help"><h2>Cómo mejorar los resultados</h2>
            <ol><li>Define categorías claras para agrupar los servicios.</li><li>Añade frases que el cliente usaría, como «grifo goteando».</li><li>Incluye variantes y sinónimos en las palabras clave del servicio.</li><li>Guarda los cambios y vuelve a probar aquí.</li></ol>
            <p>Las categorías y servicios inactivos quedan fuera de las sugerencias. El cliente conserva la decisión final.</p>
            <button type="button" className="ac-text-button" onClick={() => onSectionChange("services")}>Editar palabras clave de servicios →</button>
          </aside>
          {preview && <div className="ac-card ac-padded ac-preview-result" aria-live="polite">
            <span className="ac-eyebrow">RESULTADO DE LA PRUEBA</span>
            <h2>{preview.suggested_service?.name || preview.suggested_category?.name || "Sin coincidencias claras"}</h2>
            {preview.suggested_category && <span className="ac-tag">{preview.suggested_category.name}</span>}
            <p>{preview.rationale}</p>
            {preview.suggested_category && <p className="ac-muted">Afinidad relativa: {Math.round(preview.confidence * 100)}%</p>}
            {!!preview.service_ranking.length && <div className="ac-ranked-list">{preview.service_ranking.map((item, index) => <article key={item.id}>
              <span className="ac-rank">{index + 1}</span><div><strong>{item.name}</strong><small className="ac-muted ac-block">{item.category.name} · Puntuación {item.score}</small>
                <KeywordTags values={item.matched_terms} /></div>
              <button type="button" className="ac-text-button" onClick={() => { const found = services.find((service) => service.id === item.id); if (found) openService(found); }}>Editar servicio</button>
            </article>)}</div>}
            {!preview.service_ranking.length && <p className="ac-muted">{preview.suggested_category ? "Se identificó una categoría, pero no un servicio concreto. Añade frases más específicas a sus servicios." : "Añade términos relacionados en categorías y servicios, y prueba de nuevo."}</p>}
            {preview.ranking.some((item) => item.score > 0) && <div className="ac-category-results"><h3>Categorías con coincidencias</h3>{preview.ranking.filter((item) => item.score > 0).map((item) => <span className="ac-tag" key={item.slug}>{item.name} · {item.score}</span>)}</div>}
          </div>}
        </div>
      )}

      {editor && <Dialog title={`${editor.id === null ? (editor.kind === "category" ? "Nueva" : "Nuevo") : "Editar"} ${editor.kind === "category" ? "categoría" : "servicio"}`} busy={saving} onClose={() => setEditor(null)}>
        <form onSubmit={saveEditor}>
          <div className="ac-dialog-body">
            {formError && <div className="ac-notice ac-error" role="alert">{formError}</div>}
            <label className="ac-field">Nombre *<input autoFocus required maxLength={editor.kind === "category" ? 80 : 120} value={editor.values.name} onChange={(event) => setValue("name", event.target.value)} /></label>
            {editor.kind === "service" && <label className="ac-field">Categoría *<select required value={editor.values.category} onChange={(event) => setValue("category", event.target.value)}>
              <option value="">Selecciona una categoría</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_active ? "" : " (inactiva)"}</option>)}
            </select></label>}
            {editor.kind === "service" && selectedCategory && !selectedCategory.is_active && <p className="ac-warning-text">Este servicio permanecerá oculto para clientes mientras su categoría esté inactiva.</p>}
            <label className="ac-field">Descripción<textarea rows={3} maxLength={editor.kind === "category" ? 200 : undefined} value={editor.values.description} onChange={(event) => setValue("description", event.target.value)} /></label>
            <div className="ac-keyword-editor">
              <label className="ac-field">Palabras y frases clave<textarea rows={4} maxLength={6100} placeholder={"fuga de agua\ngrifo goteando\ntubería rota"} value={editor.values.keywords} onChange={(event) => setValue("keywords", event.target.value)} /></label>
              <p className="ac-muted">Una por línea o separadas por coma. Usa las expresiones del cliente. Hasta 50 frases de 120 caracteres; los duplicados se unifican.</p>
              <KeywordTags values={keywordsFromText(editor.values.keywords)} />
            </div>
            {editor.kind === "category" ? <div className="ac-form-grid">
              <label className="ac-field">Orden de aparición<input type="number" required min={0} max={32767} step={1} value={editor.values.order} onChange={(event) => setValue("order", event.target.value)} /><small className="ac-muted">Los números menores aparecen primero.</small></label>
              <label className="ac-field">Icono (opcional)<input maxLength={40} value={editor.values.icon} onChange={(event) => setValue("icon", event.target.value)} /><small className="ac-muted">Identificador del icono del catálogo.</small></label>
            </div> : <div className="ac-form-grid ac-form-grid-three">
              <label className="ac-field">Tarifa mínima (COP)<input type="number" min={0} max={9999999999.99} step="0.01" value={editor.values.minimum} onChange={(event) => setValue("minimum", event.target.value)} /></label>
              <label className="ac-field">Tarifa máxima (COP)<input type="number" min={0} max={9999999999.99} step="0.01" value={editor.values.maximum} onChange={(event) => setValue("maximum", event.target.value)} /></label>
              <label className="ac-field">Horas estimadas<input type="number" min={0} max={9999.9} step="0.1" value={editor.values.hours} onChange={(event) => setValue("hours", event.target.value)} /></label>
            </div>}
            <label className="ac-checkbox"><input type="checkbox" checked={editor.values.active} onChange={(event) => setValue("active", event.target.checked)} />{editor.kind === "category" ? "Categoría activa" : "Servicio activo"}</label>
            <p className="ac-muted">Los elementos inactivos se conservan para administración e historial y se retiran de nuevas búsquedas.</p>
          </div>
          <footer className="ac-dialog-footer"><button type="button" className="ac-button" disabled={saving} onClick={() => setEditor(null)}>Cancelar</button><button type="submit" className="ac-button ac-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</button></footer>
        </form>
      </Dialog>}

      {pending && <Dialog title={pending.action === "delete" ? "Eliminar del catálogo" : pending.active ? "Desactivar elemento" : "Activar elemento"} busy={saving} onClose={() => setPending(null)}>
        <div className="ac-dialog-body"><p>¿Confirmas la operación sobre <strong>{pending.name}</strong>?</p>
          <p className="ac-muted">{pending.action === "delete" ? "La eliminación es permanente y solo se permite cuando no hay registros relacionados. Si está en uso, puedes desactivarlo y conservar su historial."
            : pending.active ? pending.kind === "category" ? "La categoría y sus servicios dejarán de aparecer en nuevas búsquedas y sugerencias. Las solicitudes existentes se conservan." : "El servicio dejará de aparecer en nuevas búsquedas y sugerencias. Su historial se conserva."
              : "Volverá a estar disponible para nuevas búsquedas. Un servicio también necesita que su categoría esté activa."}</p>
          {formError && <div className="ac-notice ac-error" role="alert">{formError}</div>}
        </div>
        <footer className="ac-dialog-footer"><button type="button" className="ac-button" disabled={saving} onClick={() => setPending(null)}>Cancelar</button><button type="button" className={`ac-button ${pending.action === "delete" ? "ac-delete" : "ac-primary"}`} disabled={saving} onClick={() => { void confirmAction(); }}>{saving ? "Guardando…" : "Confirmar"}</button></footer>
      </Dialog>}
    </section>
  );
};
