# Approver Workflow

This document describes the end-to-end approver workflow.

## Goal

The approver makes the final compliance decision after checker review.

## Core Approver Data

- `User`
  - `name`
  - `email`
  - `passwordHash`
  - `role = "approver"`
  - `platformId`
  - `profilePic`
- Optional `StaffProfile`
  - `userId`
  - `platformId`
  - `role = "approver"`
  - `isActive`

## End-to-End Flow

1. Platform creates or registers an approver user.
2. Backend stores the approver in `User` with `role = "approver"`.
3. Approver logs in with email and password.
4. JWT includes role and platform information.
5. Approver lands on the approval dashboard.
6. Dashboard shows only cases that have been reviewed.
7. Approver opens a reviewed merchant case.
8. Approver inspects the checker notes and merchant documents.
9. Approver approves or rejects each onboarding step.
10. Approver approves the full application if every step is approved.
11. Or approver rejects the full application if there is an overall compliance issue.
12. Backend stores step-level and final approval or rejection audit fields.
13. Merchant sees the final decision in the dashboard.
14. Optional callback/webhook informs the platform backend.

## Approver Permissions

- View reviewed merchant applications
- Approve or reject individual onboarding steps
- Approve merchant applications
- Reject merchant applications
- Add reason and notes
- Trigger platform callbacks

## Approver Cannot

- Skip checker review unless your business rules allow it
- Edit merchant onboarding records directly
- Access merchants from another platform

## Approver API Touchpoints

- `POST /api/user/login`
- `GET /api/admin/dashboard`
- `GET /api/admin/merchants`
- `GET /api/admin/merchants/:merchantId`
- `POST /api/admin/merchants/:merchantId/steps/:stepName/approve`
- `POST /api/admin/merchants/:merchantId/steps/:stepName/reject`
- `POST /api/admin/merchants/:merchantId/final-approve`
- `POST /api/admin/merchants/:merchantId/final-reject`
- `PUT /api/admin/merchants/:merchantId/status`
- `PUT /api/admin/approve-merchant/:merchantId`
- `PUT /api/admin/reject-merchant/:merchantId`
- `PUT /api/admin/merchants/bulk-status`

## Suggested Status Flow

- `in-progress`
- `pending`
- `reviewed`
- `approved` or `rejected`

## Notes

- Approver handles both step-level decisions and the final overall decision.
- Step rejection does not automatically reject the whole application.
- Final approval requires every step to be approved by the approver.
- Keep approval audit fields on the merchant profile.
- Use `platformId` to isolate approval decisions per tenant.
- Use `profilePic` from the shared `User` record for display only.
