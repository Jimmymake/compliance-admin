# Frontend Real-Time Chat Setup

This backend already supports real-time chat with Socket.IO. The frontend must still use REST to store and load chat history, then use Socket.IO to receive live updates.

## Install Client Package

```bash
npm install socket.io-client
```

## Connect To Socket.IO

Connect to the API host itself, not to an API route like `/api/messages`.

```ts
import { io } from "socket.io-client";

const socket = io(API_BASE_URL, {
  auth: { token: sessionToken },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Socket connected", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error", error.message);
});
```

Example:

```ts
const socket = io("http://localhost:4001", {
  auth: { token: sessionToken },
  transports: ["websocket"],
});
```

The token must be the same JWT used for authenticated REST calls.

## Join Conversation Room

After the frontend loads or creates a conversation, join that conversation room.

```ts
socket.emit("conversation:join", conversationId);
```

When the user leaves the chat screen, the frontend can leave the room.

```ts
socket.emit("conversation:leave", conversationId);
```

## Receive New Chat Messages

Listen for `chat:message`.

```ts
socket.on("chat:message", ({ conversation, chatMessage }) => {
  // Add chatMessage to local state or update the React Query cache.
});
```

Payload shape:

```ts
{
  conversation: {},
  chatMessage: {
    _id: string;
    conversationId: string;
    merchantId: string;
    senderRole: "merchant" | "checker" | "approver" | "admin";
    senderName: string;
    senderProfilePic: string;
    messageType: "text" | "image" | "video" | "audio" | "document" | "file" | "system";
    text: string;
    attachments: Array<{
      originalName: string;
      filename: string;
      url: string;
      mimeType: string;
      size: number;
    }>;
    createdAt: string;
  };
}
```

## Send Messages

Sending still uses REST:

```http
POST /api/messages
```

JSON example:

```json
{
  "conversationId": "CONVERSATION_ID",
  "messageType": "text",
  "text": "Hello, I have uploaded the requested document."
}
```

For file uploads, send multipart form data with the file field name `attachments`. Each file must be `10MB` or smaller.

Do not send file or image binary data through Socket.IO. Files, images, videos, audio, and documents must be uploaded through `POST /api/messages`. After the backend stores the uploaded files and message, it emits `chat:message` automatically.

The Socket.IO event only carries the saved message payload and attachment metadata/URLs:

```ts
{
  chatMessage: {
    messageType: "image" | "video" | "audio" | "document" | "file";
    text: string;
    attachments: [
      {
        originalName: string;
        filename: string;
        url: string;
        mimeType: string;
        size: number;
      }
    ];
  }
}
```

Frontend flow for attachments:

```txt
upload attachment with POST /api/messages
-> backend stores the file and message
-> backend emits chat:message over Socket.IO
-> other clients receive the attachment URL/metadata
-> frontend renders or downloads the file from the URL
```

## Load Chat History

Real-time events are for live delivery only. The frontend should still load stored history when opening the chat.

```http
GET /api/conversations/merchant/:merchantId
GET /api/messages/conversation/:conversationId
```

Use the REST response as the source of truth, then append live `chat:message` events as they arrive.

## Notifications

The same socket connection can also receive notifications.

```ts
socket.on("notification:new", (notification) => {
  // Add notification to notification state or cache.
});
```

Checker and approver clients can also listen for merchant signup events.

```ts
socket.on("merchant:registered", (payload) => {
  // Refresh merchant queues or show a notification.
});
```

## Browser Verification

Open browser DevTools and check **Network -> WS**. A healthy Socket.IO connection looks like this:

```txt
/socket.io/?EIO=4&transport=websocket
```

Also check the browser console for:

```txt
Socket connected <socket-id>
```

## Common Problems

- `Access token required`: the frontend did not pass `auth: { token }`.
- `Invalid token` or `Token expired`: the JWT is missing, expired, or signed with the wrong secret.
- No live messages: confirm the frontend joined the conversation room and is listening for `chat:message`.
- REST works but socket does not connect: confirm the frontend uses the API host, for example `http://localhost:4001`, not `/api/messages`.
- Attachments fail with `413`: one or more uploaded files are larger than `10MB`.

## Expected Flow

```txt
open chat screen
-> load/create conversation with REST
-> connect Socket.IO with JWT
-> emit conversation:join
-> send message with POST /api/messages
-> backend stores message in MongoDB
-> backend emits chat:message
-> other connected users receive the message immediately
-> file/image recipients use attachment URLs from chatMessage.attachments
```
