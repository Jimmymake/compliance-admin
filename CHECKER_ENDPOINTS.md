# Checker Endpoints

This document lists the endpoints intended for the checker role.

It includes:

- Checker-specific review endpoints
- Shared review/admin-access endpoints that checkers can call

It excludes:

- Merchant-only endpoints
- Approver-only final decision endpoints
- Approver-only step approval and rejection endpoints
- Platform backend session-generation endpoints
- Internal server-to-server endpoints

## Authentication

Checker access uses the same JWT/session flow as other users.

- `POST /api/auth/staff-signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

Both `staff-signup` and `login` require:

```http
X-Platform-Session-Token: <PLATFORM_SESSION_TOKEN>
```

### `POST /api/auth/staff-signup`

Creates a checker account for a platform.

#### Headers

```http
X-Platform-Session-Token: <PLATFORM_SESSION_TOKEN>
```

#### Request payload

```json
{
  "name": "Jane Reviewer",
  "email": "jane@example.com",
  "password": "StrongPass123!",
  "phone": "+254700000000",
  "profilePic": "",
  "platformReferenceId": "checker-001",
  "role": "checker"
}
```

#### Successful response

```json
{
  "message": "Checker account created successfully",
  "user": {
    "userId": "66f1c2a0c2f6a01234567890",
    "name": "Jane Reviewer",
    "email": "jane@example.com",
    "phone": "+254700000000",
    "profilePic": "",
    "role": "checker",
    "platformName": "Acme Payments",
    "platformReferenceId": "checker-001"
  },
  "admin": {
    "adminId": "66f1c2a0c2f6a01234567891",
    "platformReferenceId": "checker-001",
    "role": "checker",
    "isActive": true
  },
  "sessionToken": "jwt-token-here",
  "expiresIn": "7d"
}
```

#### Common errors

```json
{ "message": "role must be merchant, checker, or approver" }
```

```json
{ "message": "platformReferenceId is required" }
```

```json
{ "message": "A user with this email already exists" }
```

```json
{ "message": "Password must be at least 12 characters long" }
```

### `POST /api/auth/login`

Logs in a checker and returns a session token.

#### Headers

```http
X-API-Key: <PLATFORM_API_KEY>
```

#### Request payload

```json
{
  "email": "jane@example.com",
  "password": "StrongPass123!"
}
```

#### Successful response

```json
{
  "message": "Login successful",
  "user": {
    "userId": "66f1c2a0c2f6a01234567890",
    "name": "Jane Reviewer",
    "email": "jane@example.com",
    "profilePic": "",
    "role": "checker",
    "platformName": "Acme Payments",
    "platformReferenceId": "checker-001"
  },
  "merchant": null,
  "sessionToken": "jwt-token-here",
  "expiresIn": "7d"
}
```

#### Common errors

```json
{ "message": "email and password are required" }
```

```json
{ "message": "Invalid email or password" }
```

```json
{ "message": "Account is deactivated" }
```

## Shared Review Surface

These endpoints are accessible to checker, approver, or admin roles, but they are commonly used by checkers during review.

- `GET /api/admin/dashboard`
- `GET /api/admin/merchants`
- `GET /api/admin/merchants/:merchantId`
- `POST /api/admin/merchants/:merchantId/notes`
- `GET /api/admin/merchants/:merchantId/notes`
- `GET /api/admin/merchants/:merchantId/step-reviews`
- `GET /api/admin/merchants/:merchantId/timeline`
- `GET /api/admin/analytics/step-completion`
- `GET /api/conversations/merchant/:merchantId`
- `POST /api/conversations`
- `POST /api/messages`
- `GET /api/messages/conversation/:conversationId`
- `PUT /api/messages/:messageId/read`
- `GET /api/notifications`
- `PUT /api/notifications/:notificationId/read`
- `PUT /api/notifications/read-all`
- `GET /api/user/profiles`
- `GET /api/user/profiles/export`
- `POST /api/onboarding/reset/:merchantId`

### Common response pattern

```json
{
  "message": "Checker or approver access required"
}
```

appears when the role is missing or unauthorized for shared endpoints.

## Checker-Specific Endpoints

Checkers review merchant data and documents. They can mark steps as reviewed, add notes, and submit the final checker review decision, but they cannot approve or reject onboarding steps or the overall merchant application.

## Merchant Chat Endpoints

Checker chat is scoped to the selected merchant case. The backend stores the conversation by `merchantId + platformId`, so previous messages return when the checker opens the merchant again.

### `GET /api/conversations/merchant/:merchantId`

Creates or reuses the merchant conversation and returns all previous messages.

### `POST /api/messages`

Sends a message in the merchant conversation.

```json
{
  "merchantId": "merchant_xxxxxxxx",
  "messageType": "text",
  "text": "Please confirm the settlement bank document. 👍"
}
```

Emoji are sent as normal Unicode inside `text`. Messages can also include uploaded `attachments` using multipart form data. Chat accepts any attachment MIME type, but each file must be `10MB` or smaller.

Files and images are uploaded through this REST endpoint, not through Socket.IO. After the backend stores the uploaded file and message, Socket.IO emits `chat:message` with the saved message plus attachment metadata/URLs.

### `GET /api/messages/conversation/:conversationId`

Returns all previous messages sorted oldest to newest.

### `PUT /api/messages/:messageId/read`

Marks a message as read for the checker.

## Notifications

Checker notifications are stored in MongoDB and scoped to the authenticated checker user.
The backend creates them automatically for:

- `merchant-signup`: merchant signs up on the same platform
- `onboarding-submitted`: merchant submits completed onboarding documents for checker review

Each stored notification emits `notification:new` over Socket.IO.

### `GET /api/notifications`

Returns stored notifications for the checker.

Query params:

- `limit`: optional, max `100`, defaults to `50`
- `unreadOnly`: optional, set to `true` to return unread notifications only

### `PUT /api/notifications/:notificationId/read`

Marks one notification as read.

### `PUT /api/notifications/read-all`

Marks all checker notifications as read.

### Socket.IO events

- `chat:message`: emitted with the stored chat message. For files/images, the event contains attachment metadata and URLs, not raw file binary data.
- `notification:new`: emitted with the stored notification document
- `merchant:registered`: emitted with merchant signup details for the platform

### `POST /api/admin/merchants/:merchantId/steps/:stepName/review`

Marks a specific onboarding step as reviewed.

#### Request payload

```json
{
  "note": "Documents are consistent and complete."
}
```

#### Successful response

```json
{
  "message": "Step reviewed successfully",
  "review": {},
  "overallStatus": "reviewed",
  "finishedChecking": true
}
```

#### Common errors

```json
{ "message": "Checker access required" }
```

```json
{ "message": "Invalid step name" }
```

```json
{ "message": "Merchant must be awaiting review before checker review begins" }
```

### `POST /api/admin/merchants/:merchantId/review-decision`

Submits the final checker review decision and can attach a file.

#### Request payload

```json
{
  "status": "reviewed",
  "reason": "All required fields are present.",
  "notes": "Ready for approver review."
}
```

#### Form data

- `attachment`: optional file upload

#### Successful response

```json
{
  "message": "Merchant reviewed successfully",
  "merchantId": "merchant_xxxxxxxx",
  "status": "reviewed",
  "notes": "Ready for approver review.",
  "attachmentUrl": "/uploads/admin-reviews/file.pdf"
}
```

#### Common errors

```json
{ "message": "Checker access required" }
```

```json
{ "message": "Invalid or missing status" }
```

```json
{ "message": "All steps must be reviewed individually before final checker review" }
```

### `POST /api/admin/merchants/:merchantId/notes`

Adds a list-style note to a merchant case. Notes can be attached to the whole case, one onboarding step, or one field inside a step. A note can contain text, uploaded files/images, or both.

#### JSON request payload

```json
{
  "stepName": "companyinformation",
  "fieldName": "incorporationNumber",
  "visibility": "internal",
  "noteType": "reviewer-note",
  "message": "Please confirm the incorporation number.",
  "attachments": [
    {
      "url": "/uploads/admin-reviews/example.png",
      "originalName": "example.png",
      "mimeType": "image/png",
      "size": 12345
    }
  ],
  "isFinal": false
}
```

#### Multipart form data

- `stepName`: optional, defaults to `all`
- `fieldName`: optional, for field-level notes
- `visibility`: `internal` or `merchant`
- `noteType`: `reviewer-note`, `approver-note`, `system-note`, or `merchant-note`
- `message`: optional when at least one attachment is uploaded
- `attachments`: optional file/image uploads, up to 10 files
- `isFinal`: optional boolean

#### Successful response

```json
{
  "message": "Merchant note created successfully",
  "note": {}
}
```

#### Common errors

```json
{ "message": "message or attachment is required" }
```

```json
{ "message": "Invalid visibility" }
```

```json
{ "message": "Invalid step name" }
```

### `GET /api/admin/merchants/:merchantId/notes`

Returns the note list for a merchant. Notes can be filtered by `visibility`, `stepName`, and `fieldName`.

#### Example

```http
GET /api/admin/merchants/merchant_xxxxxxxx/notes?stepName=companyinformation&fieldName=incorporationNumber
```

#### Successful response

```json
{
  "notes": [],
  "currentFieldNotes": {
    "companyinformation": {
      "incorporationNumber": {}
    }
  }
}
```

```json
{ "message": "Merchant not found" }
```

## Checker Notes

- Checkers can review individual steps before the merchant is moved to `reviewed`.
- Checkers can review all merchant onboarding documents and submitted field data.
- Checkers can add internal step-level or field-level notes with optional attachments.
- Checkers cannot call approver approval or rejection endpoints.
- Shared endpoints also allow visibility into merchant timelines and review history.
