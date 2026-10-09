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
	mailOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { authService } from "../services/auth";
import { checkBackendHealth, ApiError } from "../services/api";
import { getEntryRoute } from "../utils/routes";
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
	const { login } = useAuth();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [serverModalOpen, setServerModalOpen] = useState(false);
	const [serverConnected, setServerConnected] = useState<boolean | null>(null);

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

	// Modales
	const [supportOpen, setSupportOpen] = useState(false);
	const [adminChatOpen, setAdminChatOpen] = useState(false);

	// Soporte de pregunta de seguridad
	const [securityAnswer, setSecurityAnswer] = useState("");
	const [supportUsername, setSupportUsername] = useState("");
	const [securityQuestion, setSecurityQuestion] = useState("");
	const [loadingQuestion, setLoadingQuestion] = useState(false);

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
			quickOptions: [
				{ label: "🔑 Recuperar contraseña administrativa", action: "recuperar_pass" },
				{ label: "🛡️ Validar pregunta de seguridad", action: "pregunta_seguridad" },
				
			],
		},
	]);

	useEffect(() => {
		if (adminChatOpen) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [chatMessages, isTyping, adminChatOpen]);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!username.trim() || password.length < 6 || submitting) return;

		setSubmitting(true);
		setError("");
		try {
			let currentUser: any;
			try {
				currentUser = await authService.loginWithUsername(username.trim(), password);
			} catch (apiErr) {
				// Fallback a login por useAuth para credenciales demo staff (admin@serviprox.com o admin)
				currentUser = await login({ email: username.trim(), password });
			}
			if (currentUser.role !== "staff") {
				setError("Esta cuenta no tiene permisos administrativos.");
				return;
			}
			history.replace("/admin");
		} catch (err: any) {
			if (err?.status === 401) {
				setError("Usuario o contraseña incorrectos.");
			} else if (err?.status >= 500 || err?.status === 502 || err?.status === 503) {
				setError("No pudimos conectar con el servidor backend ni la base de datos.");
			} else if (err?.message && !err.message.startsWith("API request")) {
				setError(err.message);
			} else {
				setError("No pudimos iniciar sesión. Verifica tu conexión con el backend.");
			}
		} finally {
			setSubmitting(false);
		}
	};

	const handleUsernameForRecovery = async (event: any) => {
		const user = String(event.detail.value ?? "");
		setSupportUsername(user);

		if (user.trim().length > 0) {
			setLoadingQuestion(true);
			try {
				const response = await authService.getSecurityQuestion(user.trim());
				setSecurityQuestion(response.security_question);
			} catch {
				setSecurityQuestion("¿Cuál es la ciudad registrada en tu cuenta administrativa?");
			} finally {
				setLoadingQuestion(false);
			}
		} else {
			setSecurityQuestion("");
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

		if (action === "recuperar_pass") {
			setChatMessages((prev) => [
				...prev,
				{
					id: `user-${Date.now()}`,
					sender: "user",
					text: "🔑 Deseo recuperar mi contraseña administrativa de Staff.",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`Entendido. Para restablecer tu acceso como Staff, por favor escribe aquí tu nombre de usuario o correo corporativo. Consultaremos tu estado en la base de datos de Bogotá inmediatamente.`,
				[
					{ label: "🛡️ Tengo mi pregunta de seguridad", action: "pregunta_seguridad" },
					{ label: "💬 Hablar con un asesor  humano", action: "supervisor" },
				]
			);
		} else if (action === "pregunta_seguridad") {
			setChatMessages((prev) => [
				...prev,
				{
					id: `user-${Date.now()}`,
					sender: "user",
					text: "🛡️ Deseo validar mi pregunta de seguridad registrada.",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`Perfecto. La pregunta de seguridad asignada a las cuentas Staff de Bogotá es: "¿Cuál es la ciudad registrada en tu cuenta?". Por favor escribe tu respuesta en el chat.`,
				[
					{ label: "Bogotá", action: "resp_bogota" },
					{ label: "Medellín", action: "resp_otra" },
					{ label: "Cali", action: "resp_otra" },
				]
			);
		} else if (action === "resp_bogota") {
			setChatMessages((prev) => [
				...prev,
				{
					id: `user-${Date.now()}`,
					sender: "user",
					text: "Bogotá",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`✅ ¡Respuesta de seguridad verificada con éxito!\n\nHemos habilitado el proceso de restablecimiento seguro para tu cuenta. ¿Deseas que enviemos un enlace temporal de acceso al correo vinculado o prefieres abrir la consola de reseteo?`,
				[
					{ label: "📧 Enviar enlace al correo", action: "enviar_correo" },
					{ label: "Volver al inicio de sesión", action: "cerrar_chat" },
				]
			);
		} else if (action === "resp_otra") {
			setChatMessages((prev) => [
				...prev,
				{
					id: `user-${Date.now()}`,
					sender: "user",
					text: "Respuesta de seguridad alternativa.",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`La respuesta no coincide con el registro central. Por favor verifica los datos o escribe tu usuario para asistirte manualmente.`
			);
		} else if (action === "problema_app") {
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
		} else if (action === "enviar_correo") {
			setChatMessages((prev) => [
				...prev,
				{
					id: `user-${Date.now()}`,
					sender: "user",
					text: "📧 Por favor envíen el enlace a mi correo.",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`📩 Se ha generado la solicitud de recuperación. Si el usuario existe en el sistema administrativo, recibirás las instrucciones en breve.`
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
				`Recibido. He registrado tu solicitud de recuperación para el usuario o dato ingresado: "${text}". ¿Confirmas que deseas validar tu pregunta de seguridad para continuar?`,
				[
					{ label: "🛡️ Sí, responder pregunta", action: "pregunta_seguridad" },
					{ label: "📧 Enviar código", action: "enviar_correo" },
				]
			);
		} else if (lower.includes("bogota") || lower.includes("bogotá")) {
			handleQuickAction("resp_bogota");
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
							<IonIcon slot="start" icon={arrowBackOutline} /> Volver
						</IonButton>
						<div className="admin-login-logo">
							<IonImg src={logo} alt="Serviprox" />
						</div>

					
						<h1 id="admin-login-title">Login administrativo</h1>
						<p className="admin-login-subtitle">Ingresa tus credenciales para acceder</p>

						<form onSubmit={handleSubmit} className="admin-login-form">
							<label>
								Usuario
								<div className="admin-login-input">
									<IonIcon icon={mailOutline} />
									<IonInput
										type="text"
										value={username}
										placeholder="Usuario administrativo"
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
								Olvidaste tu contraseña Recuperar con soporte
							</button>
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

				{/* ═════════════════════════════════════════════════════════════════════
				    MODAL DE PREGUNTA DE SEGURIDAD (OPCIONAL/ALTERNATIVA)
				   ═════════════════════════════════════════════════════════════════════ */}
				{supportOpen &&
					createPortal(
						<div
							className="admin-support-modal-backdrop"
							onClick={(e) => {
								if (e.target === e.currentTarget) setSupportOpen(false);
							}}
						>
							<div className="admin-support-modal-dialog" role="dialog" aria-modal="true">
								<header className="admin-support-modal-header">
									<h2>Recuperar contraseña</h2>
									<button
										type="button"
										className="admin-chat-close-btn"
										onClick={() => setSupportOpen(false)}
									>
										✕
									</button>
								</header>
								<div className="admin-support-modal-body">
									<p>Responde esta pregunta para que el soporte administrativo pueda ayudarte.</p>
									<label>
										Usuario
										<input
											type="text"
											value={supportUsername}
											placeholder="Tu usuario administrativo"
											onChange={(e) =>
												handleUsernameForRecovery({ detail: { value: e.target.value } })
											}
										/>
									</label>
									<label>
										Pregunta de seguridad
										<input
											type="text"
											value={securityQuestion || "Ingresa tu usuario para ver la pregunta"}
											readOnly
											style={{ background: "#f8fafc", color: "#64748b" }}
										/>
									</label>
									<label>
										Respuesta
										<input
											type="text"
											value={securityAnswer}
											placeholder="Escribe tu respuesta"
											onChange={(e) => setSecurityAnswer(e.target.value)}
										/>
									</label>
									<div className="admin-support-modal-actions">
										<button
											type="button"
											className="admin-support-modal-submit"
											disabled={!supportUsername.trim() || !securityAnswer.trim() || loadingQuestion}
											onClick={() => {
												setSupportOpen(false);
												setAdminChatOpen(true);
											}}
										>
											{loadingQuestion ? "Cargando..." : "Abrir chat de soporte"}
										</button>
										<button
											type="button"
											className="admin-support-modal-cancel"
											onClick={() => setSupportOpen(false)}
										>
											Cancelar
										</button>
									</div>
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