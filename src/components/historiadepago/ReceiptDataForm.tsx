import React, { useState } from "react";
import { IonButton } from "@ionic/react";

export type ReceiptClientData = {
  first_name?: string;
  last_name?: string;
  document_id?: string;
  phone?: string;
};

type Props = {
  needsName: boolean;
  needsDocument: boolean;
  needsPhone: boolean;
  busy: boolean;
  onSave: (data: ReceiptClientData) => void | Promise<void>;
};

/** Pide al cliente los datos que el comprobante necesita y aún no están en su perfil. */
const ReceiptDataForm: React.FC<Props> = ({ needsName, needsDocument, needsPhone, busy, onSave }) => {
  const [values, setValues] = useState({ first_name: "", last_name: "", document_id: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found: Record<string, string> = {};
    if (needsName && values.first_name.trim().length < 2) found.first_name = "Ingresa tus nombres.";
    if (needsName && values.last_name.trim().length < 2) found.last_name = "Ingresa tus apellidos.";
    if (needsDocument && !/^[A-Za-z0-9]{5,15}$/.test(values.document_id.trim())) {
      found.document_id = "El documento debe tener entre 5 y 15 letras o números.";
    }
    if (needsPhone && !/^\+?\d{7,15}$/.test(values.phone.replace(/[\s-]/g, ""))) {
      found.phone = "Ingresa un teléfono válido (7 a 15 dígitos).";
    }
    setErrors(found);
    if (Object.keys(found).length) return;
    const data: ReceiptClientData = {};
    if (needsName) {
      data.first_name = values.first_name.trim();
      data.last_name = values.last_name.trim();
    }
    if (needsDocument) data.document_id = values.document_id.trim();
    if (needsPhone) data.phone = values.phone.replace(/[\s-]/g, "");
    void onSave(data);
  };

  const error = (name: string) =>
    errors[name] ? (
      <small className="sp-error" role="alert">
        {errors[name]}
      </small>
    ) : null;

  return (
    <form className="sp-test-payment fin-no-print" onSubmit={submit} noValidate>
      <h3>Completa tus datos para el comprobante</h3>
      <p className="sp-muted">Se guardan en tu perfil y se incluirán en el PDF del comprobante.</p>
      <div className="sp-test-payment-grid">
        {needsName && (
          <>
            <label>
              Nombres
              <input
                autoComplete="given-name"
                value={values.first_name}
                onChange={(e) => setValues({ ...values, first_name: e.target.value })}
              />
              {error("first_name")}
            </label>
            <label>
              Apellidos
              <input
                autoComplete="family-name"
                value={values.last_name}
                onChange={(e) => setValues({ ...values, last_name: e.target.value })}
              />
              {error("last_name")}
            </label>
          </>
        )}
        {needsDocument && (
          <label>
            Documento / NIT
            <input
              autoComplete="off"
              value={values.document_id}
              onChange={(e) => setValues({ ...values, document_id: e.target.value.replace(/[^A-Za-z0-9]/g, "") })}
            />
            {error("document_id")}
          </label>
        )}
        {needsPhone && (
          <label>
            Teléfono
            <input
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(e) => setValues({ ...values, phone: e.target.value })}
            />
            {error("phone")}
          </label>
        )}
      </div>
      <IonButton type="submit" className="sp-primary-button" disabled={busy}>
        {busy ? "Guardando..." : "Guardar y generar comprobante"}
      </IonButton>
    </form>
  );
};

export default ReceiptDataForm;
