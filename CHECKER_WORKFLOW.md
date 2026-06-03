# Checker Workflow

This document describes the end-to-end checker workflow.

## Goal

The checker reviews merchant submissions, checks every onboarding document and field, adds review notes, and marks the application as `reviewed`. The checker does not approve or reject steps or the overall merchant application.

## Core Checker Data

- `User`
  - `name`
  - `email`
  - `passwordHash`
  - `role = "checker"`
  - `platformId`
  - `profilePic`
- Optional `StaffProfile`
  - `userId`
  - `platformId`
  - `role = "checker"`
  - `isActive`

## End-to-End Flow

1. Platform creates or registers a checker user.
2. Backend stores the checker in `User` with `role = "checker"`.
3. Checker logs in with email and password.
4. JWT includes role information for authorization.
5. Checker lands on the checker dashboard.
6. Dashboard shows merchant applications in `pending` or `submitted` state.
7. Checker opens one merchant application.
8. Checker reviews company information.
9. Checker reviews UBO details.
10. Checker reviews payment and settlement information.
11. Checker reviews risk information.
12. Checker reviews KYC documents.
13. Checker can add step-level or field-level notes and attachments.
14. Checker marks the case as `reviewed` when the submission is complete.
15. The case becomes available to the approver.

## Checker Permissions

- View merchants in the same `platformId`
- Read and review all merchant onboarding data
- Review each onboarding step
- Add step-level and field-level review notes
- Upload review attachments
- Mark an application as `reviewed`

## Checker Cannot

- Approve or reject individual onboarding steps
- Approve the overall merchant application
- Reject the overall merchant application
- Access another platform's records
- Edit merchant identity data unless explicitly allowed

## Checker API Touchpoints

- `POST /api/user/login`
- `GET /api/admin/dashboard`
- `GET /api/admin/merchants`
- `GET /api/admin/merchants/:merchantId`
- `GET /api/admin/reviews/pending`
- `POST /api/admin/merchants/:merchantId/steps/:stepName/review`
- `POST /api/admin/merchants/:merchantId/notes`
- `GET /api/admin/merchants/:merchantId/notes`
- `POST /api/admin/merchants/:merchantId/review-decision`

## Suggested Status Flow

- Merchant submits application
- Checker sees it in review queue
- Checker sets status to `reviewed`
- Approver receives the reviewed case

## Notes

- Checker is a staff role, not a merchant role.
- Checker review means compliance/document review only; it is not approval.
- Keep checker identity in `User`.
- Keep review decisions separate from merchant onboarding data.
- Use `platformId` to limit visibility to the correct tenant.
