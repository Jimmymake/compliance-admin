# Merchant Endpoints

This document lists only the endpoints intended for the merchant side of the compliance API.
For other roles, see:


It excludes:

- Admin review endpoints
- Checker and approver endpoints
- Platform backend session-generation endpoints
- Internal server-to-server endpoints

## Authentication

These endpoints create and use the merchant JWT session.

## Shared Merchant Object

Whenever an endpoint returns `merchant`, it returns the full Merchant model shape except the internal Mongoose `__v` field.

```json
{
  "_id": "66f1c2a0c2f6a01234567892",
  "platformId": "66f1c2a0c2f6a01234567893",
  "platformReferenceId": "platform-merchant-001",
  "merchantId": "merchant_xxxxxxxx",
  "userId": "66f1c2a0c2f6a01234567890",
  "email": "merchant@example.com",
  "name": "Acme Merchants Ltd",
  "phone": "+254700000000",
  "location": "",
  "profilePic": "",
  "businessCategory": "Limited Liability Company",
  "registeredBusiness": "Yes",
  "onboardingStatus": "in-progress",
  "onboardingSteps": {
    "companyinformation": { "completed": true, "completedAt": "2026-05-23T10:10:00.000Z" },
    "ubo": { "completed": true, "completedAt": "2026-05-23T10:20:00.000Z" },
    "paymentandprosessing": { "completed": false, "completedAt": null },
    "settlmentbankdetails": { "completed": false, "completedAt": null },
    "riskmanagement": { "completed": false, "completedAt": null },
    "kycdocs": { "completed": false, "completedAt": null }
  },
  "approvedAt": null,
  "approvedBy": null,
  "rejectedAt": null,
  "rejectedBy": null,
  "rejectionReason": null,
  "reviewedAt": null,
  "reviewedBy": null,
  "adminNotes": null,
  "adminAttachment": null,
  "createdAt": "2026-05-23T10:00:00.000Z",
  "updatedAt": "2026-05-23T10:30:00.000Z"
}
```

### `POST /api/auth/signup`

Creates a new merchant account.

#### Headers

```http
X-Platform-Session-Token: <PLATFORM_SESSION_TOKEN>
```

#### Request payload

```json
{
  "name": "Acme Merchants Ltd",
  "email": "merchant@example.com",
  "password": "StrongPassword123!",
  "phone": "+254700000000",
  "profilePic": "",
  "businessCategory": "Limited Liability Company",
  "registeredBusiness": "Yes",
  "role": "merchant"
}
```

`businessCategory` is a required string for merchant signup. Example values from the frontend are `Limited Liability Company`, `Public Listed Company`, `Sole Proprietorships`, or `Partnership`.

`registeredBusiness` is a required string for merchant signup. Example values from the frontend are `Yes`, `No`, or `In the process of registering`.

`phone` is required for merchant signup and must be in international format, for example `+254700000000`.

#### Successful response

```json
{
  "message": "Merchant account created successfully. Phone verification is required before onboarding can continue.",
  "user": {
    "userId": "66f1c2a0c2f6a01234567890",
    "merchantId": "merchant_xxxxxxxx",
    "name": "Acme Merchants Ltd",
    "email": "merchant@example.com",
    "phone": "+254700000000",
    "phoneVerified": false,
    "profilePic": "",
    "businessCategory": "Limited Liability Company",
    "registeredBusiness": "Yes",
    "role": "merchant",
    "platformName": "Acme Payments"
  },
  "merchant": { "merchantId": "merchant_xxxxxxxx", "onboardingStatus": "in-progress", "...": "full merchant object" },
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
{ "message": "email and password are required" }
```

```json
{ "message": "A user with this email already exists" }
```

```json
{ "message": "role must be merchant, checker, or approver" }
```

```json
{ "message": "businessCategory and registeredBusiness are required for merchant signup" }
```

```json
{ "message": "phone must be in international format, for example +254700000000" }
```

```json
{ "message": "Too many signup SMS attempts. Please try again later.", "retryAfterSeconds": 900 }
```

### `POST /api/auth/verify-phone`

Verifies the authenticated merchant's phone number using the 6-digit SMS code sent during signup or resend.

The account can log in before verification, but protected API routes return `403` until this endpoint succeeds. This rule applies to all user roles.

#### Headers

```http
Authorization: Bearer <sessionToken>
```

#### Request payload

