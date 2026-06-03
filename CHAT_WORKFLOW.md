# Chat Workflow

This document describes the end-to-end chat system workflow.

## Goal

Create a shared, persistent chat system that works across merchant, checker, and approver users inside the same platform. A merchant case has one conversation tied to `merchantId + platformId`, so previous messages are returned whenever the merchant, checker, or approver opens that merchant's chat again.

## Core Chat Data

### Conversation

- `platformId`
- `merchantId`
- `participants`
- `status`
- `lastMessageAt`

### Message

- `platformId`
- `conversationId`
- `merchantId`
- `senderId`
- `senderRole`
- `senderName`
- `senderProfilePic`
- `messageType`
- `text`
- `attachments`
- `readBy`
- `metadata`

## End-to-End Flow

1. Merchant opens a compliance chat from the onboarding dashboard.
2. Backend creates or reuses a conversation for that merchant case using the authenticated merchant's `merchantId`.
3. Merchant sends a message.
4. Message is stored with `senderId`, `senderRole`, and `platformId`.
5. Checker sees the same conversation in their review dashboard.
6. Checker replies in the same thread.
7. Approver joins the same thread after review is complete.
8. Approver can read the full history before making a decision.
9. Chat supports text, files, and system messages.
10. Read receipts update as participants open the thread.

## Previous Message Loading

### Merchant login

1. Merchant logs in and receives a merchant JWT.
2. Frontend calls `GET /api/conversations/merchant/:merchantId` or `POST /api/conversations`.
3. Backend uses the authenticated merchant's `merchantId` and `platformId`.
4. Backend returns the existing conversation and all previous messages sorted oldest to newest.

### Checker or approver login

1. Checker or approver logs in and opens a merchant detail page.
2. Frontend calls `GET /api/conversations/merchant/:merchantId` with the selected merchant ID.
3. Backend checks that the merchant belongs to the same `platformId` as the reviewer, unless the user is an admin.
4. Backend returns the same conversation and all previous messages sorted oldest to newest.

## Chat Rules

- Use `userId` as the real identity.
- Use `name` and `profilePic` only for display.
- Use `platformId` to prevent cross-company access.
- Use `merchantId` to tie the thread to the onboarding case.
- Keep the same conversation thread for the whole onboarding lifecycle.
- Merchants can only load or send messages for their own `merchantId`.
- Checkers and approvers can load or send messages only for merchants in their platform.

## Recommended UI Behavior

- Merchant sees the chat inside onboarding.
- Checker sees the chat inside the review queue.
- Approver sees the chat inside approval review.
- Support can join later without changing the thread structure.

## Suggested Message Types

- `text`
- `image`
- `video`
- `audio`
- `document`
- `file`
- `system`

## Suggested Conversation Statuses

- `open`
- `in-review`
- `resolved`

## Chat API Touchpoints

### `POST /api/conversations`

Creates or reuses the merchant conversation and returns previous messages.

Merchant request payload can be empty because the JWT already contains `merchantId`.

Checker/approver request payload:

```json
{
  "merchantId": "merchant_xxxxxxxx"
}
```

### `GET /api/conversations/merchant/:merchantId`

Creates or reuses the merchant conversation and returns previous messages.

For merchants, the backend uses the authenticated merchant's own `merchantId`. For checkers and approvers, `:merchantId` is the merchant case they opened.

### `GET /api/conversations/:conversationId`

Returns one conversation and its previous messages.

### `GET /api/conversations/platform/:platformId`

Returns the conversations for a platform. Checkers and approvers can only request their own platform.

### `POST /api/messages`

Sends a new message. The request can use either `conversationId` or `merchantId`.

JSON payload:

```json
{
  "merchantId": "merchant_xxxxxxxx",
  "messageType": "text",
  "text": "Please confirm the settlement bank document. 👍",
  "attachments": []
}
```

Emoji are sent as normal Unicode inside `text`. Multipart form data is also supported with `attachments` files. Chat accepts any attachment MIME type, including images, PDFs, documents, videos, audio, and archives, but each uploaded file must be `10MB` or smaller.

Files and images are not sent through Socket.IO. The frontend uploads binary files through `POST /api/messages`; after the backend stores the files and message, Socket.IO broadcasts the saved message with attachment metadata and URLs.

### `GET /api/messages/conversation/:conversationId`

Returns all previous messages in that conversation sorted oldest to newest.

### `PUT /api/messages/:messageId/read`

Marks a message as read for the authenticated user.

## WebSocket Events

The server also exposes Socket.IO on the same API host. Clients authenticate with the same JWT used for REST calls.

### Client connection

```js
const socket = io(API_BASE_URL, {
  auth: { token: sessionToken }
});
```

On connection, the server joins the socket to these rooms based on the JWT:

- `user:<userId>`
- `merchant:<merchantId>`
- `platform:<platformId>`
- `platform:<platformId>:role:<role>`

### Join a conversation room

```js
socket.emit("conversation:join", conversationId);
```

### Receive a chat message

```js
socket.on("chat:message", (payload) => {
  // payload = { conversation, chatMessage }
});
```

The `chat:message` event is emitted after `POST /api/messages` stores the message.

Socket.IO does not carry raw file or image binary data. For attachment messages, `payload.chatMessage.attachments` contains the stored file metadata and URL, and the frontend should render or download the attachment from that URL.

### Receive a new notification

```js
socket.on("notification:new", (notification) => {});
```

### Receive merchant signup event

```js
socket.on("merchant:registered", (payload) => {});
```

Checker and approver clients receive this when a merchant signs up on their platform.

## Notes

- Chat should not guess users from names.
- Chat should use authenticated identity from the JWT.
- Merchant, checker, and approver can all live in the same thread.
- The frontend can render profile pictures, but the backend must trust IDs.
- Chat history is stored in MongoDB in `conversations` and `messages`.
- Real-time delivery uses Socket.IO, while REST remains the source of truth for stored history.
- Attachment upload uses REST multipart form data; Socket.IO only broadcasts the stored message plus attachment metadata/URLs.
