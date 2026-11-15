import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
	IonButton,
	IonContent,
	IonIcon,
	IonImg,
	IonInput,
	IonPage,
	IonSpinner,
} from "@ionic/react";
import {
	arrowBackOutline,
	eyeOffOutline,
	eyeOutline,
	lockClosedOutline,
	personOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { authService } from "../services/auth";
import { checkBackendHealth, ApiError } from "../services/api";
import { getEntryRoute, isUserAdmin } from "../utils/routes";
import { useAuth } from "../context/AuthContext";
import { ServerConnectionModal } from "../components/ServerConnectionModal";
import logo from "../Assets/logo.png";
import "./AdministrativeLoginPage.css";

interface ChatMessage {
	id: string;
	sender: "agent" | "user";
	agentName?: string;
	agentAvatar?: string;
	text: string;
	timestamp: string;
	quickOptions?: { label: string; action: string }[];
}

const AGENT_AVATAR =
	"https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&auto=format&fit=crop&q=80";

const AdministrativeLoginPage: React.FC = () => {
	const history = useHistory();
	const { isAuthenticated, isLoading: sessionLoading, login, logout, user: sessionUser } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [recoveryStep, setRecoveryStep] = useState<"username" | "code">("username");
	const [recoveryCode, setRecoveryCode] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [recoveryMessage, setRecoveryMessage] = useState("");
	const [recoveryError, setRecoveryError] = useState("");
	const [recoverySubmitting, setRecoverySubmitting] = useState(false);
	const [serverModalOpen, setServerModalOpen] = useState(false);
	const [serverConnected, setServerConnected] = useState<boolean | null>(null);

	useEffect(() => {
		if (!sessionLoading && isAuthenticated) {
			if (isUserAdmin(sessionUser)) {
				history.replace("/admin");
			}
		}
	}, [history, isAuthenticated, sessionLoading, sessionUser]);

	useEffect(() => {
		checkBackendHealth().then((res) => {
			setServerConnected(res.ok);
		});
		const handleStatus = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			setServerConnected(Boolean(detail?.connected));
		};
		window.addEventListener("serviprox:connection-status", handleStatus);
		return () => window.removeEventListener("serviprox:connection-status", handleStatus);
	}, []);

	const [adminChatOpen, setAdminChatOpen] = useState(false);

	// Estado del Chat en Vivo
	const [chatInput, setChatInput] = useState("");
	const [isTyping, setIsTyping] = useState(false);
	const [attachment, setAttachment] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
		{
			id: "msg-welcome-admin",
			sender: "agent",
			agentName: "Sofía • Defensoría y Mesa Técnica",
			agentAvatar: AGENT_AVATAR,
			text: "¡Hola! Soy Sofía de la Defensoría y Mesa Técnica de Servicio Contratista Bogotá. ¿En qué te puedo ayudar hoy? Puedes radicar  directamente por este chat o reportar cualquier problema técnico con la app.",
			timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		},
	]);

	useEffect(() => {
		if (adminChatOpen) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [chatMessages, isTyping, adminChatOpen]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const trimmedUser = username.trim();
		if (!trimmedUser || password.length < 6 || submitting) return;

		setSubmitting(true);
		setError("");
		try {
			const currentUser = await login({
				username: trimmedUser,
				email: trimmedUser,
				password,
			});
			if (!isUserAdmin(currentUser)) {
				logout();
				setError("Acceso denegado. Este portal es exclusivo para personal administrativo de Serviprox. No se permite el acceso a cuentas ni correos de usuarios comunes (clientes o profesionales).");
				return;
			}
			history.replace("/admin");
		} catch (err: any) {
			if (err?.status === 401) {
				setError("Usuario o contraseña administrativa incorrectos.");
			} else if (err?.status >= 500 || err?.status === 502 || err?.status === 503) {
				setError("No pudimos conectar con el servidor backend ni la base de datos.");
			} else if (err?.message && !err.message.startsWith("API request")) {
				setError(err.message);
			} else {
				setError("No pudimos iniciar sesión. Verifica tus credenciales de administrador.");
			}
		} finally {
			setSubmitting(false);
		}
	};

	const handlePasswordReset = async () => {
		const trimmedUser = username.trim();
		if (!trimmedUser || recoverySubmitting) return;
		setRecoveryMessage("");
		setRecoveryError("");
		setRecoverySubmitting(true);
		try {
			if (recoveryStep === "username") {
				await authService.requestPasswordReset(trimmedUser);
				setRecoveryStep("code");
				setRecoveryMessage("Si el usuario existe, se enviará un código de verificación al correo asociado.");
			} else {
				await authService.confirmPasswordReset({
					email: trimmedUser,
					code: recoveryCode,
					new_password: newPassword,
				});
				setRecoveryStep("username");
				setRecoveryCode("");
				setNewPassword("");
				setRecoveryMessage("Contraseña administrativa actualizada correctamente. Ya puedes iniciar sesión con tu usuario.");
			}
		} catch (resetError) {
			const payload = resetError instanceof ApiError
				? resetError.payload as { detail?: unknown }
				: null;
			setRecoveryError(
				typeof payload?.detail === "string"
					? payload.detail
					: recoveryStep === "username"
						? "No pudimos enviar el código. Verifica la disponibilidad del backend o contacta soporte."
						: "No pudimos actualizar la contraseña. Verifica el código e inténtalo nuevamente."
			);
		} finally {
			setRecoverySubmitting(false);
		}
	};

	const resendPasswordResetCode = async () => {
		const trimmedUser = username.trim();
		if (!trimmedUser || recoverySubmitting) return;
		setRecoveryMessage("");
		setRecoveryError("");
		setRecoveryCode("");
		setRecoverySubmitting(true);
		try {
			await authService.requestPasswordReset(trimmedUser);
			setRecoveryMessage("Enviamos un código nuevo. El código anterior ya no es válido.");
		} catch (resetError) {
			const payload = resetError instanceof ApiError
				? resetError.payload as { detail?: unknown }
				: null;
			setRecoveryError(
				typeof payload?.detail === "string"
					? payload.detail
					: "No pudimos enviar otro código. Verifica que el backend y el correo estén disponibles."
			);
		} finally {
			setRecoverySubmitting(false);
		}
	};

	const pushAgentResponse = (text: string, quickOptions?: { label: string; action: string }[]) => {
		setIsTyping(true);
		setTimeout(() => {
			setIsTyping(false);
			setChatMessages((prev) => [
				...prev,
				{
					id: `agent-${Date.now()}`,
					sender: "agent",
					agentName: "Sofía • Defensoría y Mesa Técnica",
					agentAvatar: AGENT_AVATAR,
					text,
					timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					quickOptions,
				},
			]);
		}, 1000);
	};

	const handleQuickAction = (action: string) => {
		const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

		if (action === "problema_app") {
			setChatMessages((prev) => [
				...prev,
				{
					id: `user-${Date.now()}`,
					sender: "user",
					text: "📱 Deseo reportar un problema técnico con la plataforma.",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`Describe con detalle la falla técnica (por ejemplo: error en base de datos, problema de red o credenciales). Puedes adjuntar una captura con el botón de clip.`
			);
		} else if (action === "queja_contratista") {
			setChatMessages((prev) => [
				...prev,
				{
					id: `user-${Date.now()}`,
					sender: "user",
					text: "⚖️ Deseo radicar una queja formal contra un contratista.",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`El sistema de PQRS oficial de Bogotá está activo bajo la Ley 1480. Por favor indica el nombre de la empresa contratista o el número de radicado.`
			);
		} else if (action === "cerrar_chat") {
			setAdminChatOpen(false);
		} else if (action === "supervisor") {
			setChatMessages((prev) => [
				...prev,
				{
					id: `user-${Date.now()}`,
					sender: "user",
					text: "💬 Deseo hablar con un asesor.",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`Hemos transferido esta conversación a la Mesa Técnica de Supervisión Staff de Bogotá. Tu turno de atención es #1.`
			);
		}
	};

	const handleSendChatMessage = (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const text = chatInput.trim();
		if (!text) return;

		const userMsg: ChatMessage = {
			id: `user-${Date.now()}`,
			sender: "user",
			text,
			timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		};

		setChatMessages((prev) => [...prev, userMsg]);
		setChatInput("");

		// Respuesta automática
		const lower = text.toLowerCase();
		if (lower.includes("contraseña") || lower.includes("clave") || lower.includes("olvid")) {
			pushAgentResponse(
				"Para restablecer tu contraseña, vuelve al formulario de acceso, escribe el correo de tu cuenta y selecciona “Enviar código de recuperación”. No compartas tu contraseña ni códigos por este chat."
			);
		} else {
			pushAgentResponse(
				`Mensaje recibido: "${text}". Un analista de la Mesa Técnica de Bogotá está procesando tu solicitud.`
			);
		}
	};

	const handleAttachEvidence = () => {
		const name = "captura_evidencia_admin.png";
		setAttachment(name);
		setChatMessages((prev) => [
			...prev,
			{
				id: `user-att-${Date.now()}`,
				sender: "user",
				text: "📎 Adjunté captura de pantalla / evidencia del error.",
				timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
			},
		]);
		pushAgentResponse(
			`Evidencia adjuntada (${name}). El equipo técnico la analizará junto a los registros del servidor.`
		);
	};

	return (
		<IonPage className="admin-login-page">
			<IonContent fullscreen className="admin-login-content">
				<main className="admin-login-layout">
					
						
				

					<section className="admin-login-card" aria-labelledby="admin-login-title">
						<IonButton
							fill="clear"
							className="admin-login-back"
							onClick={() => history.replace("/login")}
						>
							<IonIcon slot="start" icon={arrowBackOutline} /> Volver al acceso de usuarios
						</IonButton>
						<div className="admin-login-logo">
							<IonImg src={logo} alt="Serviprox" />
						</div>

						<h1 id="admin-login-title">Login administrativo</h1>
						<p className="admin-login-subtitle">Acceso exclusivo con usuario de administración (no correos de usuarios comunes)</p>

						{error && (
							<p className="admin-login-error" role="alert" style={{ marginBottom: "16px" }}>
								{error}
							</p>
						)}

						<form onSubmit={handleSubmit} className="admin-login-form">
							<label>
								Usuario administrativo
								<div className="admin-login-input">
									<IonIcon icon={personOutline} />
									<IonInput
										type="text"
										value={username}
										autocomplete="username"
										placeholder="admin"
										required
										onIonInput={(event) => setUsername(String(event.detail.value ?? ""))}
									/>
								</div>
							</label>

							<label>
								Contraseña
								<div className="admin-login-input">
									<IonIcon icon={lockClosedOutline} />
									<IonInput
										type={showPassword ? "text" : "password"}
										value={password}
										placeholder="Tu contraseña"
										required
										onIonInput={(event) => setPassword(String(event.detail.value ?? ""))}
									/>
									<IonButton
										type="button"
										fill="clear"
										onClick={() => setShowPassword((current) => !current)}
										aria-label="Mostrar contraseña"
									>
										<IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
									</IonButton>
								</div>
							</label>

							{recoveryStep === "code" && (
								<>
									<label>
										Código de recuperación
										<div className="admin-login-input">
											<IonInput
												value={recoveryCode}
												inputmode="numeric"
												maxlength={6}
												placeholder="Código de 6 dígitos"
												onIonInput={(event) =>
													setRecoveryCode(String(event.detail.value ?? "").replace(/\D/g, ""))
												}
											/>
										</div>
									</label>
									<label>
										Nueva contraseña
										<div className="admin-login-input">
											<IonInput
												type="password"
												value={newPassword}
												autocomplete="new-password"
												placeholder="Nueva contraseña"
												onIonInput={(event) => setNewPassword(String(event.detail.value ?? ""))}
											/>
										</div>
									</label>
								</>
							)}

							<IonButton
								type="submit"
								expand="block"
								className="admin-login-submit"
								disabled={!username.trim() || password.length < 6 || submitting}
							>
								{submitting ? <IonSpinner name="crescent" /> : "Iniciar sesión"}
							</IonButton>

							<button
								type="button"
								className="admin-login-support"
								onClick={() => setAdminChatOpen(true)}
							>
								Abrir chat de soporte
							</button>
							<button
								type="button"
								className="admin-login-support"
								onClick={() => void handlePasswordReset()}
								disabled={
									!username.trim() ||
									recoverySubmitting ||
									(recoveryStep === "code" &&
										(recoveryCode.length !== 6 || newPassword.length < 6))
								}
							>
								{recoverySubmitting
									? "Procesando..."
									: recoveryStep === "username"
										? "Recuperar contraseña con usuario"
										: "Cambiar contraseña"}
							</button>
							{recoveryStep === "code" && (
								<button
									type="button"
									className="admin-login-support"
									onClick={() => void resendPasswordResetCode()}
									disabled={recoverySubmitting}
								>
									Enviar otro código
								</button>
							)}
							{recoveryMessage && <p role="status">{recoveryMessage}</p>}
							{recoveryError && <p className="admin-login-error" role="alert">{recoveryError}</p>}
						</form>
					</section>
				</main>

				{/* ═════════════════════════════════════════════════════════════════════
				    MODAL DE CHAT EN VIVO (DISEÑO EXACTO SERVIPROX BOGOTÁ)
				   ═════════════════════════════════════════════════════════════════════ */}
				{adminChatOpen &&
					createPortal(
						<div
							className="admin-chat-portal-backdrop"
							onClick={(e) => {
								if (e.target === e.currentTarget) setAdminChatOpen(false);
							}}
						>
							<div className="admin-chat-portal-dialog" role="dialog" aria-modal="true">
								{/* ── Encabezado Oscuro Vino con Robot y Punto Verde ── */}
								<header className="admin-chat-dialog-header">
									<div className="admin-chat-header-identity">
										<div className="admin-chat-bot-avatar">
											{/* Icono de Robot SVG idéntico */}
											<svg
												width="22"
												height="22"
												viewBox="0 0 24 24"
												fill="none"
												stroke="#fda4af"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<rect width="18" height="12" x="3" y="6" rx="2" />
												<path d="M12 6V2" />
												<path d="M2 12h1" />
												<path d="M21 12h1" />
												<path d="M9 13v-2" />
												<path d="M15 13v-2" />
											</svg>
											{/* Punto verde de conexión */}
											<span className="admin-chat-bot-status-dot" />
										</div>

										<div className="admin-chat-header-text">
											<div className="admin-chat-header-title-row">
												<h3>Chat en Vivo: Quejas &amp; Soporte Bogotá</h3>
												<span className="admin-chat-online-badge">EN LÍNEA</span>
											</div>
											<p className="admin-chat-header-subtitle">
												Radica quejas de contratistas o reporta problemas con la app al instante
											</p>
										</div>
									</div>

									<button
										type="button"
										className="admin-chat-close-btn"
										onClick={() => setAdminChatOpen(false)}
										aria-label="Cerrar chat"
									>
										<svg
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2.5"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<line x1="18" y1="6" x2="6" y2="18" />
											<line x1="6" y1="6" x2="18" y2="18" />
										</svg>
									</button>
								</header>

								{/* ── Barra de Diagnóstico Automático ── */}
								<div className="admin-chat-diagnostic-bar">
									<span>
										📱 Diagnóstico automático: <strong>Bogotá D.C. • App v2.4 Activa</strong>
									</span>
									<span className="admin-chat-ssl-tag">Conexión Segura SSL</span>
								</div>

								{/* ── Flujo de Mensajes ── */}
								<div className="admin-chat-stream">
									{chatMessages.map((msg) => {
										const isAgent = msg.sender === "agent";
										return (
											<div
												key={msg.id}
												className={`admin-chat-msg-row ${isAgent ? "from-support" : "from-user"}`}
											>
												{isAgent && (
													<img
														src={msg.agentAvatar || AGENT_AVATAR}
														alt="Sofía"
														className="admin-chat-avatar-img"
													/>
												)}

												<div className="admin-chat-bubble-wrap">
													<div
														className={`admin-chat-bubble ${
															isAgent ? "support-bubble" : "user-bubble"
														}`}
													>
														{isAgent && (
															<div className="admin-chat-agent-label">
																{msg.agentName || "Sofía • Defensoría y Mesa Técnica"}
															</div>
														)}
														<p style={{ margin: 0 }}>{msg.text}</p>

														{/* Botones de acción rápida debajo del mensaje */}
														{isAgent && msg.quickOptions && msg.quickOptions.length > 0 && (
															<div className="admin-chat-chips-group">
																{msg.quickOptions.map((opt, i) => (
																	<button
																		key={i}
																		type="button"
																		className="admin-chat-chip-btn"
																		onClick={() => handleQuickAction(opt.action)}
																	>
																		{opt.label}
																	</button>
																))}
															</div>
														)}
													</div>

													<span className="admin-chat-time-stamp">{msg.timestamp}</span>
												</div>
											</div>
										);
									})}

									{isTyping && (
										<div className="admin-chat-typing-row">
											<svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="#e11d48"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
												style={{ animation: "spin 1s linear infinite" }}
											>
												<rect width="18" height="12" x="3" y="6" rx="2" />
												<path d="M12 6V2" />
												<path d="M2 12h1" />
												<path d="M21 12h1" />
											</svg>
											<span>Sofía está escribiendo...</span>
										</div>
									)}

									<div ref={messagesEndRef} />
								</div>

								{/* ── Barra de Entrada (Composer) ── */}
								<div className="admin-chat-composer-box">
									<form onSubmit={handleSendChatMessage} className="admin-chat-composer-row">
										<button
											type="button"
											className="admin-chat-clip-btn"
											onClick={handleAttachEvidence}
											title="Adjuntar evidencia o captura"
										>
											<svg
												width="18"
												height="18"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
											</svg>
										</button>

										<input
											type="text"
											value={chatInput}
											onChange={(e) => setChatInput(e.target.value)}
											placeholder="Escribe tu queja o problema con la app aquí..."
											className="admin-chat-input-pill"
										/>

										<button
											type="submit"
											disabled={!chatInput.trim()}
											className="admin-chat-send-btn"
										>
											<svg
												width="16"
												height="16"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2.2"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<line x1="22" y1="2" x2="11" y2="13" />
												<polygon points="22 2 15 22 11 13 2 9 22 2" />
											</svg>
											<span>Enviar</span>
										</button>
									</form>

									{attachment && (
										<div className="admin-chat-attachment-pill">
											<span>📎 Adjunto: {attachment}</span>
											<button
												type="button"
												onClick={() => setAttachment(null)}
												title="Quitar adjunto"
											>
												✕
											</button>
										</div>
									)}
								</div>
							</div>
						</div>,
						document.body
					)}

			</IonContent>
			<ServerConnectionModal
				isOpen={serverModalOpen}
				onClose={() => setServerModalOpen(false)}
			/>
		</IonPage>
	);
};

export default AdministrativeLoginPage;