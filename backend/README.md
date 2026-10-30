# PropChain Backend Service

## Phase 3: Backend Architecture & PostgreSQL Database Setup

### 1. Architectural Overview
The PropChain backend service is structured using a modular monolithic architecture built with Python 3.11, FastAPI, SQLAlchemy 2.x, psycopg 3, and Alembic:

- **API Layer (`app/api/`):** REST API endpoints versioned under `/api/v1` with centralized routing and OpenAPI schemas.
- **Core Layer (`app/core/`):** Centralized Pydantic Settings configuration, SQLAlchemy database engine with QueuePool pooling, exception handlers, structured rotating logging, and middleware (correlation IDs, execution timers, strict CORS).
- **Models Layer (`app/models/`):** SQLAlchemy 2.x DeclarativeBase foundation with UUID v4 primary keys and timezone-aware UTC timestamps.
- **Schemas Layer (`app/schemas/`):** Pydantic v2 schemas for standardized response envelopes, health probes, errors, and pagination metadata.
- **Dependencies Layer (`app/dependencies/`):** Isolated request session management (`get_db()`) ensuring transactional safety and automatic connection release.
- **Migrations Layer (`migrations/`):** Alembic migration management configured for autogeneration against SQLAlchemy models.
- **Test Suite (`tests/`):** Pytest test suite with unit tests and integration tests with transactional isolation.

---

### 2. Endpoints Implemented in Phase 3
- `GET /`: Root application metadata, version, environment, and documentation links.
- `GET /api/v1/health`: FastAPI operational health status check.
- `GET /api/v1/health/database`: Live PostgreSQL connectivity probe via lightweight query execution (`SELECT 1;`).
- `GET /api/health`: Legacy health check endpoint maintaining backwards compatibility.
- `GET /docs`: Interactive Swagger UI.
- `GET /redoc`: Interactive ReDoc documentation.

---

### 3. Running Locally

#### Virtual Environment Activation & Server Run
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Running Tests
```powershell
cd backend
.\.venv\Scripts\pytest.exe
```

#### Running Alembic Migrations
```powershell
cd backend
.\.venv\Scripts\alembic.exe upgrade head
```