```json
{
  "code": "123456"
}
```

#### Successful response

```json
{
  "message": "Phone number verified successfully",
  "verificationRequired": false,
  "phoneVerified": true
}
```

For merchants, this also creates the welcome notification and sends it through the enabled notification channels, including SMS when `SMS_NOTIFICATIONS_ENABLED=true`.

#### Common errors

```json
{ "message": "A valid 6-digit verification code is required", "verificationRequired": true, "phoneVerified": false }
```

```json
{ "message": "Invalid verification code", "verificationRequired": true, "phoneVerified": false }
```

```json
{ "message": "Verification code has expired. Please request a new code.", "verificationRequired": true, "phoneVerified": false }
```

```json
{ "message": "Too many phone verification attempts. Please try again later.", "retryAfterSeconds": 900 }
```

### `POST /api/auth/resend-phone-code`

Sends a new SMS verification code to the authenticated merchant's saved phone number.

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
{ "message": "Please wait 60 seconds before requesting another code", "verificationRequired": true, "phoneVerified": false }
```

```json
{ "message": "Too many phone verification code requests. Please try again later.", "retryAfterSeconds": 900 }
```

### `POST /api/auth/change-phone`

Changes the authenticated user's phone number, resets `phoneVerified` to `false`, sends a new SMS verification code, and blocks protected routes until the new number is verified.

For merchants, the phone number is also mirrored to the Merchant record.

#### Headers

```http
Authorization: Bearer <sessionToken>
```

#### Request payload

```json
{
  "phone": "+254700000000"
}
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

Logs in a merchant and returns a session token.

#### Headers

```http
X-Platform-Session-Token: <PLATFORM_SESSION_TOKEN>
```

#### Request payload

```json
{
  "email": "merchant@example.com",
  "password": "StrongPassword123!"
}
```

#### Successful response

