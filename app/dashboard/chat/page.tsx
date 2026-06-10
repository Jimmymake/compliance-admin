'use client';

import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useAuth } from '@/lib/auth-context';
import { resolveUploadUrl } from '@/lib/upload-url';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChangeEvent, FormEvent, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type RecordValue = Record<string, unknown>;
type Merchant = RecordValue;
type Message = RecordValue;
type EmojiSelection = {
  native?: string;
};

function readString(record: RecordValue | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }

  return fallback;
}

function readDate(record: RecordValue | undefined, keys: string[]) {
  const raw = readString(record, keys);
  if (!raw) return undefined;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatTime(date: Date | undefined) {
  if (!date) return '';

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDay(date: Date | undefined) {
  if (!date) return '';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function readMerchantId(merchant: Merchant) {
  return readString(merchant, ['merchantId', 'id', '_id', 'userId'], 'No ID');
}

function readMerchantName(merchant: Merchant) {
  const business = merchant.business as Merchant | undefined;
  const profile = merchant.profile as Merchant | undefined;

  return (
    readString(merchant, ['businessName', 'merchantName', 'name', 'companyName']) ||
    readString(business, ['businessName', 'name', 'companyName']) ||
    readString(profile, ['businessName', 'name', 'companyName']) ||
    'Unnamed merchant'
  );
}

function readMerchantEmail(merchant: Merchant) {
  const business = merchant.business as Merchant | undefined;
  const profile = merchant.profile as Merchant | undefined;

  return (
    readString(merchant, ['email', 'businessEmail', 'companyEmail']) ||
    readString(business, ['email', 'businessEmail', 'companyEmail']) ||
    readString(profile, ['email', 'businessEmail', 'companyEmail']) ||
    readMerchantId(merchant)
  );
}

function readMerchantStatus(merchant: Merchant) {
  return readString(merchant, ['status', 'onboardingStatus', 'overallStatus'], 'Unknown');
}

function initialsFor(name: string) {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'M'
  );
}

function getMessageId(message: Message) {
  return readString(message, ['id', '_id', 'messageId', 'message_id', 'messageID']);
}

function getMessageKey(message: Message, index: number) {
  return getMessageId(message) || `${readMessageSender(message)}-${readMessageText(message)}-${index}`;
}

function getReplyTargetId(message: Message, replySnapshot: Message | undefined) {
  return (
    getMessageId(replySnapshot ?? {}) ||
    readString(message, ['replyToMessageId', 'replyToId', 'parentMessageId', 'quotedMessageId'])
  );
}

function isSameMessage(a: Message, b: Message) {
  const idA = getMessageId(a);
  const idB = getMessageId(b);
  if (idA && idB) return idA === idB;

  const textMatch = readMessageText(a) === readMessageText(b);
  const senderMatch =
    readMessageSender(a) === readMessageSender(b) ||
    readMessageSenderName(a) === readMessageSenderName(b);

  if (!textMatch || !senderMatch) return false;

  const timeA = readDate(a, ['createdAt', 'created_at', 'sentAt', 'updatedAt']);
  const timeB = readDate(b, ['createdAt', 'created_at', 'sentAt', 'updatedAt']);
  if (!timeA || !timeB) return true;

  return Math.abs(timeA.getTime() - timeB.getTime()) <= 2000;
}

function appendUniqueMessages(current: Message[], nextMessages: Message[]) {
  const unique = nextMessages.filter(
    (message) => !current.some((existing) => isSameMessage(existing, message))
  );
  return unique.length ? [...current, ...unique] : current;
}

function extractArray(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as RecordValue;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = value as RecordValue;
      for (const nestedKey of keys) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[];
      }
    }
  }

  return [];
}

function extractMerchants(payload: unknown): Merchant[] {
  return extractArray(payload, ['merchants', 'data', 'users', 'profiles', 'results']) as Merchant[];
}

