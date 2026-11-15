import React, { useState } from "react";
import { IonButton } from "@ionic/react";
import { cardOutline, businessOutline } from "ionicons/icons";
import type { DemoPaymentDetails, DemoPaymentMethod } from "../../services/serviprox";
import "./historiadepago.css";
import { buttonStyle, fillAmount, type PaymentFormConfig } from "../../services/paymentForm";
import ServiceButtonContent from "../serviprox/ServiceButtonContent";

type Props = {
  amountLabel: string;
  busy: boolean;
  config?: PaymentFormConfig;
  methods?: DemoPaymentMethod[];
  title?: string;
  note?: string;
  submitLabel?: string;
  transferLabel?: string;
  onSubmit: (details: DemoPaymentDetails) => void | Promise<void>;
};

type Errors = Record<string, string>;

const BANKS = [
  "Bancolombia",
  "Banco de Bogotá",
  "Davivienda",
  "BBVA Colombia",
  "Banco de Occidente",
  "Banco Popular",
  "Scotiabank Colpatria",
  "Nequi",
];

const METHODS: Array<[DemoPaymentMethod, string]> = [
  ["credit", "Tarjeta de crédito"],
  ["debit", "Tarjeta débito"],
  ["transfer", "Transferencia"],
  ["wallet", "Billetera"],
];
const DEFAULT_METHODS: DemoPaymentMethod[] = ["credit", "debit", "transfer"];

const luhnValid = (digits: string) => {
  let total = 0;
  [...digits].reverse().forEach((char, index) => {
    let value = Number(char);
    if (index % 2) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    total += value;
  });
  return total % 10 === 0;
};

const formatCardNumber = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();

const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

const validateCard = (card: Record<string, string>): Errors => {
  const errors: Errors = {};
  const digits = card.number.replace(/\s/g, "");
  if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) {
    errors.number = "El número de tarjeta no es válido.";
  }
  if (card.holder.trim().length < 3) errors.holder = "Ingresa el nombre como aparece en la tarjeta.";
  const match = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) {
    errors.expiry = "Usa el formato MM/AA.";
  } else {
    const now = new Date();
    const year = 2000 + Number(match[2]);
    if (year < now.getFullYear() || (year === now.getFullYear() && Number(match[1]) < now.getMonth() + 1)) {
      errors.expiry = "La tarjeta está vencida.";
    }
  }
  if (!/^\d{3,4}$/.test(card.cvv)) errors.cvv = "El código debe tener 3 o 4 dígitos.";
  return errors;
};

const validateTransfer = (transfer: Record<string, string>): Errors => {
  const errors: Errors = {};
  if (!transfer.bank) errors.bank = "Selecciona el banco.";
  if (!/^[A-Za-z0-9]{5,15}$/.test(transfer.document)) errors.document = "El número de documento no es válido.";
  return errors;
};

