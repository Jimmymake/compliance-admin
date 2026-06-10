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

Final merchant statuses are locked. Once the overall status is `approved` or `rejected`, checker actions that would alter review state or overall status return `409`:

```json
{
  "message": "Merchant application is already approved. Final merchant status cannot be altered.",
  "status": "approved"
}
```

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
  "message": "Checker account created successfully. Phone verification is required before this account can continue.",
  "user": {
    "userId": "66f1c2a0c2f6a01234567890",
    "name": "Jane Reviewer",
    "email": "jane@example.com",
    "phone": "+254700000000",
    "phoneVerified": false,
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
  "verificationRequired": true,
  "phoneVerification": {
    "sent": true,
    "expiresAt": "2026-06-09T10:10:00.000Z",
    "message": "Verification code sent by SMS"
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

```json
{ "message": "phone must be in international format, for example +254700000000" }
```

```json
{ "message": "Too many signup SMS attempts. Please try again later.", "retryAfterSeconds": 900 }
```

### `POST /api/auth/verify-phone`

Verifies the authenticated checker account using the 6-digit SMS code.

#### Headers

```http
Authorization: Bearer <sessionToken>
```

#### Request payload

```json
{ "code": "123456" }
```

#### Successful response

```json
{
  "message": "Phone number verified successfully",
  "verificationRequired": false,
  "phoneVerified": true
}
```

#### Common errors

```json
{ "message": "Too many phone verification attempts. Please try again later.", "retryAfterSeconds": 900 }
```

### `POST /api/auth/resend-phone-code`

Sends a new SMS verification code to the authenticated checker's saved phone number.

#### Headers

```http
Authorization: Bearer <sessionToken>
```

#### Successful response

```json
{
  "message": "Verification code sent by SMS",
  "verificationRequired": true,
  "phoneVerified": false,
  "expiresAt": "2026-06-09T10:10:00.000Z"
}
```

#### Common errors

```json
{ "message": "Too many phone verification code requests. Please try again later.", "retryAfterSeconds": 900 }
```

### `POST /api/auth/change-phone`

Changes the authenticated checker's phone number, resets `phoneVerified` to `false`, sends a new SMS verification code, and blocks protected routes until the new number is verified.

#### Headers

```http
Authorization: Bearer <sessionToken>
```

#### Request payload

```json
{ "phone": "+254700000000" }
```

#### Successful response

```json
{
  "message": "Phone number changed. Verification code sent by SMS.",
  "verificationRequired": true,
  "phoneVerified": false,
  "phone": "+254700000000",
  "expiresAt": "2026-06-09T10:10:00.000Z"
}
```

#### Common errors

```json
{ "message": "phone must be in international format, for example +254700000000" }
```

```json
{ "message": "Too many phone verification code requests. Please try again later.", "retryAfterSeconds": 900 }
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
    "phone": "+254700000000",
    "phoneVerified": false,
    "profilePic": "",
    "role": "checker",
    "platformName": "Acme Payments",
    "platformReferenceId": "checker-001"
  },
  "merchant": null,
  "verificationRequired": true,
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

### Phone Verification Gate

Before `phoneVerified` is true, the checker can only log in, call `GET /api/auth/me`, verify the phone code, or request another code. Shared review/chat/notification routes return:

```json
{
  "message": "Phone number verification is required before this account can continue",
  "verificationRequired": true,
  "phoneVerified": false,
  "phone": "+254700000000"
}
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

### Shared merchant data responses

`GET /api/admin/merchants`, `GET /api/admin/merchants/:merchantId`, and `GET /api/admin/reviews/pending` return full Merchant records, excluding only the internal Mongoose `__v` field. The `merchant` object includes fields such as `_id`, `platformId`, `platformReferenceId`, `merchantId`, `userId`, contact/profile fields, `businessCategory`, `registeredBusiness`, `onboardingStatus`, `onboardingSteps`, approval/rejection audit fields, `adminNotes`, `adminAttachment`, `createdAt`, and `updatedAt`.

`GET /api/admin/merchants/:merchantId` also returns full onboarding step documents under `steps.companyinformation`, `steps.ubo`, `steps.paymentandprosessing`, `steps.settlmentbankdetails`, `steps.riskmanagement`, and `steps.kycdocs`.

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
  "text": "Please confirm the settlement bank document. 👍",
  "replyToMessageId": "66f1c2a0c2f6a01234567890"
}
```

`replyToMessageId` is optional. When present, the backend stores a `replyTo` snapshot on the new message so the frontend can show a reply preview above the message.

Emoji are sent as normal Unicode inside `text`. Messages can also include uploaded `attachments` using multipart form data. Chat accepts any attachment MIME type, but each file must be `10MB` or smaller.

Files and images are uploaded through this REST endpoint, not through Socket.IO. After the backend stores the uploaded file and message, Socket.IO emits `chat:message` with the saved message plus attachment metadata/URLs.

### `GET /api/messages/conversation/:conversationId`

Returns all previous messages sorted oldest to newest.

### `PUT /api/messages/:messageId/read`

Marks a message as read for the checker.

## Notifications

Checker notifications are stored in MongoDB and scoped to the authenticated checker user. Each stored notification also sends an SMS to the recipient's saved phone number when `SMS_NOTIFICATIONS_ENABLED=true`.
The backend creates them automatically for:

- `merchant-signup`: merchant signs up on the same platform
- `onboarding-submitted`: merchant submits completed onboarding documents for checker review

Each stored notification emits `notification:new` over Socket.IO and is sent through the SMS provider when enabled.

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

Marks a submitted onboarding step as reviewed.

The checker reviews the step as a whole. Field/item-level review is not required before marking the step reviewed.

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

### `GET /api/admin/merchants/:merchantId/steps/:stepName/items/reviews`

Returns the submitted items for any onboarding step and their individual checker/approver statuses.

This endpoint is optional detail for UI display or audit history. It is not required for checker workflow progression.

Valid `stepName` values: `companyinformation`, `ubo`, `paymentandprosessing`, `settlmentbankdetails`, `riskmanagement`, `kycdocs`.

#### Successful response

```json
{
  "merchantId": "merchant_xxxxxxxx",
  "stepName": "companyinformation",
  "submittedItems": ["companyName", "companyEmail", "contactPerson"],
  "reviews": [
    {
      "itemName": "companyName",
      "value": "Acme Ltd",
      "reviewerStatus": "reviewed",
      "approverStatus": "pending"
    }
  ],
  "allReviewed": false,
  "allApproved": false
}
```

### `POST /api/admin/merchants/:merchantId/steps/:stepName/items/:itemName/review`

Marks one submitted item inside any onboarding step as checker-reviewed for optional audit detail.

This does not mark the step as reviewed and does not move the merchant to `reviewed`. Use `POST /api/admin/merchants/:merchantId/steps/:stepName/review` to review the submitted step as a whole.

#### Request payload

```json
{
  "note": "Company name matches the registration document."
}
```

#### Successful response

```json
{
  "message": "Step item reviewed successfully",
  "stepName": "companyinformation",
  "itemName": "companyName",
  "review": {},
  "allStepItemsReviewed": true,
  "finishedChecking": false,
  "overallStatus": "awaiting-review"
}
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
{ "message": "All submitted steps must be reviewed before final checker review" }
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