function extractMessages(payload: unknown): Message[] {
  return extractArray(payload, ['messages', 'data', 'results']) as Message[];
}

function extractConversation(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;

  const record = payload as RecordValue;
  const candidates = [record.conversation, record.data, record.result, record.chat];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const conversation = candidate as RecordValue;
      if (readString(conversation, ['id', '_id', 'conversationId'])) return conversation;
    }
  }

  if (readString(record, ['id', '_id', 'conversationId'])) return record;
  return undefined;
}

async function readResponseBody(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as RecordValue;
  } catch {
    return { message: text };
  }
}

function readMessageText(message: Message) {
  return readString(message, ['text', 'message', 'body', 'content']);
}

function readMessageSender(message: Message) {
  return readString(message, ['senderRole', 'role', 'senderType', 'fromRole']);
}

function readMessageSenderName(message: Message) {
  return readString(message, [
    'senderName',
    'fromName',
    'name',
    'sender',
    'author',
    'userName',
    'username',
    'displayName',
  ]);
}

function readMessageAttachments(message: Message) {
  const attachmentPayload = message.attachments;
  const attachments =
    attachmentPayload ??
    message.files ??
    (attachmentPayload && typeof attachmentPayload === 'object' && 'data' in attachmentPayload
      ? (attachmentPayload as RecordValue).data
      : undefined);
  if (Array.isArray(attachments)) return attachments as RecordValue[];
  return [];
}

function readReplyToMessage(message: Message) {
  const candidate =
    message.replyTo ??
    message.replyToMessage ??
    message.repliedTo ??
    message.parentMessage ??
    message.quotedMessage;

  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    return candidate as Message;
  }

  return undefined;
}

function readReplyPreviewText(message: Message | undefined) {
  if (!message) return '';

  const text = readMessageText(message);
  if (text && text !== '—') return text;

  return readMessageAttachments(message).length > 0 ? 'Attachment' : 'Message';
}

function readReplyPreviewSender(message: Message | undefined, fallback = 'Message') {
  if (!message) return fallback;

  return readMessageSenderName(message) || readMessageSender(message) || fallback;
}

function getFileMessageType(file: File) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type === 'application/pdf') return 'document';
  return 'file';
}

function getShortFileName(fileName: string, maxLength = 5) {
  if (fileName.length <= maxLength + 4) return fileName;
  const extIndex = fileName.lastIndexOf('.');
  if (extIndex > 0) {
    const name = fileName.slice(0, maxLength);
    const ext = fileName.slice(extIndex);
    return `${name}...${ext}`;
  }
  return `${fileName.slice(0, maxLength)}...`;
}

function isOutgoingMessage(message: Message, currentRole: string | undefined) {
  const sender = readMessageSender(message).toLowerCase();
  if (!sender) return false;

  return currentRole ? sender === currentRole.toLowerCase() : sender !== 'merchant';
}

function ChatLoading() {
  return (
    <div className="grid h-full place-items-center bg-[#f7f7fb] text-sm text-slate-500">
      Loading chat...
    </div>
  );
}