const TestPaymentForm: React.FC<Props> = ({
  amountLabel,
  busy,
  onSubmit,
  config,
  methods: methodsProp,
  title: titleProp,
  note: noteProp,
  submitLabel: submitLabelProp,
  transferLabel,
}) => {
  const configured = config?.methods.filter((m) => m.enabled) ?? [];
  const methods: DemoPaymentMethod[] = methodsProp ?? (configured.length ? configured.map((m) => m.id) : DEFAULT_METHODS);
  const labelFor = (value: DemoPaymentMethod, fallback: string) =>
    (value === "transfer" && transferLabel) || config?.methods.find((m) => m.id === value)?.label || fallback;
  const title = titleProp ?? (config ? fillAmount(config.title, amountLabel) : undefined);
  const note = noteProp ?? config?.note;
  const showInstallments = config?.show_installments !== false;
  const showReference = config?.show_transfer_reference !== false;
  const style = config ? buttonStyle(config) : undefined;
  const [chosen, setMethod] = useState<DemoPaymentMethod>(methods[0]);
  const method = methods.includes(chosen) ? chosen : methods[0];
  const [walletPhone, setWalletPhone] = useState("");
  const [card, setCard] = useState({ number: "", holder: "", expiry: "", cvv: "", installments: "1" });
  const [transfer, setTransfer] = useState({
    bank: "",
    accountType: "savings",
    documentType: "CC",
    document: "",
    reference: "",
  });
  const [errors, setErrors] = useState<Errors>({});

  const isCard = method === "credit" || method === "debit";
  const isWallet = method === "wallet";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = isCard
      ? validateCard(card)
      : isWallet
        ? /^3\d{9}$/.test(walletPhone) ? {} : { phone: "Ingresa un celular colombiano de 10 dígitos que empiece por 3." }
        : validateTransfer(transfer);
    setErrors(found);
    if (Object.keys(found).length) return;
    if (isWallet) {
      void onSubmit({ method, phone: walletPhone });
    } else if (isCard) {
      void onSubmit({
        method,
        card_number: card.number.replace(/\s/g, ""),
        card_holder: card.holder.trim(),
        expiry: card.expiry,
        cvv: card.cvv,
        installments: method === "credit" ? Number(card.installments) : 1,
      });
    } else {
      void onSubmit({
        method,
        bank: transfer.bank,
        account_type: transfer.accountType as "savings" | "checking",
        document_type: transfer.documentType as "CC" | "CE" | "NIT" | "PP",
        document_number: transfer.document,
        transfer_reference: transfer.reference.trim(),
      });
    }
  };

  const field = (name: string) => (errors[name] ? <small className="sp-error" role="alert">{errors[name]}</small> : null);

  return (
    <form className="sp-test-payment" onSubmit={submit} noValidate>
      <h3>{title ?? `Pago de prueba · ${amountLabel}`}</h3>
      <p>{note ?? "Modo de pruebas: no se realiza ningún cobro real ni se guardan los datos ingresados."}</p>

      <div className="sp-test-payment-methods" role="tablist" aria-label="Método de pago">
        {methods.map((value) => [value, METHODS.find(([id]) => id === value)?.[1] ?? value] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={method === value}
            className={method === value ? "is-active" : ""}
            onClick={() => {
              setMethod(value);
              setErrors({});
            }}
          >
            {labelFor(value, label)}
          </button>
        ))}
      </div>

      {isWallet ? (
        <div className="sp-test-payment-grid">
          <label className="is-wide">
            Número de celular (Nequi / Daviplata)
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder="3001234567"
              value={walletPhone}
              onChange={(e) => setWalletPhone(e.target.value.replace(/\D/g, ""))}
            />
            {field("phone")}
          </label>
        </div>
      ) : isCard ? (
        <div className="sp-test-payment-grid">
          <label className="is-wide">
            Número de tarjeta
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
            />
            {field("number")}
          </label>
          <label className="is-wide">
            Nombre del titular
            <input
              autoComplete="off"
              placeholder="Como aparece en la tarjeta"
              value={card.holder}
              onChange={(e) => setCard({ ...card, holder: e.target.value })}
            />
            {field("holder")}
          </label>
          <label>
            Vencimiento
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM/AA"
              value={card.expiry}
              onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
            />
            {field("expiry")}
          </label>
          <label>
            CVV
            <input
              inputMode="numeric"
              type="password"
              autoComplete="off"
              maxLength={4}
              placeholder="123"
              value={card.cvv}
              onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "") })}
            />
            {field("cvv")}
          </label>
          {method === "credit" && showInstallments && (
            <label className="is-wide">
              Cuotas
              <select value={card.installments} onChange={(e) => setCard({ ...card, installments: e.target.value })}>
                {[1, 2, 3, 6, 12, 24, 36].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "cuota" : "cuotas"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <small className="is-wide sp-muted">
            Tarjeta de prueba: 4242 4242 4242 4242, cualquier fecha futura y CVV 123. Para simular un pago rechazado usa
            4000 0000 0000 0002.
          </small>
        </div>
      ) : (
        <div className="sp-test-payment-grid">
          <label className="is-wide">
            Banco
            <select value={transfer.bank} onChange={(e) => setTransfer({ ...transfer, bank: e.target.value })}>
              <option value="">Selecciona tu banco</option>
              {BANKS.map((bank) => (
                <option key={bank}>{bank}</option>
              ))}
            </select>
            {field("bank")}
          </label>
          <label>
            Tipo de cuenta
            <select
              value={transfer.accountType}
              onChange={(e) => setTransfer({ ...transfer, accountType: e.target.value })}
            >
              <option value="savings">Ahorros</option>
              <option value="checking">Corriente</option>
            </select>
          </label>
          <label>
            Tipo de documento
            <select
              value={transfer.documentType}
              onChange={(e) => setTransfer({ ...transfer, documentType: e.target.value })}
            >
              <option value="CC">Cédula de ciudadanía</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="NIT">NIT</option>
              <option value="PP">Pasaporte</option>
            </select>
          </label>
          <label>
            Número de documento
            <input
              autoComplete="off"
              value={transfer.document}
              onChange={(e) => setTransfer({ ...transfer, document: e.target.value.replace(/[^A-Za-z0-9]/g, "") })}
            />
            {field("document")}
          </label>
          {showReference && (
            <label>
              Referencia de la transferencia (opcional; escribe RECHAZADO para simular un rechazo)
              <input
                autoComplete="off"
                maxLength={40}
                value={transfer.reference}
                onChange={(e) => setTransfer({ ...transfer, reference: e.target.value })}
              />
            </label>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: style?.justify ?? "stretch" }}>
        <IonButton
          type="submit"
          className="sp-primary-button"
          disabled={busy}
          size={style?.size}
          expand={style?.expand}
          style={style?.css}
        >
          <ServiceButtonContent
            busy={busy}
            icon={isCard ? cardOutline : businessOutline}
            label={
              submitLabelProp ??
              (config
                ? fillAmount(isCard ? config.submit_label : config.transfer_submit_label, amountLabel)
                : isCard
                  ? `Pagar ${amountLabel}`
                  : `Confirmar transferencia de ${amountLabel}`)
            }
            busyLabel="Procesando..."
          />
        </IonButton>
      </div>
    </form>
  );
};

export default TestPaymentForm;
