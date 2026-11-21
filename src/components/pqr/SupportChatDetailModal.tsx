import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  MessageSquare,
  Bot,
  User,
  ShieldCheck,
  Clock,
  FileText,
} from 'lucide-react';
import type { SupportChat } from '../../types/serviprox';

interface SupportChatDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: SupportChat | null;
  onSendMessage: (chatId: number, text: string) => Promise<void>;
}

const TOPIC_LABELS: Record<string, string> = {
  pqr_servicio: 'PQR de Servicio',
  pqr_producto: 'PQR de Producto',
  problema_app: 'Problema App',
  cuenta: 'Cuenta',
  soporte: 'Chat Directo',
};

export const SupportChatDetailModal: React.FC<SupportChatDetailModalProps> = ({
  isOpen,
  onClose,
  chat,
  onSendMessage,
}) => {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isOpen, chat?.messages?.length]);

  if (!isOpen || !chat) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = replyText.trim();
    if (!clean || sending) return;
    setSending(true);
    try {
      await onSendMessage(chat.id, clean);
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      style={{ zIndex: 9999999 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-neutral-200 w-full max-w-2xl h-[85vh] max-h-[720px] flex flex-col overflow-hidden text-neutral-900">
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-950 via-zinc-900 to-emerald-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  {TOPIC_LABELS[chat.topic] || 'Soporte'}
                </span>
                {chat.relatedRadicado && (
                  <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded-md bg-white/10 text-amber-200 border border-white/15 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {chat.relatedRadicado}
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-black text-white truncate mt-1">
                {chat.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar chat"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-neutral-50"
        >
          {!chat.messages || chat.messages.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-xs">
              Este chat aún no tiene mensajes. Escribe abajo para enviar el primero.
            </div>
          ) : (
            chat.messages.map((msg) => {
              const isUser = msg.sender === 'user';
              const isAdmin = msg.sender === 'admin';
              const isSystem = msg.sender === 'system';

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="text-[11px] font-semibold bg-neutral-200/80 text-neutral-700 px-3 py-1 rounded-full">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-xs space-y-1 ${
                      isUser
                        ? 'bg-neutral-900 text-white rounded-br-sm'
                        : isAdmin
                        ? 'bg-rose-50 border border-rose-200 text-neutral-900 rounded-bl-sm'
                        : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider opacity-75">
                      {isUser ? (
                        <User className="w-3 h-3 text-emerald-400" />
                      ) : isAdmin ? (
                        <ShieldCheck className="w-3 h-3 text-rose-600" />
                      ) : (
                        <Bot className="w-3 h-3 text-emerald-600" />
                      )}
                      <span>{msg.senderName}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    <div
                      className={`flex items-center gap-1 text-[10px] pt-0.5 ${
                        isUser ? 'text-neutral-400 justify-end' : 'text-neutral-400'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>
                        {new Date(msg.createdAt).toLocaleString('es-CO', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Reply form */}
        <form
          onSubmit={handleSubmit}
          className="p-3.5 sm:p-4 bg-white border-t border-neutral-200 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Escribe un mensaje en este chat..."
            disabled={sending}
            className="flex-1 bg-neutral-100 border border-neutral-300 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
          />
          <button
            type="submit"
            disabled={sending || !replyText.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'Enviando...' : 'Enviar'}</span>
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
};
