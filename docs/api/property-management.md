# Property Management API Reference

## Base URL
`/api/v1/properties`

## Endpoints

### 1. Register Property
- **Method**: `POST /api/v1/properties`
- **Auth**: Bearer JWT (`REGISTER_PROPERTY` permission required; `PROPERTY_OWNER` or `ADMIN`).
- **Body**:
  ```json
  {
    "title": "Greenfield Palm Heights",
    "description": "Luxury residential apartment complex",
    "property_type": "RESIDENTIAL",
    "property_category": "APARTMENT",
    "country": "India",
    "state": "Maharashtra",
    "city": "Mumbai",
    "street_address": "Plot 42, Link Road",
    "postal_code": "400053",
    "land_area": 2500.50,
    "built_up_area": 2200.00,
    "area_unit": "SQ_FT",
    "valuation": 15000000.00,
    "survey_number": "SURV-1029",
    "registration_number": "REG-MH-2026-90"
  }
  ```
- **Response**: `201 Created` with `PropertyResponse`.

### 2. List & Search Properties
- **Method**: `GET /api/v1/properties`
- **Query Params**: `page`, `page_size`, `search`, `property_type`, `status`, `verification_status`, `state`, `city`.
- **Response**: `200 OK` with `PropertyListResponse`.

### 3. Get My Properties
- **Method**: `GET /api/v1/properties/my`
- **Response**: `200 OK` with `PropertyListResponse` containing current user's owned/created properties.

### 4. Get Property By ID
- **Method**: `GET /api/v1/properties/{property_id}`
- **Response**: `200 OK` with full property detail.

### 5. Update Property
- **Method**: `PATCH /api/v1/properties/{property_id}`
- **Auth**: Owner or Admin only.

### 6. Update Status
- **Method**: `PATCH /api/v1/properties/{property_id}/status`
- **Auth**: Verifier or Admin for `verification_status`; Owner or Admin for `status`.

