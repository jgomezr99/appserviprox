import React, { useEffect, useState } from "react";
import {
	IonButton,
	IonButtons,
	IonContent,
	IonHeader,
	IonIcon,
	IonInput,
	IonMenuButton,
	IonModal,
	IonPage,
	IonSelect,
	IonSelectOption,
	IonTitle,
	IonTextarea,
	IonToast,
	IonToggle,
	IonToolbar,
} from "@ionic/react";
import {
	checkmarkCircleOutline,
	createOutline,
	moonOutline,
	personCircleOutline,
	saveOutline,
} from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth";
import "./RolePages.css";

const DELETE_REASONS = [
	"Ya no uso la aplicación",
	"No encontré el servicio que buscaba",
	"Tuve una mala experiencia",
	"Preocupaciones de privacidad",
	"Otro",
];

const ClientProfilePage: React.FC = () => {
	const { user, updateMe, logout } = useAuth();
	const [isEditing, setIsEditing] = useState(false);
	const [darkMode, setDarkMode] = useState(() => {
		return localStorage.getItem("serviprox:dark-mode") === "true";
	});
	const [email, setEmail] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [phone, setPhone] = useState("");
	const [documentId, setDocumentId] = useState("");
	const [city, setCity] = useState("Bogotá");
	const [address, setAddress] = useState("");
	const [saving, setSaving] = useState(false);
	const [toast, setToast] = useState("");
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteReason, setDeleteReason] = useState("");
	const [deleteComment, setDeleteComment] = useState("");
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		setFirstName(user?.first_name || "");
		setEmail(user?.email || "");
		setLastName(user?.last_name || "");
		setPhone(user?.phone || "");
		setDocumentId(user?.document_id || "");
		setCity(user?.city || "Bogotá");
		setAddress(user?.address || "");
	}, [user]);

	useEffect(() => {
		document.body.classList.toggle("dark", darkMode);
		localStorage.setItem("serviprox:dark-mode", String(darkMode));
	}, [darkMode]);

	const toggleDarkMode = () => {
		setDarkMode((current) => !current);
	};

	const handleSave = async (event: React.FormEvent) => {
		event.preventDefault();
		if (saving) return;
		setSaving(true);
		try {
			await updateMe({
				email: email.trim().toLowerCase(),
				first_name: firstName.trim(),
				last_name: lastName.trim(),
				phone: phone.trim(),
				document_id: documentId.trim(),
				city: city.trim(),
				address: address.trim(),
			});
			setIsEditing(false);
			setToast("Datos personales guardados correctamente.");
		} catch {
			setToast("No se pudieron guardar los datos personales.");
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteAccount = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!deleteReason.trim() || deleting) return;
		setDeleting(true);
		try {
			const comment = deleteComment.trim();
			await authService.deleteCurrentUser(comment ? `${deleteReason}: ${comment}` : deleteReason);
			logout();
			window.location.assign("/login");
		} catch {
			setToast("No se pudo eliminar la cuenta. Inténtalo nuevamente.");
		} finally {
			setDeleting(false);
		}
	};

	return (
		<IonPage>
			<IonHeader>
				<IonToolbar>
					<IonButtons slot="start">
						<IonMenuButton autoHide={false} menu="main-menu" />
					</IonButtons>
					<IonTitle>Perfil cliente</IonTitle>
				</IonToolbar>
			</IonHeader>
			<IonContent fullscreen className="sp-role-content">
				<main className="sp-role-page client-profile-page">
					<header className="sp-role-header">
						<span className="sp-role-kicker">CUENTA DE CLIENTE</span>
						<h1>Datos personales</h1>
						<p>Administra la información que usaremos para tus servicios.</p>
					</header>

					<section className="sp-card client-profile-card">
						<div className="sp-card-header">
							<div className="sp-icon-tile"><IonIcon icon={personCircleOutline} /></div>
							<div className="sp-card-title">
								<h2>Información personal</h2>
								<p>{user?.email || "Cuenta cliente"}</p>
							</div>
							{!isEditing && <IonButton fill="outline" size="small" onClick={() => setIsEditing(true)}>
								<IonIcon slot="start" icon={createOutline} /> Editar
							</IonButton>}
						</div>

						{isEditing ? (
							<form className="sp-form" onSubmit={handleSave}>
								<div className="sp-grid sp-grid--two">
									<label className="sp-field">Correo electrónico<IonInput type="email" value={email} required onIonInput={(e) => setEmail(String(e.detail.value ?? ""))} /></label>
									<label className="sp-field">Nombre<IonInput value={firstName} onIonInput={(e) => setFirstName(String(e.detail.value ?? ""))} /></label>
									<label className="sp-field">Apellido<IonInput value={lastName} onIonInput={(e) => setLastName(String(e.detail.value ?? ""))} /></label>
									<label className="sp-field">Teléfono<IonInput type="tel" value={phone} onIonInput={(e) => setPhone(String(e.detail.value ?? ""))} /></label>
									<label className="sp-field">Documento<IonInput value={documentId} onIonInput={(e) => setDocumentId(String(e.detail.value ?? ""))} /></label>
									<label className="sp-field">Ciudad<IonInput value={city} onIonInput={(e) => setCity(String(e.detail.value ?? ""))} /></label>
									<label className="sp-field">Dirección<IonInput value={address} onIonInput={(e) => setAddress(String(e.detail.value ?? ""))} /></label>
								</div>
								<div className="client-profile-actions">
									<IonButton type="submit" disabled={saving}><IonIcon slot="start" icon={saveOutline} />{saving ? "Guardando..." : "Guardar cambios"}</IonButton>
									<IonButton type="button" fill="clear" onClick={() => setIsEditing(false)}>Cancelar</IonButton>
								</div>
							</form>
						) : (
							<div className="client-profile-summary">
								<p><strong>Nombre</strong><span>{[user?.first_name, user?.last_name].filter(Boolean).join(" ") || "No registrado"}</span></p>
								<p><strong>Teléfono</strong><span>{user?.phone || "No registrado"}</span></p>
								<p><strong>Ciudad</strong><span>{user?.city || "No registrada"}</span></p>
								<p><strong>Dirección</strong><span>{user?.address || "No registrada"}</span></p>
							</div>
						)}
					</section>

					<section className="sp-card client-profile-preferences-card">
						<div className="client-profile-preference-label">
							<IonIcon icon={moonOutline} />
							<span><strong>Modo oscuro</strong><small>Cambia la apariencia de la aplicación</small></span>
						</div>
						<IonToggle checked={darkMode} onIonChange={toggleDarkMode} aria-label="Modo oscuro" />
					</section>

					<section className="sp-card client-profile-danger-card">
						<div>
							<h2>Eliminar cuenta</h2>
							<p>Esta acción elimina tu cuenta y tus datos de acceso.</p>
						</div>
						<IonButton color="danger" fill="outline" onClick={() => setDeleteOpen(true)}>
							Eliminar cuenta
						</IonButton>
					</section>
				</main>
			</IonContent>
			<IonToast isOpen={!!toast} message={toast} duration={2600} onDidDismiss={() => setToast("")} />
			<IonModal isOpen={deleteOpen} onDidDismiss={() => setDeleteOpen(false)}>
				<div className="client-profile-delete-modal">
					<h2>¿Por qué deseas eliminar tu cuenta?</h2>
					<p>Tu respuesta nos ayuda a mejorar Serviprox.</p>
					<form onSubmit={handleDeleteAccount}>
						<IonSelect
							label="Motivo"
							labelPlacement="stacked"
							value={deleteReason}
							placeholder="Selecciona un motivo"
							interface="popover"
							onIonChange={(event) => setDeleteReason(String(event.detail.value ?? ""))}
						>
							{DELETE_REASONS.map((reason) => (
								<IonSelectOption key={reason} value={reason}>
									{reason}
								</IonSelectOption>
							))}
						</IonSelect>
						<IonTextarea
							label="Cuéntanos más (opcional)"
							labelPlacement="stacked"
							value={deleteComment}
							placeholder="¿Qué podríamos mejorar?"
							autoGrow
							onIonInput={(event) => setDeleteComment(String(event.detail.value ?? ""))}
						/>
						<div className="client-profile-actions">
							<IonButton type="submit" color="danger" disabled={!deleteReason.trim() || deleting}>
								{deleting ? "Eliminando..." : "Confirmar eliminación"}
							</IonButton>
							<IonButton type="button" fill="clear" onClick={() => setDeleteOpen(false)}>Cancelar</IonButton>
						</div>
					</form>
				</div>
			</IonModal>
		</IonPage>
	);
};

export default ClientProfilePage;