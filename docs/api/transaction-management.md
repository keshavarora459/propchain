# Transaction Management & Stakeholder Approvals API Reference

## Base URLs
- `/api/v1/transactions`
- `/api/v1/approvals`

## Endpoints

### 1. Initiate Transaction Proposal
- **Method**: `POST /api/v1/transactions`
- **Auth**: `BUYER` role (`INITIATE_TRANSACTION` permission).
- **Body**:
  ```json
  {
    "property_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "proposed_amount": 25000000.00,
    "currency": "INR",
    "transaction_type": "SALE",
    "description": "Offer on property"
  }
  ```
- **Initial Status**: `PENDING_SELLER_ACCEPTANCE`.

### 2. Seller Acceptance / Rejection
- **Accept**: `POST /api/v1/transactions/{id}/accept` (moves status to `PENDING_DOCUMENT_VERIFICATION`).
- **Reject**: `POST /api/v1/transactions/{id}/reject` (moves status to `REJECTED`).
- **Auth**: Authorized seller only (or Admin).

### 3. Verifier Document Review
- **Method**: `POST /api/v1/transactions/{id}/verify-documents`
- **Auth**: `VERIFIER` or `ADMIN`.
- **Status Change**: Moves to `READY_FOR_LEGAL_CONFIRMATION`.

### 4. Legal Registration Confirmation
- **Method**: `POST /api/v1/transactions/{id}/legal-confirm`
- **Auth**: `LEGAL_AUTHORITY` role ONLY. (Admin is strictly forbidden).
- **Body**:
  ```json
  {
    "registration_reference": "DL-REG-2026-9901",
    "registry_jurisdiction": "Central Delhi Sub-Registrar",
    "registration_date": "2026-10-30",
    "evidence_reference": "Book-1/Vol-220/Page-45",
    "comments": "Statutory deed execution confirmed."
  }
  ```
- **Execution**: Automatically initiates on-chain ownership conveyance via `OwnershipRegistry.sol` and transitions status to `COMPLETED`.

### 5. Stakeholder Approvals Inbox
- **Method**: `GET /api/v1/approvals/pending`
- **Auth**: Authenticated stakeholder (`PROPERTY_OWNER`, `VERIFIER`, `LEGAL_AUTHORITY`, or `ADMIN`).
- **Response**: List of pending approval gates assigned to user's role.

