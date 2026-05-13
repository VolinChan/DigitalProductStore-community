# Digital Store Backend

A digital product e-commerce system backend built with Go.

## Tech Stack

- **Language**: Go 1.21+
- **Web Framework**: Gin
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **ORM**: GORM
- **Authentication**: JWT
- **Payment Gateway**: Stripe / PayPal SDK
- **Email Service**: SMTP / SendGrid / AWS SES
- **File Storage**: Local / AWS S3 / MinIO
- **API Documentation**: Swagger / OpenAPI 3.0

## Project Structure

```
backend/
├── cmd/
│   └── api/              # Application entry point
│       └── main.go
├── internal/
│   ├── config/           # Configuration management
│   ├── handlers/         # HTTP handlers (controllers)
│   ├── middleware/       # HTTP middleware
│   ├── models/           # Data models
│   ├── repositories/     # Data access layer
│   └── services/         # Business logic layer
├── pkg/
│   ├── logger/           # Logging utilities
│   ├── response/         # Response utilities
│   └── utils/            # Common utilities
├── api/
│   └── openapi/          # OpenAPI/Swagger documentation
├── scripts/              # Development scripts
├── go.mod
├── go.sum
├── Makefile
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- Go 1.21+
- PostgreSQL 14+
- Redis 7+
- Docker (optional)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies
```bash
make deps
```

3. Copy environment file
```bash
cp .env.example .env
```

4. Update `.env` with your configuration

### Running with Docker

```bash
# Start all services
make docker-up

# Stop all services
make docker-down
```

### Running Locally

1. Start PostgreSQL and Redis
```bash
docker-compose up -d postgres redis
```

2. Run the application
```bash
make run
```

### Development Mode (with hot reload)

```bash
make dev
```

## API Documentation

After starting the server, access Swagger UI at:
- http://localhost:8080/swagger/index.html

Generate Swagger documentation:
```bash
make swag
```

## Database Migrations

```bash
# Run migrations
make migrate-up

# Rollback migrations
make migrate-down

# Create a new migration
make migrate-create NAME=create_users_table
```

## Testing

```bash
# Run all tests
make test

# Run tests with coverage
make test-coverage
```

## Code Quality

```bash
# Format code
make fmt

# Run linter
make lint
```

## Building

```bash
# Build binary
make build

# Build Docker image
make docker-build
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /api/v1/products | List products |
| GET | /api/v1/products/:id | Get product details |
| GET | /api/v1/categories | List categories |
| GET | /api/v1/products/search | Search products |
| POST | /api/v1/auth/register | User registration |
| POST | /api/v1/auth/login | User login |
| POST | /api/v1/cart/items | Add to cart |
| GET | /api/v1/cart | Get cart |

### Protected Endpoints (Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/orders | List user orders |
| POST | /api/v1/orders | Create order |
| GET | /api/v1/orders/:id | Get order details |
| POST | /api/v1/orders/:id/cancel | Cancel order |

### Admin Endpoints (Admin Role Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/admin/products | List all products |
| POST | /api/v1/admin/products | Create product |
| PUT | /api/v1/admin/products/:id | Update product |
| DELETE | /api/v1/admin/products/:id | Delete product |
| GET | /api/v1/admin/orders | List all orders |
| GET | /api/v1/admin/users | List all users |

## Environment Variables

See `.env.example` for all available configuration options.

## License

MIT License