```json
{
  "message": "Login successful",
  "user": {
    "userId": "66f1c2a0c2f6a01234567890",
    "merchantId": "merchant_xxxxxxxx",
    "name": "Acme Merchants Ltd",
    "email": "merchant@example.com",
    "phone": "+254700000000",
    "phoneVerified": false,
    "profilePic": "",
    "businessCategory": "Limited Liability Company",
    "registeredBusiness": "Yes",
    "role": "merchant",
    "platformId": null,
    "platformName": "Acme Payments"
  },
  "merchant": { "merchantId": "merchant_xxxxxxxx", "onboardingStatus": "in-progress", "...": "full merchant object" },
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

Before `phoneVerified` is true, the user can only log in, call `GET /api/auth/me`, verify the phone code, or request another code. Protected API routes return:

```json
{
  "message": "Phone number verification is required before this account can continue",
  "verificationRequired": true,
  "phoneVerified": false,
  "phone": "+254700000000"
}
```

### `GET /api/auth/me`

Returns the current authenticated user and merchant record.

#### Headers

```http
Authorization: Bearer <sessionToken>
```

#### Successful response

```json
{
  "user": {
    "_id": "66f1c2a0c2f6a01234567890",
    "name": "Acme Merchants Ltd",
    "email": "merchant@example.com",
    "merchantId": "merchant_xxxxxxxx",
    "role": "merchant"
  },
  "merchant": { "merchantId": "merchant_xxxxxxxx", "onboardingStatus": "in-progress", "...": "full merchant object" }
}
```

#### Common errors

```json
{ "message": "Access token required" }
```

```json
{ "message": "Token expired" }
```

```json
{ "message": "Invalid token" }
```

## Merchant Dashboard

These endpoints are merchant-only and require a valid merchant JWT.

### `GET /api/dashboard/overview`

Returns onboarding progress and the next required action.

#### Headers

```http
Authorization: Bearer <sessionToken>
```

#### Successful response

```json
{
  "merchant": {
    "merchantId": "merchant_xxxxxxxx",
    "onboardingStatus": "in-progress",
    "...": "full merchant object"
  },
  "progress": {
    "completed": 2,
    "total": 6,
    "percentage": 33
  },
  "steps": {
    "companyinformation": { "completed": true, "hasData": true, "lastUpdated": "2026-05-23T10:10:00.000Z", "data": { "companyName": "Acme Merchants Ltd" } },
    "ubo": { "completed": true, "hasData": true, "lastUpdated": "2026-05-23T10:20:00.000Z", "data": { "ubo": [] } },
    "paymentandprosessing": { "completed": false, "hasData": false, "lastUpdated": null, "data": null },
    "settlmentbankdetails": { "completed": false, "hasData": false, "lastUpdated": null, "data": null },
    "riskmanagement": { "completed": false, "hasData": false, "lastUpdated": null, "data": null },
    "kycdocs": { "completed": false, "hasData": false, "lastUpdated": null, "data": null }
  },
  "nextAction": {
    "step": "paymentandprosessing",
    "message": "Complete paymentandprosessing to continue"
  },
  "status": {
    "current": "in-progress",
    "message": "Your onboarding is in progress."
  }
}
```

#### Common errors

```json
{ "message": "Merchant not found" }
```

```json
{ "message": "Access token required" }
```

### `GET /api/dashboard/step/:stepName`

Returns data for a single onboarding step.

#### Path parameter

- `stepName`: `companyinformation`, `ubo`, `paymentandprosessing`, `settlmentbankdetails`, `riskmanagement`, or `kycdocs`

#### Successful response

```json
{
  "step": "companyinformation",
  "data": {
    "companyName": "Acme Merchants Ltd",
    "companyEmail": "info@acme.com",
    "completed": true
  },
  "completed": true,
  "lastUpdated": "2026-05-23T10:10:00.000Z"
}
```

#### Common errors

```json
{ "message": "Invalid step name" }
```

```json
{ "message": "Merchant not found" }
```

### `GET /api/dashboard/profile`

Returns the merchant profile summary.

#### Successful response

```json
{
  "merchant": {
    "merchantId": "merchant_xxxxxxxx",
    "onboardingStatus": "in-progress",
    "...": "full merchant object"
  }
}
```

#### Common errors

```json
{ "message": "Merchant not found" }
```

### `GET /api/dashboard/timeline`

Returns the merchant-facing timeline of onboarding events.

#### Successful response

```json
{
  "timeline": [
    {
      "step": "registration",
      "title": "Account Created",
      "description": "Your merchant account was created",
      "completed": true,
      "date": "2026-05-23T10:00:00.000Z",
      "status": "completed"
    }
  ],
  "currentStatus": "in-progress",
  "progress": {
    "completed": 1,
    "total": 1
  }
}
```

#### Common errors

```json
{ "message": "Merchant not found" }
```

## Merchant Profile and Form Status

These endpoints return the merchant's current profile, form state, and uploaded documents.

### `GET /api/user/profile`

Returns the merchant profile plus onboarding data.

#### Successful response

```json
{
  "success": true,
  "merchant": {
    "merchantId": "merchant_xxxxxxxx",
    "onboardingStatus": "in-progress",
    "...": "full merchant object"
  },
  "progress": {
    "completed": 2,
    "total": 6,
    "percentage": 33
  },
  "forms": {
    "companyinformation": {},
    "ubo": {},
    "paymentandprosessing": {},
    "settlmentbankdetails": {},
    "riskmanagement": {},
    "kycdocs": {}
  },
  "notes": [],
  "uploadedFiles": [],
  "onboardingSteps": {}
}
```

#### Common errors

```json
{ "message": "Merchant not found" }
```

### `GET /api/user/form-status`

Returns completion state for each onboarding section.

#### Successful response

```json
{
  "success": true,
  "merchantId": "merchant_xxxxxxxx",
  "overallStatus": "in-progress",
  "progress": {
    "completed": 2,
    "total": 6,
    "percentage": 33
  },
  "forms": {
    "companyinformation": { "completed": true, "hasData": true, "lastUpdated": "2026-05-23T10:10:00.000Z", "stepId": 1, "data": { "companyName": "Acme Merchants Ltd" } },
    "ubo": { "completed": true, "hasData": true, "lastUpdated": "2026-05-23T10:20:00.000Z", "stepId": 2, "data": { "ubo": [] } },
    "paymentandprosessing": { "completed": false, "hasData": false, "lastUpdated": null, "stepId": 3, "data": null }
  },
  "nextIncompleteForm": "paymentandprosessing",
  "allFormsCompleted": false,
  "notes": [],
  "uploadedFiles": [],
  "lastUpdated": "2026-05-23T10:30:00.000Z"
}
```

#### Common errors

```json
{ "message": "Merchant not found" }
```

## Merchant Onboarding

These endpoints are for the merchant's onboarding journey.

### `GET /api/onboarding/status/:merchantId`

Returns the onboarding state for a merchant.

#### Successful response

```json
{
  "merchantId": "merchant_xxxxxxxx",
  "overallStatus": "in-progress",
  "progress": {
    "completed": 2,
    "total": 6,
    "percentage": 33
  },
  "steps": {
    "companyinformation": { "completed": true, "data": {} },
    "ubo": { "completed": true, "data": {} }
  },
  "merchant": {
    "merchantId": "merchant_xxxxxxxx",
    "onboardingStatus": "in-progress",
    "...": "full merchant object"
  }
}
```

#### Common errors

```json
{ "message": "Access denied" }
```

```json
{ "message": "Merchant not found" }
```

### `PUT /api/onboarding/step/:merchantId/:stepName/complete`

Marks a step as completed or incomplete.

#### Request payload

```json
{
  "completed": true
}
```

#### Successful response

```json
{
  "message": "Step companyinformation updated",
  "completed": true,
  "allStepsCompleted": false,
  "overallStatus": "in-progress"
}
```

#### Common errors

```json
{ "message": "Access denied" }
```

```json
{ "message": "Merchant not found" }
```

```json
{ "message": "Unknown step: invalidStep" }
```

### `POST /api/onboarding/submit/:merchantId`

Submits the completed onboarding application for checker review. This endpoint checks that every onboarding step is marked completed before changing the overall status to `awaiting-review`.

#### Successful response

```json
{
  "message": "Onboarding submitted successfully",
  "merchantId": "merchant_xxxxxxxx",
  "overallStatus": "awaiting-review",
  "submittedAt": "2026-05-23T10:45:00.000Z"
}
```

#### Common errors

```json
{ "message": "Merchant access required" }
```

```json
{ "message": "Merchant not found" }
```

```json
{
  "message": "All onboarding steps must be completed before submission",
  "missingSteps": ["kycdocs"]
}
```

### `GET /api/onboarding/next-step/:merchantId`

Returns the next incomplete onboarding step.

#### Successful response

```json
{
  "nextStep": "paymentandprosessing",
  "allStepsCompleted": false,
  "currentStatus": "in-progress"
}
```

#### Common errors

```json
{ "message": "Access denied" }
```

```json
{ "message": "Merchant not found" }
```

## Merchant Form Aggregation

These aliases return the merchant's onboarding forms in a single response.

### `GET /api/my-forms`

### `GET /api/my-forms/my-forms`

### `GET /api/my-forms/my-form`

#### Successful response

```json
{
  "success": true,
  "merchantId": "merchant_xxxxxxxx",
  "overallStatus": "in-progress",
  "progress": {
    "completed": 2,
    "total": 6,
    "percentage": 33
  },
  "uploadedFiles": [],
  "forms": [
    {
      "id": "companyinformation",
      "label": "Company Information",
      "stepId": 1,
      "completed": true,
      "hasData": true,
      "status": "completed"
    }
  ]
}
```

#### Common errors

```json
{ "message": "Merchant not found" }
```

## Merchant File Uploads

These endpoints let the merchant upload, list, view, and delete documents linked to their own merchant record.

### `POST /api/upload/:merchantid/:stepName`

Uploads one file for a step.

#### Headers

```http
Authorization: Bearer <sessionToken>
Content-Type: multipart/form-data
```

#### Form data

- `file`: the uploaded file

#### Successful response

```json
{
  "message": "File uploaded successfully",
  "file": {
    "originalName": "certificate.pdf",
    "filename": "certificate-1716450000000-123456789.pdf",
    "path": "/uploads/merchant_xxxxxxxx/companyinformation/certificate.pdf",
    "size": 123456,
    "mimetype": "application/pdf",
    "uploadedAt": "2026-05-23T10:40:00.000Z",
    "stepName": "companyinformation",
    "merchantid": "merchant_xxxxxxxx",
    "uploadedFileId": "66f1c2a0c2f6a01234567890"
  },
  "url": "/uploads/merchant_xxxxxxxx/companyinformation/certificate.pdf"
}
```

#### Common errors

```json
{ "message": "No file uploaded" }
```

```json
{ "message": "Access denied: You can only access your own data" }
```

### `POST /api/upload/:merchantid/:stepName/multiple`

Uploads multiple files for one step.

#### Form data

- `files`: one or more files

#### Successful response

```json
{
  "message": "2 files uploaded successfully",
  "files": [
    {
      "originalName": "file1.pdf",
      "filename": "file1-1716450000000-111111111.pdf"
    },
    {
      "originalName": "file2.pdf",
      "filename": "file2-1716450000000-222222222.pdf"
    }
  ],
  "urls": [
    "/uploads/merchant_xxxxxxxx/companyinformation/file1.pdf",
    "/uploads/merchant_xxxxxxxx/companyinformation/file2.pdf"
  ]
}
```

#### Common errors

```json
{ "message": "No files uploaded" }
```

### `GET /api/upload/:merchantid/:stepName`

Lists files already stored on disk for a step.

#### Successful response

```json
{
  "files": [
    {
      "filename": "certificate.pdf",
      "size": 123456,
      "uploadedAt": "2026-05-23T10:40:00.000Z",
      "url": "/uploads/merchant_xxxxxxxx/companyinformation/certificate.pdf"
    }
  ]
}
```

#### Common errors

```json
{ "message": "Server error", "error": "..." }
```

### `GET /api/upload/:merchantid/:stepName/records`

Returns upload metadata from the database.

#### Successful response

```json
{
  "files": [],
  "fileMap": {}
}
```

### `DELETE /api/upload/:merchantid/:stepName/:filename`

Deletes a specific uploaded file.

#### Successful response

```json
{ "message": "File deleted successfully" }
```

#### Common errors

```json
{ "message": "File not found" }
```

### `GET /api/upload/serve/:merchantid/:stepName/:filename`

Serves the raw file contents.

#### Common errors

```json
{ "message": "File not found" }
```

### `POST /api/upload/store/:merchantid/:stepName/:fieldName`

Uploads a single file and stores the metadata in the database.

#### Form data

- `file`: the uploaded file

#### Successful response

```json
{
  "message": "File uploaded successfully",
  "file": {
    "_id": "66f1c2a0c2f6a01234567890",
    "filename": "certificate-1716450000000-123456789.pdf"
  },
  "url": "/uploads/merchant_xxxxxxxx/companyinformation/certificate.pdf"
}
```

### `POST /api/upload/store-many/:merchantid/:stepName/:fieldName`

Uploads multiple files and stores metadata in the database.

#### Form data

- `files`: one or more files

#### Successful response

```json
{
  "message": "Files uploaded successfully",
  "files": [
    {
      "_id": "66f1c2a0c2f6a01234567890",
      "filename": "file1-1716450000000-111111111.pdf"
    }
  ],
  "urls": [
    "/uploads/merchant_xxxxxxxx/companyinformation/file1.pdf"
  ]
}
```

### `POST /api/upload/profile-pic`

Uploads and updates the merchant profile picture.

#### Form data

- `file`: the uploaded image

#### Successful response

```json
{
  "message": "Profile picture uploaded successfully",
  "url": "/uploads/profile-pics/66f1c2a0c2f6a01234567890/profile-1716450000000-123456789.png",
  "uploadedFile": {},
  "user": {
    "userId": "66f1c2a0c2f6a01234567890",
    "profilePic": "/uploads/profile-pics/66f1c2a0c2f6a01234567890/profile-1716450000000-123456789.png"
  },
  "merchant": {
    "merchantId": "merchant_xxxxxxxx",
    "profilePic": "/uploads/profile-pics/66f1c2a0c2f6a01234567890/profile-1716450000000-123456789.png",
    "...": "full merchant object"
  }
}
```

#### Common errors

```json
{ "message": "No file uploaded" }
```

```json
{ "message": "Token does not contain a userId" }
```

```json
{ "message": "User not found" }
```

## Step Payload Examples

These are the main request body examples for the merchant onboarding forms.

### `POST /api/companyinfor`

```json
{
  "companyName": "Acme Merchants Ltd",
  "companyEmail": "info@acme.com",
  "dateOfIncorporation": "2024-01-10",
  "incorporationNumber": "REG-123456",
  "countryOfIncorporation": "Kenya",
  "contactPerson": {
    "fullName": "Jane Doe",
    "phone": "+254700000000",
    "email": "jane@acme.com"
  },
  "businessDescription": "Online retail and payments",
  "sourceOfFunds": "Revenue from sales",
  "purpose": "Payment processing",
  "licensingRequired": false,
  "bankname": "ABC Bank",
  "swiftcode": "ABCDKE12",
  "targetCountries": [
    { "region": "Africa", "percent": 60 }
  ],
  "topCountries": ["Kenya", "Uganda"],
  "previouslyUsedGateways": "None"
}
```

#### Successful response

```json
{
  "message": "Company information created successfully",
  "company": {},
  "onboardingUpdated": true
}
```

#### Common errors

```json
{ "message": "Company name is required" }
```

```json
{ "message": "Company information already exists for this merchant" }
```

### `PUT /api/companyinfor`

Uses the same payload as create, but updates the current merchant record.

#### Successful response

```json
{
  "message": "Company information updated successfully",
  "company": {}
}
```

### `POST /api/uboinfo`

```json
{
  "ubo": [
    {
      "fullname": "John Smith",
      "idpassportnumber": "A1234567",
      "dateofbirth": "1985-04-12",
      "nationality": "Kenyan",
      "residentialaddress": "Nairobi, Kenya",
      "percentageofownership": "50",
      "sourceoffunds": "Salary",
      "pep": false,
      "pepdetails": ""
    }
  ]
}
```

#### Successful response

```json
{
  "message": "UBO information created successfully",
  "ubo": {},
  "onboardingUpdated": true
}
```

#### Common errors

```json
{ "message": "UBO information already exists for this merchant" }
```

### `PUT /api/uboinfo`

Uses the same payload as create, but updates the current merchant record.

#### Successful response

```json
{
  "message": "UBO information updated successfully",
  "ubo": {}
}
```

### `POST /api/paymentinfo`

```json
{
  "requredcurrency": {
    "KES": true,
    "USD": true,
    "GBP": false,
    "other": ""
  },
  "exmonthlytransaction": {
    "amountinusd": 50000,
    "numberoftran": 1200
  },
  "avgtranssize": 42,
  "paymentmethodtobesupported": {
    "credit": true,
    "mobilemoney": true,
    "other": "Bank transfer"
  },
  "chargebackrefundrate": "2%"
}
```

#### Successful response

```json
{
  "message": "Payment information created successfully",
  "payment": {},
  "onboardingUpdated": true
}
```

#### Common errors

```json
{ "message": "Payment information already exists for this merchant" }
```

### `PUT /api/paymentinfo`

Uses the same payload as create, but updates the current merchant record.

#### Successful response

```json
{
  "message": "Payment information updated successfully",
  "payment": {}
}
```

### `POST /api/settlementbank`

```json
{
  "settlementbankdetail": [
    {
      "nameofbank": "ABC Bank",
      "swiftcode": "ABCDKE12",
      "jurisdiction": "Kenya",
      "settlementcurrency": "KES"
    }
  ]
}
```

#### Successful response

```json
{
  "message": "Settlement bank details created successfully",
  "settlement": {},
  "onboardingUpdated": true
}
```

#### Common errors

```json
{ "message": "Settlement bank details already exist for this merchant" }
```

### `PUT /api/settlementbank`

Uses the same payload as create, but updates the current merchant record.

#### Successful response

```json
{
  "message": "Settlement bank details updated successfully",
  "settlement": {}
}
```

### `POST /api/riskmanagementinfo`

```json
{
  "amlpolicy": true,
  "attachedfile": "aml-policy.pdf",
  "officerdetails": {
    "fullname": "Jane Doe",
    "telephonenumber": "+254700000000",
    "email": "jane@acme.com"
  },
  "historyofregulatoryfine": false,
  "reason": "",
  "hereaboutus": "Referral",
  "indroducer": {
    "name": "Referral Partner",
    "position": "Account Manager",
    "date": "2026-05-23"
  }
}
```

#### Successful response

```json
{
  "message": "Risk management information created successfully",
  "risk": {},
  "onboardingUpdated": true
}
```

#### Common errors

```json
{ "message": "Risk management information already exists for this merchant" }
```

### `PUT /api/riskmanagementinfo`

Uses the same payload as create, but updates the current merchant record.

#### Successful response

```json
{
  "message": "Risk management information updated successfully",
  "risk": {}
}
```

### `POST /api/kycinfo`

```json
{
  "certincorporation": ["certificate.pdf"],
  "cr2forpatnership": [],
  "cr2forshareholders": [],
  "kracert": ["kra-certificate.pdf"],
  "bankstatement": ["bank-statement.pdf"],
  "passportids": ["passport-ids.pdf"],
  "shareholderpassportid": [],
  "websiteipadress": ["https://acme.com"],
  "proofofDomain": ["domain-proof.pdf"],
  "proofofadress": ["address-proof.pdf"],
  "pepform": ["pep-form.pdf"],
  "bof1": ["bof1.pdf"]
}
```

#### Successful response

```json
{
  "message": "KYC documents created successfully",
  "kyc": {},
  "onboardingUpdated": true
}
```

#### Common errors

```json
{ "message": "KYC documents already exist for this merchant" }
```

### `PUT /api/kycinfo`

Uses the same payload as create, but updates the current merchant record.

#### Successful response

```json
{
  "message": "KYC documents updated successfully",
  "kyc": {}
}
```

## Merchant Chat

These endpoints let the merchant load the same conversation after login and see previous messages from checkers or approvers. Merchant access is tied to the authenticated JWT, so a merchant can only load or send messages for their own `merchantId`.

### `GET /api/conversations/merchant/:merchantId`

Creates or reuses the merchant conversation and returns all previous messages sorted oldest to newest. The backend uses the authenticated merchant's own `merchantId`.

### `POST /api/conversations`

Creates or reuses the merchant conversation and returns previous messages. Merchant request payload can be empty.

### `POST /api/messages`

Sends a message in the merchant conversation.

```json
{
  "messageType": "text",
  "text": "I have uploaded the requested document. 👍",
  "replyToMessageId": "66f1c2a0c2f6a01234567890"
}
```

`replyToMessageId` is optional. When present, the backend stores a `replyTo` snapshot on the new message so the frontend can show a reply preview above the message.

Emoji are sent as normal Unicode inside `text`. Messages can also include uploaded `attachments` using multipart form data. Chat accepts any attachment MIME type, but each file must be `10MB` or smaller.

Files and images are uploaded through this REST endpoint, not through Socket.IO. After the backend stores the uploaded file and message, Socket.IO emits `chat:message` with the saved message plus attachment metadata/URLs.

### `GET /api/messages/conversation/:conversationId`

Returns all previous messages sorted oldest to newest.

### `PUT /api/messages/:messageId/read`

Marks a message as read for the merchant.

## Merchant Notifications

Merchant notifications are stored in MongoDB and scoped to the authenticated merchant. Each stored notification also sends an SMS to the recipient's saved phone number when `SMS_NOTIFICATIONS_ENABLED=true`.
The backend creates them automatically during the onboarding lifecycle:

- `merchant-phone-verified`: merchant verifies phone number; welcome/thank-you notification
- `onboarding-submitted`: merchant submits completed onboarding for review
- `checker-review-completed`: checker review is complete and the case is waiting for final approval
- `merchant-approved`: approver gives final approval
- `merchant-rejected`: approver gives final rejection

### `GET /api/notifications`

Returns stored notifications for the merchant.

Query params:

- `limit`: optional, max `100`, defaults to `50`
- `unreadOnly`: optional, set to `true` to return unread notifications only

### `PUT /api/notifications/:notificationId/read`

Marks one notification as read.

### `PUT /api/notifications/read-all`

Marks all merchant notifications as read.

### Socket.IO events

- `chat:message`: emitted when a checker or approver sends a message in the merchant conversation. For files/images, the event contains attachment metadata and URLs, not raw file binary data.
- `notification:new`: emitted when a new stored notification is created for the merchant. The same notification is also sent through the SMS provider when enabled.

## Status Flow Used By Merchant-Side Routes

- `in-progress`
- `awaiting-review`
- `reviewed`
- `approved`
- `rejected`

## Merchant Access Rules

- Merchant endpoints require a valid JWT from `/api/auth/login` or `/api/auth/signup`.
- Merchant access is tied to `merchantId`.
- Merchants can only access their own data unless a route explicitly supports a broader read-only summary.
- Admin, checker, and approver routes are intentionally omitted from this document.

## Quick Merchant Surface Map

- Authentication: `/api/auth/*`
- Dashboard: `/api/dashboard/*`
- Merchant profile: `/api/user/*`
- Onboarding: `/api/onboarding/*`
- Forms summary: `/api/my-forms/*`
- Uploads: `/api/upload/*`
- Chat: `/api/conversations/*`, `/api/messages/*`
- Notifications: `/api/notifications/*`
