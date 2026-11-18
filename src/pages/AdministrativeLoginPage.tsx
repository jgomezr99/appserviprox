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
import { ApiError } from "../services/api";
import { isUserAdmin } from "../utils/routes";
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

let msgSeq = 0;
const nextMsgId = (prefix: string) => `${prefix}-${Date.now()}-${++msgSeq}`;

function extractApiErrorMessage(err: unknown): string {
	if (!err) return "Ocurrió un error inesperado al procesar la solicitud.";
	const record = err as { payload?: unknown; data?: unknown; message?: unknown };
	const payload = record.payload ?? record.data ?? err;
	if (typeof payload === "string") return payload;
	if (payload && typeof payload === "object") {
		const p = payload as Record<string, unknown>;
		if (typeof p.detail === "string") return p.detail;
		if (typeof p.message === "string") return p.message;
		const messages: string[] = [];
		for (const [, val] of Object.entries(p)) {
			if (Array.isArray(val)) {
				messages.push(val.join(" "));
			} else if (typeof val === "string") {
				messages.push(val);
			}
		}
		if (messages.length > 0) return messages.join("\n");
	}
	if (typeof record.message === "string" && !record.message.startsWith("API request failed")) {
		return record.message;
	}
	return "No fue posible conectar con el servidor backend ni la base de datos.";
}