function ChatPageContent() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState(searchParams.get('merchantId') ?? '');
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const [selectedMessageKey, setSelectedMessageKey] = useState('');
  const [openMessageMenuKey, setOpenMessageMenuKey] = useState('');
  const [highlightedMessageKey, setHighlightedMessageKey] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const messageRefsRef = useRef(new Map<string, HTMLDivElement>());
  const socketRef = useRef<Socket | null>(null);

  const openFilePicker = () => {
    if (!fileInputRef.current) {
      console.warn('Chat file input ref is not set');
      return;
    }

    console.log('Opening chat file picker');
    fileInputRef.current.click();
  };

  const onAttachmentsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    console.log('Chat attachments change event', { files });
    if (!files) {
      console.warn('No files selected');
      return;
    }

    const fileArray = Array.from(files);
    console.log('Selected files', fileArray.map((file) => ({ name: file.name, size: file.size, type: file.type })));
    setAttachments((current) => [...current, ...fileArray]);
    event.target.value = '';
  };

  const insertEmoji = (emoji: string) => {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const nextDraft = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;

    setDraft(nextDraft);
    setEmojiOpen(false);

    window.requestAnimationFrame(() => {
      input?.focus();
      const nextCursor = start + emoji.length;
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleSelectEmoji = (emojiObject: EmojiSelection) => {
    if (!emojiObject.native) return;
    insertEmoji(emojiObject.native);
  };

  useEffect(() => {
    const urls = attachments.map((file) =>
      file.type.startsWith('image/') ? URL.createObjectURL(file) : ''
    );
    setAttachmentPreviews(urls);

    return () => {
      urls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [attachments]);
  const currentRoomRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string>('');

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    const sessionToken = localStorage.getItem('session_token') ?? '';
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!apiUrl) {
      const message = 'Socket API base URL is not configured. Set NEXT_PUBLIC_API_BASE_URL.';
      console.error(message);
      setError(message);
      return;
    }

    console.log('API base URL', apiUrl);
    console.log('Socket conversationId', conversationIdRef.current);

    const socket = io(apiUrl, {
      auth: { token: sessionToken },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connect error', error);
      setError(`Socket connection failed: ${error?.message ?? 'Unknown error'}`);
    });

    socket.on('chat:message', (payload: unknown) => {
      console.log('Incoming chat payload', payload);
      const messageCandidate =
        payload && typeof payload === 'object' && 'chatMessage' in payload
          ? (payload as RecordValue).chatMessage
          : payload;

      if (!messageCandidate || typeof messageCandidate !== 'object') return;

      const chatMessage = messageCandidate as Message;
      console.log('Incoming chatMessage conversationId', readString(chatMessage, ['conversationId']));
      if (readString(chatMessage, ['conversationId']) !== conversationIdRef.current) return;

      setMessages((current) => appendUniqueMessages(current, [chatMessage]));
    });

    return () => {
      socket.off('chat:message');
      socket.disconnect();
      socketRef.current = null;
      currentRoomRef.current = null;
    };
  }, [isAuthenticated, loading]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !conversationId) return;

    if (currentRoomRef.current && currentRoomRef.current !== conversationId) {
      socket.emit('conversation:leave', currentRoomRef.current);
    }

    socket.emit('conversation:join', conversationId);
    currentRoomRef.current = conversationId;

    return () => {
      if (socket && currentRoomRef.current === conversationId) {
        socket.emit('conversation:leave', conversationId);
      }
    };
  }, [conversationId]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    const loadMerchants = async () => {
      setFetching(true);
      setError('');

      try {
        const sessionToken = localStorage.getItem('session_token');
        const response = await fetch('/api/admin/merchants', {
          headers: {
            'X-Session-Token': sessionToken ?? '',
          },
        });
        const data = await readResponseBody(response);

        if (!response.ok) {
          throw new Error(typeof data.message === 'string' ? data.message : 'Failed to load merchants');
        }

        const merchantList = extractMerchants(data);
        setMerchants(merchantList);

        if (!selectedMerchantId && merchantList[0]) {
          setSelectedMerchantId(readMerchantId(merchantList[0]));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chat');
      } finally {
        setFetching(false);
      }
    };

    loadMerchants();
  }, [isAuthenticated, loading, selectedMerchantId]);

  useEffect(() => {
    const queryMerchantId = searchParams.get('merchantId');
    if (queryMerchantId) {
      setSelectedMerchantId(queryMerchantId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedMerchantId || !isAuthenticated) return;

    const loadConversation = async () => {
      setLoadingConversation(true);
      setError('');
      setSelectedMessageKey('');
      setOpenMessageMenuKey('');
      setHighlightedMessageKey('');
      setReplyToMessage(null);

      try {
        const sessionToken = localStorage.getItem('session_token');
        const response = await fetch(`/api/conversations/merchant/${encodeURIComponent(selectedMerchantId)}`, {
          headers: {
            'X-Session-Token': sessionToken ?? '',
          },
        });
        const data = await readResponseBody(response);

        if (!response.ok) {
          throw new Error(typeof data.message === 'string' ? data.message : 'Failed to load conversation');
        }

        const conversation = extractConversation(data);
        const nextConversationId = readString(conversation, ['id', '_id', 'conversationId']);
        setConversationId(nextConversationId);

        const existingMessages = extractMessages(data);
        if (existingMessages.length || !nextConversationId) {
          setMessages(existingMessages as Message[]);
          return;
        }

        const messagesResponse = await fetch(
          `/api/messages/conversation/${encodeURIComponent(nextConversationId)}`,
          {
            headers: {
              'X-Session-Token': sessionToken ?? '',
            },
          }
        );
        const messagesData = await readResponseBody(messagesResponse);

        if (!messagesResponse.ok) {
          throw new Error(typeof messagesData.message === 'string' ? messagesData.message : 'Failed to load messages');
        }

        setMessages(extractMessages(messagesData) as Message[]);
      } catch (err) {
        setMessages([]);
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        setLoadingConversation(false);
      }
    };

    loadConversation();
  }, [isAuthenticated, selectedMerchantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => readMerchantId(merchant) === selectedMerchantId),
    [merchants, selectedMerchantId]
  );

  const filteredMerchants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return merchants;

    return merchants.filter((merchant) =>
      [
        readMerchantName(merchant),
        readMerchantEmail(merchant),
        readMerchantId(merchant),
        readMerchantStatus(merchant),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [merchants, query]);

  const selectMerchant = (merchantId: string) => {
    setSelectedMerchantId(merchantId);
    setSelectedMessageKey('');
    setOpenMessageMenuKey('');
    setHighlightedMessageKey('');
    setReplyToMessage(null);
    router.replace(`/dashboard/chat?merchantId=${encodeURIComponent(merchantId)}`);
  };

  const scrollToMessage = (targetMessageId: string) => {
    if (!targetMessageId) return;

    const targetIndex = messages.findIndex((message) => getMessageId(message) === targetMessageId);
    if (targetIndex === -1) return;

    const targetMessage = messages[targetIndex];
    const targetKey = getMessageKey(targetMessage, targetIndex);
    const targetElement = messageRefsRef.current.get(targetKey);

    targetElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageKey(targetKey);
    window.setTimeout(() => {
      setHighlightedMessageKey((current) => (current === targetKey ? '' : current));
    }, 1600);
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log('sendMessage called', {
      draft: draft.trim(),
      attachmentsCount: attachments.length,
      selectedMerchantId,
      conversationId,
    });
    if ((!draft.trim() && attachments.length === 0) || !selectedMerchantId) return;

    setSending(true);
    setError('');

    try {
      const sessionToken = localStorage.getItem('session_token');
      console.log('Send message sessionToken present', Boolean(sessionToken));
      console.log('Send message conversationId', conversationId);
      let response: Response;
      if (attachments.length > 0) {
        console.log('Sending attachment message', {
          selectedMerchantId,
          conversationId,
          draft: draft.trim(),
          attachments: attachments.map((file) => ({ name: file.name, size: file.size, type: file.type })),
        });

        const formData = new FormData();
        formData.append('merchantId', selectedMerchantId);
        if (conversationId) formData.append('conversationId', conversationId);
        if (replyToMessage) formData.append('replyToMessageId', getMessageId(replyToMessage));
        formData.append('messageType', getFileMessageType(attachments[0]));
        if (draft.trim()) {
          formData.append('message', draft.trim());
        }

        attachments.forEach((file) => {
          formData.append('attachments', file, file.name);
        });

        response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'X-Session-Token': sessionToken ?? '',
          },
          body: formData,
        });
      } else {
        response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': sessionToken ?? '',
          },
          body: JSON.stringify({
            merchantId: selectedMerchantId,
            conversationId: conversationId || undefined,
            messageType: 'text',
            text: draft.trim(),
            replyToMessageId: replyToMessage ? getMessageId(replyToMessage) : undefined,
          }),
        });
      }
      const data = await readResponseBody(response);

      if (!response.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Failed to send message');
      }

      const sentMessages = extractMessages(data) as Message[];
      const sentMessage =
        (data.chatMessage as Message | undefined) ||
        (extractConversation(data) ? undefined : (data.message as Message | undefined));
      const nextMessages = sentMessages.length
        ? sentMessages
        : sentMessage
        ? [sentMessage]
        : [];

      setMessages((current) => appendUniqueMessages(current, nextMessages));
      setDraft('');
      setAttachments([]);
      setReplyToMessage(null);
      setSelectedMessageKey('');
      setOpenMessageMenuKey('');
      setEmojiOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <ChatLoading />;
  }

  return (
    <div className="-m-6 grid h-[calc(100vh-69px)] grid-cols-[360px_1fr] overflow-hidden bg-[#f7f7fb] text-slate-900">
      <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-slate-900">Chat</h1>
            <span className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">
              {merchants.length}
            </span>
          </div>
          <label className="mt-4 flex h-11 items-center gap-3 rounded-lg bg-slate-100 px-3 text-slate-500">
            <span>⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search or start a new chat"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-500 outline-none"
            />
          </label>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto">
          {fetching && <p className="p-5 text-sm text-slate-500">Loading merchants...</p>}
          {!fetching && filteredMerchants.length === 0 && (
            <p className="p-5 text-sm text-slate-500">No merchants found.</p>
          )}
          {filteredMerchants.map((merchant) => {
            const merchantId = readMerchantId(merchant);
            const active = merchantId === selectedMerchantId;
            const name = readMerchantName(merchant);
            const updatedAt = readDate(merchant, ['updatedAt', 'reviewedAt', 'createdAt']);

            return (
              <button
                key={merchantId}
                type="button"
                onClick={() => selectMerchant(merchantId)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  active ? 'bg-slate-200' : 'hover:bg-slate-100'
                }`}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                  {initialsFor(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{name}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{readMerchantEmail(merchant)}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-slate-500">
                  {formatDay(updatedAt)}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col bg-[#f7f7fb]">
        {selectedMerchant ? (
          <>
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                  {initialsFor(readMerchantName(selectedMerchant))}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{readMerchantName(selectedMerchant)}</p>
                  <p className="truncate text-xs text-slate-500">{readMerchantStatus(selectedMerchant)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <button type="button" className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900">
                  ⌕
                </button>
                <button type="button" className="rounded-lg px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900">
                  ⋮
                </button>
              </div>
            </header>

            <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.035)_0,rgba(255,255,255,0.035)_2px,transparent_2px)] bg-[length:64px_64px] px-8 py-6">
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {loadingConversation && <p className="text-center text-sm text-slate-500">Loading conversation...</p>}
              {!loadingConversation && messages.length === 0 && (
                <p className="mx-auto max-w-sm rounded-lg bg-white p-4 text-center text-sm text-slate-500">
                  No messages yet. Start the conversation with this merchant.
                </p>
              )}
              <div className="space-y-3">
                {messages.map((message, index) => {
                  const outgoing = isOutgoingMessage(message, user?.role);
                  const createdAt = readDate(message, ['createdAt', 'created_at', 'sentAt', 'updatedAt']);
                  const senderName =
                    readMessageSenderName(message) ||
                    (outgoing ? user?.name || 'You' : readMerchantName(selectedMerchant)) ||
                    (outgoing ? 'You' : 'Merchant');
                  const initials = initialsFor(senderName);
                  const senderProfilePic = outgoing
                    ? resolveUploadUrl(user?.profilePic ?? '')
                    : resolveUploadUrl(readString(message, ['senderProfilePic', 'profilePic', 'senderAvatar']));
                  const messageKey = getMessageKey(message, index);
                  const messageId = getMessageId(message);
                  const isMenuOpen = openMessageMenuKey === messageKey;
                  const isSelected = selectedMessageKey === messageKey || isMenuOpen;
                  const isHighlighted = highlightedMessageKey === messageKey;
                  const replySnapshot = readReplyToMessage(message);
                  const replyTargetId = getReplyTargetId(message, replySnapshot);

                  return (
                    <div
                      key={messageKey}
                      ref={(element) => {
                        if (element) {
                          messageRefsRef.current.set(messageKey, element);
                        } else {
                          messageRefsRef.current.delete(messageKey);
                        }
                      }}
                      className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex max-w-[68%] items-start gap-3 ${outgoing ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-300 text-[11px] font-semibold text-slate-700">
                          <span>{initials}</span>
                          {senderProfilePic && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={senderProfilePic}
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.remove();
                              }}
                            />
                          )}
                        </span>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedMessageKey((current) => (current === messageKey ? '' : messageKey));
                            setOpenMessageMenuKey('');
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedMessageKey((current) => (current === messageKey ? '' : messageKey));
                              setOpenMessageMenuKey('');
                            }
                          }}
                          className={`group/message relative rounded-2xl px-3 py-3 pr-9 text-sm shadow outline-none ring-offset-2 transition ${
                            outgoing ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-900'
                          } ${isSelected || isHighlighted ? 'ring-2 ring-amber-400' : ''}`}
                        >
                          {messageId && (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedMessageKey(messageKey);
                                  setOpenMessageMenuKey((current) => (current === messageKey ? '' : messageKey));
                                }}
                                className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-xs opacity-0 shadow-sm transition group-hover/message:opacity-100 group-focus-within/message:opacity-100 ${
                                  isMenuOpen ? 'opacity-100' : ''
                                } ${
                                  outgoing
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : 'bg-slate-300 text-slate-700 hover:bg-slate-400'
                                }`}
                                aria-haspopup="menu"
                                aria-expanded={isMenuOpen}
                                aria-label="Message actions"
                                title="Message actions"
                              >
                                <svg
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="m6 9 6 6 6-6" />
                                </svg>
                              </button>
                              {isMenuOpen && (
                                <div
                                  role="menu"
                                  className="absolute right-2 top-9 z-20 w-20 rounded-md border border-slate-200 bg-white py-0.5 text-xs text-slate-800 shadow-lg"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setReplyToMessage(message);
                                      setSelectedMessageKey('');
                                      setOpenMessageMenuKey('');
                                    }}
                                    className="block w-full px-2.5 py-1.5 text-left text-xs font-medium transition hover:bg-slate-100"
                                  >
                                    Reply
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                          {!outgoing && (
                            <p className="mb-2 text-xs font-semibold text-slate-600">
                              {senderName}
                            </p>
                          )}
                          {replySnapshot && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                scrollToMessage(replyTargetId);
                              }}
                              disabled={!replyTargetId}
                              className={`mb-2 block w-full rounded-lg border-l-4 px-3 py-2 text-left transition disabled:cursor-default ${
                                outgoing
                                  ? 'border-indigo-200 bg-white/15 text-indigo-50'
                                  : 'border-indigo-400 bg-white/70 text-slate-700'
                              } ${replyTargetId ? 'hover:bg-white/30' : ''}`}
                            >
                              <p className="text-xs font-semibold">
                                {readReplyPreviewSender(replySnapshot)}
                              </p>
                              <p className="mt-1 line-clamp-2 break-words text-xs opacity-90">
                                {readReplyPreviewText(replySnapshot)}
                              </p>
                            </button>
                          )}
                          {readMessageText(message) && (
                            <p className="break-words leading-6">{readMessageText(message)}</p>
                          )}
                          {readMessageAttachments(message).length > 0 && (
                            <div className="mt-3 space-y-2 rounded-xl bg-white/10 p-3 text-slate-800 text-sm">
                              {readMessageAttachments(message).map((attachment, attachmentIndex) => {
                                const url = resolveUploadUrl(readString(attachment, ['url', 'fileUrl', 'downloadUrl']));
                                const name = readString(attachment, ['originalName', 'filename', 'name']) || 'Attachment';
                                const mimeType = readString(attachment, ['mimeType', 'type']);
                                const size = readString(attachment, ['size']);
                                const isImage = mimeType.startsWith('image/');
                                return (
                                  <a
                                    key={`${name}-${attachmentIndex}`}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 transition hover:border-slate-300"
                                  >
                                    {isImage && url && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={url}
                                        alt={name}
                                        className="mb-2 max-h-64 w-full rounded-lg object-contain"
                                      />
                                    )}
                                    <div className="flex items-center justify-between gap-3">
                                      <span>{name}</span>
                                      <span className="text-xs text-slate-500">{mimeType}</span>
                                    </div>
                                    {size && <div className="mt-1 text-xs text-slate-500">{size} bytes</div>}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                          <p className={`mt-1 text-right text-[11px] ${outgoing ? 'text-indigo-100' : 'text-slate-500'}`}>
                            {formatTime(createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <form onSubmit={sendMessage} className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-5 py-3">
              <div className="relative min-w-0 flex-1 rounded-2xl border border-slate-200 bg-[#f7f7fb] px-3 py-3">
                {replyToMessage && (
                  <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border-l-4 border-indigo-500 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-indigo-600">
                        Replying to {readReplyPreviewSender(replyToMessage)}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-600">
                        {readReplyPreviewText(replyToMessage)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyToMessage(null)}
                      className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Cancel reply"
                      title="Cancel reply"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={openFilePicker}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Attach files"
                    title="Attach files"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.25"
                      viewBox="0 0 24 24"
                    >
                      <path d="m21.4 11.5-8.7 8.7a6 6 0 0 1-8.5-8.5l9.7-9.7a4 4 0 0 1 5.7 5.7l-9.8 9.8a2 2 0 0 1-2.8-2.8l8.7-8.7" />
                    </svg>
                  </button>
                  <input
                    ref={fileInputRef}
                    id="chat-attachments"
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={onAttachmentsChange}
                  />
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((current) => !current)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Open emoji picker"
                    title="Emoji"
                  >
                    <span aria-hidden="true" className="text-lg leading-none">😊</span>
                  </button>
                  {emojiOpen && (
                    <div className="absolute bottom-16 left-3 z-30 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
                      <Picker
                        data={data}
                        onEmojiSelect={handleSelectEmoji}
                        theme="light"
                        navPosition="bottom"
                        previewPosition="none"
                        skinTonePosition="search"
                        perLine={9}
                      />
                    </div>
                  )}
                  <input
                    ref={messageInputRef}
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Type a message"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                </div>

                {attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {attachments.map((file, index) => {
                      const isImage = file.type.startsWith('image/');
                      const previewUrl = attachmentPreviews[index];

                      return (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                        >
                          {isImage && previewUrl ? (
                            <Image
                              src={previewUrl}
                              alt={file.name}
                              width={24}
                              height={24}
                              unoptimized
                              className="rounded-md object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-200 text-[11px] font-semibold text-slate-700">
                              {file.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <span>{getShortFileName(file.name, 5)}</span>
                          <button
                            type="button"
                            onClick={() => setAttachments((current) => current.filter((_, idx) => idx !== index))}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={sending || (!draft.trim() && attachments.length === 0)}
                className="h-11 rounded-lg bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-slate-200 disabled:text-slate-500"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div className="grid h-full place-items-center text-sm text-slate-500">
            Select a merchant to open chat.
          </div>
        )}
      </section>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatPageContent />
    </Suspense>
  );
}
