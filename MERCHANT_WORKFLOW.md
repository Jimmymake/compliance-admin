# Merchant Workflow

This document describes the end-to-end merchant journey for the compliance system.

## Goal

The merchant logs in with a normal user account, fills onboarding forms, submits documents, and tracks status until approval or rejection.

## Core Merchant Data

- `User`
  - `name`
  - `email`
  - `passwordHash`
  - `role = "merchant"`
  - `platformId`
  - `merchantId`
  - `profilePic`
- `Merchant`
  - `userId`
  - `merchantId`
  - `platformId`
  - `onboardingStatus`
  - `onboardingSteps`
  - `approvedAt`
  - `approvedBy`
  - `rejectedAt`
  - `rejectedBy`

## End-to-End Flow

1. Merchant signs up with email and password.
2. Backend creates a `User` record with `role = "merchant"` and a generated `merchantId`.
3. Backend creates an empty `Merchant` onboarding record if it does not exist.
4. Merchant logs in with email and password.
5. JWT includes `userId`, `merchantId`, `role`, `platformId`, `name`, `email`, and `profilePic`.
6. Merchant lands on the onboarding dashboard.
7. Merchant fills step 1: company information.
8. Merchant fills step 2: UBO details.
9. Merchant fills step 3: payment and processing details.
10. Merchant fills step 4: settlement bank details.
11. Merchant fills step 5: risk management details.
12. Merchant fills step 6: KYC documents.
13. Each completed step updates `Merchant.onboardingSteps`.
14. Merchant submits the completed onboarding application.
15. Backend verifies all steps are complete and changes the record to `awaiting-review`.
16. Checker reviews the submission.
17. Approver makes the final decision.
18. Merchant sees final status as `approved` or `rejected`.

## Recommended Status Flow

- `in-progress` when the merchant starts
- `awaiting-review` when the merchant has submitted but not yet reviewed
- `reviewed` when checker review is complete
- `approved` when approver accepts the application
- `rejected` when approver rejects the application

## Merchant Screens

- Login page
- Onboarding dashboard
- Company information form
- UBO form
- Payment and processing form
- Settlement bank details form
- Risk management form
- KYC documents upload form
- Status summary page
- Chat panel for merchant support and review comments

## Merchant API Touchpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/overview`
- `GET /api/dashboard/profile`
- `GET /api/dashboard/timeline`
- `POST /api/companyinfor`
- `POST /api/uboinfo`
- `POST /api/paymentinfo`
- `POST /api/settlementbank`
- `POST /api/riskmanagementinfo`
- `POST /api/kycinfo`

## Notes

- Keep merchant identity in `User`.
- Keep onboarding progress in `Merchant`.
- Do not reuse the approval status as a login state.
- Use `platformId` to separate data for different client companies.