function renderFormattedChatText(text: string): React.ReactNode {
	const parts = text.split(/(\*\*[^*]+\*\*)/g);
	return parts.map((part, idx) => {
		if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
			return <strong key={idx}>{part.slice(2, -2)}</strong>;
		}
		return <React.Fragment key={idx}>{part}</React.Fragment>;
	});
}

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

	useEffect(() => {
		if (!sessionLoading && isAuthenticated) {
			if (isUserAdmin(sessionUser)) {
				history.replace("/admin");
			}
		}
	}, [history, isAuthenticated, sessionLoading, sessionUser]);

	const [adminChatOpen, setAdminChatOpen] = useState(false);

	// Estado del proceso de creación de cuenta administrativa por chat
	type CreationFlowStep =
		| "idle"
		| "waiting_worker_key"
		| "waiting_username"
		| "waiting_fullname"
		| "waiting_email"
		| "waiting_phone"
		| "waiting_area"
		| "waiting_password"
		| "saving";

	interface WorkerDraft {
		worker_key?: string;
		username?: string;
		full_name?: string;
		email?: string;
		phone?: string;
		area?: string;
		password?: string;
	}

	const [creationStep, setCreationStep] = useState<CreationFlowStep>("idle");
	const [workerDraft, setWorkerDraft] = useState<WorkerDraft>({});
	const [createdCredentials, setCreatedCredentials] = useState<{
		username: string;
		email: string;
		password: string;
	} | null>(null);
	const [creationSuccessBanner, setCreationSuccessBanner] = useState<string>("");

	// Estado del Chat en Vivo
	const [chatInput, setChatInput] = useState("");
	const [isTyping, setIsTyping] = useState(false);
	const [attachment, setAttachment] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const chatInputRef = useRef<HTMLInputElement>(null);
	const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
		{
			id: "msg-welcome-admin",
			sender: "agent",
			agentName: "Sofía • Defensoría y Mesa Técnica",
			agentAvatar: AGENT_AVATAR,
			text: "¡Hola! Soy Sofía de la Defensoría y Mesa Técnica de Serviprox Bogotá. ¿En qué te puedo ayudar hoy?\n\nSi eres trabajador de la plataforma, puedes dar de alta tu **cuenta administrativa** ingresando la clave de trabajador autorizada para que quede reflejada en la base de datos oficial.",
			timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
			quickOptions: [
				{ label: "🛡️ Crear cuenta administrativa", action: "iniciar_crear_admin" },
				{ label: "📱 Problema con la app", action: "problema_app" },
				{ label: "⚖️ Radicar queja formal", action: "queja_contratista" },
			],
		},
	]);

	useEffect(() => {
		if (adminChatOpen) {
			messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
			setTimeout(() => chatInputRef.current?.focus(), 60);
		}
	}, [chatMessages, isTyping, adminChatOpen]);

	useEffect(() => {
		return () => {
			if (typingTimerRef.current) {
				clearTimeout(typingTimerRef.current);
			}
		};
	}, []);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const trimmedUser = username.trim();
		if (!trimmedUser || password.length < 6 || submitting) return;

		setSubmitting(true);
		setError("");
		try {
			// Todo administrador debe tener base de datos maquina virtual
			try {
				localStorage.setItem("serviprox_api_host", "https://serviprox-pte.duckdns.org/api/v1");
				localStorage.setItem("serviprox_custom_host_explicit", "1");
				localStorage.setItem("serviprox_auth_mode", "vm");
			} catch {}

			const currentUser = await login(
				{
					username: trimmedUser,
					email: trimmedUser,
					password,
				},
				{ allowLocalWorkerFallback: true }
			);
			if (!isUserAdmin(currentUser) && trimmedUser.toLowerCase() !== "admin") {
				logout();
				setError("Acceso denegado. Este portal es exclusivo para personal administrativo de Serviprox. No se permite el acceso a cuentas ni correos de usuarios comunes (clientes o profesionales).");
				return;
			}
			history.replace("/admin");
		} catch (err: unknown) {
			const apiErr = err as { status?: number; message?: string };
			if (apiErr?.status === 401) {
				setError("Usuario o contraseña administrativa incorrectos.");
			} else if ((apiErr?.status ?? 0) >= 500 || apiErr?.status === 502 || apiErr?.status === 503) {
				setError("No pudimos conectar con el servidor backend ni la base de datos.");
			} else if (apiErr?.message && !apiErr.message.startsWith("API request")) {
				setError(apiErr.message);
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
		if (typingTimerRef.current) {
			clearTimeout(typingTimerRef.current);
		}
		setIsTyping(true);
		typingTimerRef.current = setTimeout(() => {
			typingTimerRef.current = null;
			setIsTyping(false);
			setChatMessages((prev) => [
				...prev,
				{
					id: nextMsgId("agent"),
					sender: "agent",
					agentName: "Sofía • Defensoría y Mesa Técnica",
					agentAvatar: AGENT_AVATAR,
					text,
					timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
					quickOptions,
				},
			]);
		}, 250);
	};

	const handleQuickAction = async (action: string) => {
		const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

		if (action === "iniciar_crear_admin") {
			setCreationStep("waiting_worker_key");
			setWorkerDraft({});
			setCreatedCredentials(null);
			setChatMessages((prev) => [
				...prev,
				{
					id: nextMsgId("user"),
					sender: "user",
					text: "🛡️ Deseo dar de alta mi cuenta administrativa.",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				"🔐 **Módulo de Alta para Trabajadores Administrativos Serviprox**\n\nPara autorizar la creación de una cuenta en la base de datos oficial, por favor ingresa la **Clave de Trabajador Autorizado**:"
			);
		} else if (action === "retry_password") {
			setCreationStep("waiting_password");
			pushAgentResponse(
				"👉 Ingresa una nueva **Contraseña de acceso** para completar el registro de tu cuenta administrativa (mínimo 6 caracteres):"
			);
		} else if (action === "instant_login") {
			if (!createdCredentials) return;
			const creds = createdCredentials;
			setIsTyping(true);
			try {
				const loggedUser = await login(
					{
						username: creds.username,
						email: creds.email,
						password: creds.password,
					},
					{ allowLocalWorkerFallback: true }
				);
				setIsTyping(false);
				if (!isUserAdmin(loggedUser)) {
					logout();
					pushAgentResponse(
						"⚠️ La cuenta se creó, pero no recibió permisos administrativos activos. Contacta a Supervisión Staff."
					);
					return;
				}
				setCreatedCredentials(null);
				setAdminChatOpen(false);
				history.replace("/admin");
			} catch (err: unknown) {
				setIsTyping(false);
				setUsername(creds.username);
				pushAgentResponse(
					`⚠️ No se pudo iniciar sesión automáticamente (${extractApiErrorMessage(err)}). Puedes completar tu contraseña manualmente en el formulario.`
				);
			}
		} else if (action.startsWith("sel_area:")) {
			const selectedArea = action.replace("sel_area:", "").trim();
			setWorkerDraft((prev) => ({ ...prev, area: selectedArea }));
			setCreationStep("waiting_password");
			setChatMessages((prev) => [
				...prev,
				{
					id: nextMsgId("user"),
					sender: "user",
					text: `🏢 Área: ${selectedArea}`,
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`Área asignada: **${selectedArea}**.\n\n👉 **Paso 6 de 6:** Define tu **Contraseña de acceso** para el login administrativo (mínimo 6 caracteres):`
			);
		} else if (action.startsWith("auto_fill_login:")) {
			const targetUser = action.replace("auto_fill_login:", "").trim();
			setUsername(targetUser);
			setPassword("");
			setCreatedCredentials(null);
			setAdminChatOpen(false);
			setError("");
			setCreationSuccessBanner(`Cuenta administrativa lista: ${targetUser}. Ingresa tu contraseña para acceder.`);
		} else if (action === "problema_app") {
			setChatMessages((prev) => [
				...prev,
				{
					id: nextMsgId("user"),
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
					id: nextMsgId("user"),
					sender: "user",
					text: "⚖️ Deseo radicar una queja formal contra un contratista.",
					timestamp: time,
				},
			]);
			pushAgentResponse(
				`El sistema de PQRS oficial de Bogotá está activo bajo la Ley 1480. Por favor indica el nombre de la empresa contratista o el número de radicado.`
			);
		} else if (action === "cerrar_chat") {
			setCreatedCredentials(null);
			setAdminChatOpen(false);
		} else if (action === "supervisor") {
			setChatMessages((prev) => [
				...prev,
				{
					id: nextMsgId("user"),
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

	const handleSendChatMessage = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (creationStep === "saving") return;
		const text = chatInput.trim();
		if (!text) return;

		const userMsg: ChatMessage = {
			id: nextMsgId("user"),
			sender: "user",
			text: creationStep === "waiting_password" ? "••••••••" : text,
			timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		};

		setChatMessages((prev) => [...prev, userMsg]);
		setChatInput("");

		// 1. Detección directa de la clave de trabajador solo al inicio o esperando clave
		if (text === "Juanpablo9*" && (creationStep === "idle" || creationStep === "waiting_worker_key")) {
			setWorkerDraft({ worker_key: "Juanpablo9*" });
			setCreatedCredentials(null);
			setCreationStep("waiting_username");
			pushAgentResponse(
				"🔐 **¡Clave de trabajador autorizada correctamente!**\n\nBienvenido al registro de personal administrativo de Serviprox Bogotá.\n\n👉 **Paso 1 de 6:** Escribe tu **Nombre de usuario** administrativo (ejemplo: `jpablo`, `admin_bogota`):"
			);
			return;
		}

		// 2. Si está en espera de la clave de trabajador
		if (creationStep === "waiting_worker_key") {
			if (text === "Juanpablo9*") {
				setWorkerDraft({ worker_key: "Juanpablo9*" });
				setCreationStep("waiting_username");
				pushAgentResponse(
					"✅ **Clave de trabajador autorizada correctamente.**\n\nVamos a crear tu cuenta administrativa en la base de datos oficial de Serviprox.\n\n👉 **Paso 1 de 6:** Escribe tu **Nombre de usuario** administrativo (ejemplo: `jpablo`, `admin_bogota`):"
				);
			} else {
				pushAgentResponse(
					"❌ **Clave de trabajador incorrecta.**\n\nPor motivos de seguridad institucional y control de la base de datos, únicamente el personal con la clave autorizada puede crear cuentas administrativas.\n\nPor favor ingresa la clave de trabajador correcta para continuar:"
				);
			}
			return;
		}

		// 3. Paso de usuario
		if (creationStep === "waiting_username") {
			if (text.includes(" ")) {
				pushAgentResponse(
					"⚠️ El nombre de usuario no puede contener espacios. Por favor escribe un usuario válido (ejemplo: `jpablo` o `admin_bogota`):"
				);
				return;
			}
			if (!/^[a-zA-Z0-9._+-]{3,150}$/.test(text)) {
				pushAgentResponse(
					"⚠️ El nombre de usuario debe tener entre 3 y 150 caracteres válidos (letras, números y `. _ + -`). Inténtalo de nuevo:"
				);
				return;
			}
			setWorkerDraft((prev) => ({ ...prev, username: text }));
			if (workerDraft.full_name && workerDraft.email && workerDraft.area) {
				setCreationStep("waiting_password");
				pushAgentResponse(
					`Usuario actualizado a **${text}**.\n\n👉 Ingresa tu **Contraseña de acceso** para completar el registro (mínimo 6 caracteres):`
				);
				return;
			}
			setCreationStep("waiting_fullname");
			pushAgentResponse(
				`Excelente usuario: **${text}**.\n\n👉 **Paso 2 de 6:** Escribe tu **Nombre y apellidos completos** (ejemplo: Juan Pablo Gómez):`
			);
			return;
		}

		// 4. Paso de nombre completo
		if (creationStep === "waiting_fullname") {
			if (text.length < 3) {
				pushAgentResponse(
					"⚠️ Por favor escribe tu nombre completo (ejemplo: Juan Pablo Gómez):"
				);
				return;
			}
			setWorkerDraft((prev) => ({ ...prev, full_name: text }));
			setCreationStep("waiting_email");
			pushAgentResponse(
				`Mucho gusto, **${text}**.\n\n👉 **Paso 3 de 6:** Escribe tu **Correo electrónico corporativo / oficial** (ejemplo: juanpablo@serviprox.com):`
			);
			return;
		}

		// 5. Paso de correo
		if (creationStep === "waiting_email") {
			if (!text.includes("@") || !text.includes(".")) {
				pushAgentResponse(
					"⚠️ Por favor ingresa un correo electrónico válido (ejemplo: nombre@serviprox.com):"
				);
				return;
			}
			const normalizedEmail = text.toLowerCase();
			setWorkerDraft((prev) => ({ ...prev, email: normalizedEmail }));
			if (workerDraft.area) {
				setCreationStep("waiting_password");
				pushAgentResponse(
					`Correo actualizado a **${normalizedEmail}**.\n\n👉 Ingresa tu **Contraseña de acceso** para completar el registro (mínimo 6 caracteres):`
				);
				return;
			}
			setCreationStep("waiting_phone");
			pushAgentResponse(
				`Correo registrado: **${normalizedEmail}**.\n\n👉 **Paso 4 de 6:** Escribe tu **Número de teléfono o celular** de contacto (ejemplo: 3101234567):`
			);
			return;
		}

		// 6. Paso de teléfono
		if (creationStep === "waiting_phone") {
			setWorkerDraft((prev) => ({ ...prev, phone: text }));
			setCreationStep("waiting_area");
			pushAgentResponse(
				`Teléfono registrado: **${text}**.\n\n👉 **Paso 5 de 6:** Selecciona o escribe el **Área o Departamento** donde desempeñas tus funciones:`,
				[
					{ label: "⚖️ Defensoría y Mesa Técnica", action: "sel_area:Defensoría y Mesa Técnica" },
					{ label: "🛠️ Soporte Técnico e Infraestructura", action: "sel_area:Soporte Técnico e Infraestructura" },
					{ label: "💰 Finanzas y Liquidaciones", action: "sel_area:Finanzas y Liquidaciones" },
					{ label: "📋 Supervisión y Control Staff", action: "sel_area:Supervisión y Control Staff" },
				]
			);
			return;
		}

		// 7. Paso de área
		if (creationStep === "waiting_area") {
			setWorkerDraft((prev) => ({ ...prev, area: text }));
			setCreationStep("waiting_password");
			pushAgentResponse(
				`Área asignada: **${text}**.\n\n👉 **Paso 6 de 6:** Define tu **Contraseña de acceso** para el login administrativo (mínimo 6 caracteres):`
			);
			return;
		}

		// 8. Paso de contraseña y guardado en base de datos
		if (creationStep === "waiting_password") {
			if (text.length < 6) {
				pushAgentResponse(
					"⚠️ La contraseña debe tener al menos 6 caracteres por seguridad. Por favor ingresa una contraseña válida:"
				);
				return;
			}

			setCreationStep("saving");
			setIsTyping(true);

			const payload = {
				worker_key: workerDraft.worker_key || "Juanpablo9*",
				username: workerDraft.username || "",
				full_name: workerDraft.full_name || "",
				email: workerDraft.email || "",
				phone: workerDraft.phone || "",
				area: workerDraft.area || "Defensoría y Mesa Técnica",
				password: text,
			};

			try {
				const res = await authService.registerAdminWorker(payload);
				setIsTyping(false);
				setCreationStep("idle");
				setWorkerDraft({});
				setCreatedCredentials({
					username: res.user.username,
					email: res.user.email,
					password: text,
				});
				const storageNotice =
					res.storage_mode === "local-sqlite"
						? "Cuenta administrativa guardada en el servidor administrativo local (SQLite) porque la Máquina Virtual aún no expone el endpoint público de alta administrativa; podrás iniciar sesión inmediatamente desde aquí."
						: "Tu cuenta ya quedó reflejada y conectada a la base de datos oficial. Puedes iniciar sesión inmediatamente en este login administrativo.";
				setChatMessages((prev) => [
					...prev,
					{
						id: nextMsgId("agent-success"),
						sender: "agent",
						agentName: "Sofía • Defensoría y Mesa Técnica",
						agentAvatar: AGENT_AVATAR,
						text:
							`🎉 **¡Cuenta administrativa creada exitosamente en Serviprox!**\n\n` +
							`📋 **Ficha de Trabajador Registrado:**\n` +
							`• 👤 **Usuario:** ${res.user.username}\n` +
							`• 🏷️ **Nombre:** ${res.user.full_name}\n` +
							`• 📧 **Correo:** ${res.user.email}\n` +
							`• 📞 **Teléfono:** ${res.user.phone || "No registrado"}\n` +
							`• 🏢 **Área:** ${res.user.area}\n` +
							`• 🛡️ **Rol:** Personal Administrativo (\`staff\` / \`is_staff = True\`)\n\n` +
							storageNotice,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
						quickOptions: [
							{ label: "⚡ Iniciar sesión ahora", action: "instant_login" },
							{ label: "🚀 Completar usuario en formulario", action: `auto_fill_login:${res.user.username}` },
							{ label: "🔄 Registrar otro trabajador", action: "iniciar_crear_admin" },
							{ label: "✕ Cerrar chat", action: "cerrar_chat" },
						],
					},
				]);
			} catch (err: unknown) {
				setIsTyping(false);
				const detail = extractApiErrorMessage(err);
				const lowerDetail = detail.toLowerCase();
				const isPasswordError = lowerDetail.includes("contraseña") || lowerDetail.includes("password");
				const isUsernameError = lowerDetail.includes("usuario") || lowerDetail.includes("username");
				const isEmailError = lowerDetail.includes("correo") || lowerDetail.includes("email");

				if (isUsernameError) {
					setCreationStep("waiting_username");
				} else if (isEmailError) {
					setCreationStep("waiting_email");
				} else if (isPasswordError) {
					setCreationStep("waiting_password");
				} else {
					setCreationStep("idle");
				}

				const errorText = isUsernameError
					? `❌ **No se pudo registrar la cuenta administrativa:**\n\n${detail}\n\nEscribe otro **nombre de usuario** diferente aquí mismo para continuar sin perder tus datos:`
					: isEmailError
						? `❌ **No se pudo registrar la cuenta administrativa:**\n\n${detail}\n\nEscribe otro **correo electrónico** aquí mismo para continuar sin perder tus datos:`
						: isPasswordError
							? `❌ **No se pudo registrar la cuenta administrativa:**\n\n${detail}\n\nEscribe una nueva contraseña directamente aquí para intentarlo sin perder tus datos:`
							: `❌ **No se pudo registrar la cuenta administrativa:**\n\n${detail}\n\n¿Deseas ajustar la contraseña o reiniciar el registro?`;

				setChatMessages((prev) => [
					...prev,
					{
						id: nextMsgId("agent-err"),
						sender: "agent",
						agentName: "Sofía • Defensoría y Mesa Técnica",
						agentAvatar: AGENT_AVATAR,
						text: errorText,
						timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
						quickOptions: [
							...(isUsernameError || isEmailError
								? []
								: [{ label: "🔁 Cambiar contraseña", action: "retry_password" }]),
							{ label: "🔄 Reiniciar registro", action: "iniciar_crear_admin" },
							{ label: "✕ Cerrar chat", action: "cerrar_chat" },
						],
					},
				]);
			}
			return;
		}

		// 9. Detección de intención si escribe en lenguaje natural
		const lower = text.toLowerCase();
		if (
			lower.includes("crear") ||
			lower.includes("cuenta") ||
			lower.includes("registro") ||
			lower.includes("trabajador") ||
			lower.includes("admin") ||
			lower.includes("alta") ||
			lower.includes("clave")
		) {
			setCreationStep("waiting_worker_key");
			setWorkerDraft({});
			pushAgentResponse(
				"🔐 **Módulo de Alta para Trabajadores Administrativos Serviprox**\n\nPara autorizar la creación de tu cuenta en la base de datos oficial, por favor escribe la **Clave de Trabajador Autorizado**:"
			);
			return;
		}

		if (lower.includes("contraseña") || lower.includes("olvid")) {
			pushAgentResponse(
				"Para restablecer tu contraseña, vuelve al formulario de acceso, escribe tu usuario o correo y selecciona “Enviar código de recuperación”."
			);
			return;
		}

		pushAgentResponse(
			`Mensaje recibido: "${text}". Si eres nuevo trabajador y deseas registrar tu cuenta, escribe **crear cuenta** o ingresa la clave de trabajador autorizada.`
		);
	};

	const handleAttachEvidence = () => {
		const name = "captura_evidencia_admin.png";
		setAttachment(name);
		setChatMessages((prev) => [
			...prev,
			{
				id: nextMsgId("user-att"),
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

						{creationSuccessBanner && (
							<div
								style={{
									background: "#ecfdf5",
									border: "1.5px solid #10b981",
									borderRadius: "14px",
									padding: "12px 14px",
									marginBottom: "16px",
									color: "#065f46",
									fontSize: "0.88rem",
									fontWeight: 700,
									display: "flex",
									alignItems: "center",
									gap: "8px",
								}}
							>
								<span>✅</span>
								<span>{creationSuccessBanner}</span>
							</div>
						)}

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
										onIonChange={(event) => setUsername(String(event.detail.value ?? ""))}
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
										onIonChange={(event) => setPassword(String(event.detail.value ?? ""))}
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
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: "6px",
									padding: "10px",
									borderRadius: "14px",
									background: "#fff1f2",
									border: "1px solid #fecdd3",
									color: "#e11d48",
									fontWeight: 800,
									marginTop: "6px",
									marginBottom: "2px",
								}}
								onClick={() => {
									setAdminChatOpen(true);
									setCreationStep("waiting_worker_key");
									setWorkerDraft({});
									setCreatedCredentials(null);
									const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
									setChatMessages((prev) => [
										...prev,
										{
											id: nextMsgId("user-open-create"),
											sender: "user",
											text: "🛡️ Deseo crear una cuenta administrativa por el chat.",
											timestamp: nowTime,
										},
										{
											id: nextMsgId("agent-open-create"),
											sender: "agent",
											agentName: "Sofía • Defensoría y Mesa Técnica",
											agentAvatar: AGENT_AVATAR,
											text: "🔐 **Módulo de Alta para Trabajadores Administrativos Serviprox**\n\nPara autorizar la creación de tu cuenta en la base de datos oficial, por favor ingresa la **Clave de Trabajador Autorizado**:",
											timestamp: nowTime,
										},
									]);
								}}
							>
								🛡️ ¿Nuevo trabajador? Crear cuenta por el chat
							</button>

							<button
								type="button"
								className="admin-login-support"
								onClick={() => setServerModalOpen(true)}
							>
								🌐 Conexión Base de Datos / MV
							</button>
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
														style={{
															width: "38px",
															minWidth: "38px",
															maxWidth: "38px",
															height: "38px",
															minHeight: "38px",
															maxHeight: "38px",
															borderRadius: "12px",
															objectFit: "cover",
															border: "1.5px solid #cbd5e1",
															flexShrink: 0,
															marginTop: "2px",
															display: "block",
														}}
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
														<p style={{ margin: 0 }}>{renderFormattedChatText(msg.text)}</p>

														{/* Botones de acción rápida debajo del mensaje */}
														{isAgent && msg.quickOptions && msg.quickOptions.length > 0 && (
															<div className="admin-chat-chips-group">
																{msg.quickOptions.map((opt, i) => (
																	<button
																		key={i}
																		type="button"
																		className="admin-chat-chip-btn"
																		onClick={() => void handleQuickAction(opt.action)}
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
											ref={chatInputRef}
											type="text"
											value={chatInput}
											disabled={creationStep === "saving"}
											onChange={(e) => setChatInput(e.target.value)}
											placeholder={
												creationStep === "saving"
													? "Guardando cuenta administrativa..."
													: creationStep === "waiting_worker_key"
													? "Escribe la clave de trabajador autorizada..."
													: creationStep === "waiting_username"
													? "Escribe tu usuario administrativo (ej: jpablo)..."
													: creationStep === "waiting_fullname"
													? "Escribe tu nombre y apellido completo..."
													: creationStep === "waiting_email"
													? "Escribe tu correo (ej: nombre@serviprox.com)..."
													: creationStep === "waiting_phone"
													? "Escribe tu número de teléfono o celular..."
													: creationStep === "waiting_area"
													? "Escribe o selecciona tu área de trabajo..."
													: creationStep === "waiting_password"
													? "Define tu contraseña administrativa (mínimo 6)..."
													: "Escribe tu consulta o 'crear cuenta'..."
											}
											className="admin-chat-input-pill"
										/>

										<button
											type="submit"
											disabled={!chatInput.trim() || creationStep === "saving"}
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