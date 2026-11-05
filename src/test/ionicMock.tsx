import React, { useContext, useEffect } from "react";

const enterListeners = new Set<() => void>();
const leaveListeners = new Set<() => void>();
export const enterView = () => enterListeners.forEach((listener) => listener());
export const leaveView = () => leaveListeners.forEach((listener) => listener());
export function useIonViewWillEnter(callback: () => void, deps: React.DependencyList = []) {
  useEffect(() => { enterListeners.add(callback); return () => { enterListeners.delete(callback); }; }, deps);
}
export function useIonViewDidLeave(callback: () => void, deps: React.DependencyList = []) {
  useEffect(() => { leaveListeners.add(callback); return () => { leaveListeners.delete(callback); }; }, deps);
}
const Container = ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>;
export const IonPage = Container, IonContent = Container, IonHeader = Container, IonToolbar = Container, IonTitle = Container,
  IonButtons = Container, IonCard = Container, IonCardContent = Container, IonCardHeader = Container, IonCardTitle = Container,
  IonBadge = Container, IonLabel = Container, IonRefresher = Container, IonRefresherContent = Container;
export const IonMenuButton = () => null;
export const IonSpinner = () => <span>Cargando</span>;
export const IonIcon = () => null;
type ButtonProps = React.PropsWithChildren<{ onClick?: () => void; routerLink?: string; disabled?: boolean; type?: "button" | "submit" | "reset"; "aria-label"?: string }>;
export const IonButton = ({ children, onClick, routerLink, disabled, type = "button", "aria-label": label }: ButtonProps) => routerLink
  ? <a href={routerLink} aria-label={label}>{children}</a> : <button type={type} onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>;
export const IonModal = ({ isOpen, children, className }: React.PropsWithChildren<{ isOpen: boolean; className?: string }>) => isOpen ? <div role="dialog" className={className}>{children}</div> : null;
type AlertProps = { isOpen: boolean; header?: string; message?: string; buttons: Array<string | { text?: string; handler?: () => void }> };
export const IonAlert = ({ isOpen, header, message, buttons }: AlertProps) => isOpen ? <div role="dialog"><h2>{header}</h2><p>{message}</p>{buttons.map((button, index) => typeof button === "string" ? <button key={index}>{button}</button> : <button key={index} onClick={button.handler}>{button.text}</button>)}</div> : null;
export const IonToast = ({ isOpen, message }: { isOpen: boolean; message?: string }) => isOpen ? <div role="status">{message}</div> : null;
export const IonLoading = () => null;
export const IonSearchbar = ({ value, placeholder, onIonInput }: { value: string; placeholder?: string; onIonInput: (event: { detail: { value: string } }) => void }) => <input value={value} placeholder={placeholder} onChange={(event) => onIonInput({ detail: { value: event.target.value } })} />;
const SegmentContext = React.createContext<(value: string) => void>(() => undefined);
export const IonSegment = ({ children, onIonChange }: React.PropsWithChildren<{ onIonChange: (event: { detail: { value: string } }) => void }>) => <SegmentContext.Provider value={(value) => onIonChange({ detail: { value } })}>{children}</SegmentContext.Provider>;
export const IonSegmentButton = ({ children, value }: React.PropsWithChildren<{ value: string }>) => { const change = useContext(SegmentContext); return <button onClick={() => change(value)}>{children}</button>; };
