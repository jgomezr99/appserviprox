import React, { useEffect, useId, useRef, useState } from "react";
import "./RequestPhotoPicker.css";

type Props = { files: File[]; onChange: (files: File[]) => void; disabled?: boolean };
const MAX_FILES = 6;
const MAX_BYTES = 10 * 1024 * 1024;

/** Fotos locales de la solicitud: se envían junto con el formulario, no antes. */
const RequestPhotoPicker: React.FC<Props> = ({ files, onChange, disabled = false }) => {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<Array<{ file: File; url: string }>>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    setError("");
    return () => next.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [files]);

  const addFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(event.target.files || []);
    event.target.value = "";
    if (disabled || !added.length) return;
    if (added.some((file) => !file.type.startsWith("image/"))) { setError("Selecciona únicamente archivos de imagen."); return; }
    if (added.some((file) => file.size > MAX_BYTES)) { setError("Cada foto puede pesar como máximo 10 MB."); return; }
    if (files.length + added.length > MAX_FILES) { setError("Puedes adjuntar hasta 6 fotos. Retira una antes de añadir más."); return; }
    setError("");
    onChange([...files, ...added]);
  };

  return <div className="sp-request-photo-picker">
    <p id={`${id}-help`}>Añade fotos del problema antes de enviar la solicitud. Hasta 6 fotos, de máximo 10 MB cada una.</p>
    <div className="sp-request-photo-actions">
      <input ref={input} id={`${id}-files`} aria-label="Fotos del problema" aria-describedby={`${id}-help`} type="file" multiple accept="image/*" hidden disabled={disabled} onChange={addFiles} />
      <input ref={camera} aria-label="Foto desde la cámara" type="file" accept="image/*" capture="environment" hidden disabled={disabled} onChange={addFiles} />
      <button type="button" disabled={disabled || files.length >= MAX_FILES} onClick={() => input.current?.click()}>Adjuntar fotos</button>
      <button type="button" disabled={disabled || files.length >= MAX_FILES} onClick={() => camera.current?.click()}>Tomar foto</button>
    </div>
    {error && <p className="sp-request-photo-error" role="alert">{error}</p>}
    <p className="sp-request-photo-count" role="status">{files.length} de 6 fotos adjuntas</p>
    {previews.length > 0 && <ul className="sp-request-photo-list">{previews.map(({ file, url }, index) => <li key={url}>
      <img src={url} alt={`Foto adjunta ${index + 1}`} />
      <span title={file.name}>{file.name}</span>
      <button type="button" aria-label={`Quitar foto ${index + 1}`} disabled={disabled} onClick={() => onChange(files.filter((_, itemIndex) => itemIndex !== index))}>Quitar foto</button>
    </li>)}</ul>}
  </div>;
};

export default RequestPhotoPicker;
