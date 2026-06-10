# Approver Endpoints

This document lists the endpoints intended for the approver role.

It includes:

- Approver-specific final decision endpoints
- Shared review/admin-access endpoints that approvers can call

It excludes:

- Merchant-only endpoints
- Checker-only step review endpoints
- Platform backend session-generation endpoints
- Internal server-to-server endpoints

Final merchant statuses are locked. Once the overall status is `approved` or `rejected`, approver actions that would alter review state or overall status return `409`:

```json
{
  "message": "Merchant application is already rejected. Final merchant status cannot be altered.",
  "status": "rejected"
}
```

## Authentication

Approver access uses the same JWT/session flow as other users.

- `POST /api/auth/staff-signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

Both `staff-signup` and `login` require:

```http
X-Platform-Session-Token: <PLATFORM_SESSION_TOKEN>
```

### `POST /api/auth/staff-signup`

Creates an approver account for a platform.

#### Headers

```http
X-Platform-Session-Token: <PLATFORM_SESSION_TOKEN>
```

#### Request payload

```json
{
  "name": "John Approver",
  "email": "john@example.com",
  "password": "StrongPass123!",
  "phone": "+254700000000",
  "profilePic": "",
  "platformReferenceId": "approver-001",
  "role": "approver"
}
```

#### Successful response

```json
{
  "message": "Approver account created successfully. Phone verification is required before this account can continue.",
  "user": {
    "userId": "66f1c2a0c2f6a01234567890",
    "name": "John Approver",
    "email": "john@example.com",
    "phone": "+254700000000",
    "phoneVerified": false,
    "profilePic": "",
    "role": "approver",
    "platformName": "Acme Payments",
    "platformReferenceId": "approver-001"
  },
  "admin": {
    "adminId": "66f1c2a0c2f6a01234567891",
    "platformReferenceId": "approver-001",
    "role": "approver",
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

Verifies the authenticated approver account using the 6-digit SMS code.

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

Sends a new SMS verification code to the authenticated approver's saved phone number.

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

Changes the authenticated approver/admin phone number, resets `phoneVerified` to `false`, sends a new SMS verification code, and blocks protected routes until the new number is verified.

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

Logs in an approver and returns a session token.

#### Headers

```http
X-API-Key: <PLATFORM_API_KEY>
```

#### Request payload

```json
{
  "email": "john@example.com",
  "password": "StrongPass123!"
}
```

#### Successful response

```json
{
  "message": "Login successful",
  "user": {
    "userId": "66f1c2a0c2f6a01234567890",
    "name": "John Approver",
    "email": "john@example.com",
    "phone": "+254700000000",
    "phoneVerified": false,
    "profilePic": "",
    "role": "approver",
    "platformName": "Acme Payments",
    "platformReferenceId": "approver-001"
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

Before `phoneVerified` is true, the approver or admin can only log in, call `GET /api/auth/me`, verify the phone code, or request another code. Shared review/chat/notification routes return:

```json
{
  "message": "Phone number verification is required before this account can continue",
  "verificationRequired": true,
  "phoneVerified": false,
  "phone": "+254700000000"
}
```

## Shared Review Surface

These endpoints are accessible to checker, approver, or admin roles, but they are commonly used by approvers during final review.

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

## Merchant Chat Endpoints

Approver chat is scoped to the selected merchant case. The backend stores the conversation by `merchantId + platformId`, so previous messages return when the approver opens the merchant again.

### `GET /api/conversations/merchant/:merchantId`

Creates or reuses the merchant conversation and returns all previous messages.

### `POST /api/messages`

Sends a message in the merchant conversation.

```json
{
  "merchantId": "merchant_xxxxxxxx",
  "messageType": "text",
  "text": "I have reviewed the submitted documents. 👍",
  "replyToMessageId": "66f1c2a0c2f6a01234567890"
}
```

`replyToMessageId` is optional. When present, the backend stores a `replyTo` snapshot on the new message so the frontend can show a reply preview above the message.

Emoji are sent as normal Unicode inside `text`. Messages can also include uploaded `attachments` using multipart form data. Chat accepts any attachment MIME type, but each file must be `10MB` or smaller.

Files and images are uploaded through this REST endpoint, not through Socket.IO. After the backend stores the uploaded file and message, Socket.IO emits `chat:message` with the saved message plus attachment metadata/URLs.

### `GET /api/messages/conversation/:conversationId`

Returns all previous messages sorted oldest to newest.

### `PUT /api/messages/:messageId/read`

Marks a message as read for the approver.

## Notifications

Approver notifications are stored in MongoDB and scoped to the authenticated approver user. Admin/reviewer notifications use the same delivery path. Each stored notification also sends an SMS to the recipient's saved phone number when `SMS_NOTIFICATIONS_ENABLED=true`.
The backend creates them automatically for:

- `merchant-signup`: merchant signs up on the same platform
- `checker-review-completed`: checker review is complete and the merchant is ready for final approval

Each stored notification emits `notification:new` over Socket.IO and is sent through the SMS provider when enabled.

### `GET /api/notifications`

Returns stored notifications for the approver.

Query params:

- `limit`: optional, max `100`, defaults to `50`
- `unreadOnly`: optional, set to `true` to return unread notifications only

### `PUT /api/notifications/:notificationId/read`

Marks one notification as read.

### `PUT /api/notifications/read-all`

Marks all approver notifications as read.

### Socket.IO events

- `chat:message`: emitted with the stored chat message. For files/images, the event contains attachment metadata and URLs, not raw file binary data.
- `notification:new`: emitted with the stored notification document
- `merchant:registered`: emitted with merchant signup details for the platform

### `POST /api/admin/merchants/:merchantId/notes`

Adds a list-style note to a merchant case. Notes can be attached to the whole case, one onboarding step, or one field inside a step. A note can contain text, uploaded files/images, or both.

#### JSON request payload

```json
{
  "stepName": "kycdocs",
  "fieldName": "passport",
  "visibility": "internal",
  "noteType": "approver-note",
  "message": "Passport image is unclear.",
  "attachments": [
    {
      "url": "/uploads/admin-reviews/passport-example.png",
      "originalName": "passport-example.png",
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
GET /api/admin/merchants/merchant_xxxxxxxx/notes?stepName=kycdocs&fieldName=passport
```

#### Successful response

```json
{
  "notes": [],
  "currentFieldNotes": {
    "kycdocs": {
      "passport": {}
    }
  }
}
```

## Approver-Specific Endpoints

### `POST /api/admin/merchants/:merchantId/steps/:stepName/approve`

Approves one submitted step after checker review.

The approver approves the step as a whole. Field/item-level approval is not required before marking the step approved.

#### Request payload

```json
{
  "note": "Approved after final checks."
}
```

#### Successful response

```json
{
  "message": "Step approved successfully",
  "review": {},
  "overallStatus": "reviewed",
  "finishedApproving": true
}
```

#### Common errors

```json
{ "message": "Approver access required" }
```

```json
{ "message": "Invalid step name" }
```

```json
{ "message": "Merchant must be reviewed before approver step approval" }
```

```json
{ "message": "Step must be reviewed before approval" }
```

### `GET /api/admin/merchants/:merchantId/steps/:stepName/items/reviews`

Returns the submitted items for any onboarding step and their individual checker/approver statuses.

This endpoint is optional detail for UI display or audit history. It is not required for approver workflow progression.

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
      "approverStatus": "approved"
    }
  ],
  "allReviewed": true,
  "allApproved": false
}
```

### `POST /api/admin/merchants/:merchantId/steps/:stepName/items/:itemName/approve`

Approves one checker-reviewed submitted item inside any onboarding step for optional audit detail.

This does not mark the step as approved. Use `POST /api/admin/merchants/:merchantId/steps/:stepName/approve` to approve the submitted step as a whole.

#### Request payload

```json
{
  "note": "Company name approved."
}
```

#### Successful response

```json
{
  "message": "Step item approved successfully",
  "stepName": "companyinformation",
  "itemName": "companyName",
  "review": {},
  "allStepItemsApproved": true,
  "finishedApproving": false,
  "overallStatus": "reviewed"
}
```

### `POST /api/admin/merchants/:merchantId/steps/:stepName/items/:itemName/reject`

Rejects one checker-reviewed submitted item inside any onboarding step for optional audit detail.

This records the item-level rejection only. It does not mark the step rejected and does not change the merchant's overall status to `rejected`. Use `POST /api/admin/merchants/:merchantId/steps/:stepName/reject` to reject the submitted step as a whole.

#### Request payload

```json
{
  "reason": "Company name does not match the submitted document.",
  "note": "Ask merchant to correct the company information."
}
```

#### Successful response

```json
{
  "message": "Step item rejected successfully",
  "stepName": "companyinformation",
  "itemName": "companyName",
  "review": {},
  "allStepItemsApproved": false,
  "finishedApproving": false,
  "overallStatus": "reviewed"
}
```

### `POST /api/admin/merchants/:merchantId/steps/:stepName/reject`

Rejects a single step after checker review. This records the step-level rejection only; it does not change the merchant's overall onboarding status to `rejected`.

#### Request payload

```json
{
  "reason": "KYC document is expired.",
  "note": "Ask the merchant to upload a valid replacement document."
}
```

#### Successful response

```json
{
  "message": "Step rejected successfully",
  "review": {},
  "overallStatus": "reviewed",
  "finishedApproving": false
}
```

#### Common errors

```json
{ "message": "Approver access required" }
```

```json
{ "message": "Invalid step name" }
```

```json
{ "message": "Rejection reason is required" }
```

```json
{ "message": "Merchant must be reviewed before approver step rejection" }
```

### `POST /api/admin/merchants/:merchantId/final-approve`

Final approval for a merchant application.

#### Request payload

```json
{
  "note": "Approved for onboarding."
}
```

#### Successful response

```json
{
  "message": "Merchant approved successfully",
  "merchantId": "merchant_xxxxxxxx",
  "status": "approved",
  "note": "Approved for onboarding.",
  "approvedAt": "2026-05-23T11:00:00.000Z",
  "approvedBy": "approver@example.com"
}
```

#### Common errors

```json
{ "message": "Approver access required" }
```

```json
{ "message": "Merchant must be reviewed before final approval" }
```

```json
{ "message": "All submitted steps must be reviewed and approved before final approval" }
```

### `POST /api/admin/merchants/:merchantId/final-reject`

Final overall rejection for a merchant application. This is separate from step-level rejection and changes the merchant's onboarding status to `rejected`.

#### Request payload

```json
{
  "reason": "Insufficient KYC documentation.",
  "note": "Resubmit once the missing files are added."
}
```

#### Successful response

```json
{
  "message": "Merchant rejected successfully",
  "merchantId": "merchant_xxxxxxxx",
  "status": "rejected",
  "reason": "Insufficient KYC documentation.",
  "note": "Resubmit once the missing files are added.",
  "rejectedAt": "2026-05-23T11:10:00.000Z",
  "rejectedBy": "approver@example.com"
}
```

#### Common errors

```json
{ "message": "Approver access required" }
```

```json
{ "message": "Rejection reason is required" }
```

```json
{ "message": "Merchant must be reviewed before final rejection" }
```

### `PUT /api/admin/merchants/:merchantId/status`

Updates the merchant onboarding status directly.

#### Request payload

```json
{
  "status": "approved",
  "reason": "Reviewed and cleared."
}
```

#### Successful response

```json
{
  "message": "Merchant status updated to approved",
  "merchantId": "merchant_xxxxxxxx",
  "status": "approved",
  "reason": "Reviewed and cleared."
}
```

#### Common errors

```json
{ "message": "Approver access required" }
```

```json
{ "message": "Invalid status" }
```

```json
{ "message": "Merchant not found" }
```

### `PUT /api/admin/reject-merchant/:merchantId`

Rejects a merchant with a reason.

#### Request payload

```json
{
  "reason": "Compliance mismatch",
  "notes": "Cannot proceed until documents are corrected."
}
```

#### Successful response

```json
{
  "message": "Merchant rejected successfully",
  "merchantId": "merchant_xxxxxxxx",
  "status": "rejected",
  "reason": "Compliance mismatch",
  "notes": "Cannot proceed until documents are corrected.",
  "rejectedAt": "2026-05-23T11:10:00.000Z",
  "rejectedBy": "approver@example.com"
}
```

#### Common errors

```json
{ "message": "Approver access required" }
```

```json
{ "message": "Rejection reason is required" }
```

### `PUT /api/admin/merchants/bulk-status`

Updates multiple merchants at once.

#### Request payload

```json
{
  "merchantIds": ["merchant_1", "merchant_2"],
  "status": "approved",
  "reason": "Batch approval after review."
}
```

#### Successful response

```json
{
  "message": "Updated 2 merchants to approved",
  "modifiedCount": 2,
  "status": "approved",
  "reason": "Batch approval after review."
}
```

#### Common errors

```json
{ "message": "Approver access required" }
```

```json
{ "message": "merchantIds array is required" }
```

```json
{ "message": "Invalid status" }
```

```json
{ "message": "All merchants must be reviewed before approval or rejection" }
```

```json
{ "message": "All submitted steps must be reviewed and approved before final approval" }
```

## Approver Notes

- Approvers can approve or reject individual onboarding steps.
- Approvers still make a separate final compliance decision for the whole merchant application.
- Final approval requires every step to be checker-reviewed and approver-approved.
- Approvers can review merchant history, notes, step reviews, and timelines.
- Shared endpoints let approvers see the same merchant data as checkers, but final decision routes are separate.
