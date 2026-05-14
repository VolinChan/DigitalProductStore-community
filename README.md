# Digital Store

A modern full-stack e-commerce platform for digital products, featuring a decoupled frontend/backend architecture with guest checkout, multiple payment methods, SKU variant management, and analytics.

![Go](https://img.shields.io/badge/Go-1.25-00ADD8?style=flat-square&logo=go)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-336791?style=flat-square&logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)

**[中文文档](README_zh.md)**

## ✨ Features

### Customer Features
- 🛒 **Shopping Cart** - Works for guests and logged-in users, auto-merges on login
- 📦 **Order Management** - Complete order workflow with tracking
- 💳 **Multiple Payments** - Online payment (Stripe) and bank transfer
- 🔍 **Product Search** - Search by category and keywords
- 📱 **Responsive Design** - Desktop, tablet, and mobile friendly

### Admin Features
- 📊 **Analytics** - Sales reports, top products, conversion analysis
- 🏷️ **SKU Management** - Multi-attribute variants (color, capacity, size, etc.)
- 📦 **Inventory Management** - Low stock alerts, change logs
- 🎨 **Content Management** - Banners and announcements
- 👥 **User Management** - Role-based access control

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Nginx (Reverse Proxy)                    │
├─────────────────────────────┬───────────────────────────────┤
│    Next.js Frontend (:3000)  │      Go API Backend (:8080)   │
├─────────────────────────────┴───────────────────────────────┤
│                    PostgreSQL + Redis                        │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Tech Stack |
|-------|------------|
| Frontend | Next.js 14, React 18, Ant Design 5, Zustand, Tailwind CSS |
| Backend | Go, Gin, GORM, JWT |
| Database | PostgreSQL 14, Redis 7 |
| Monitoring | Prometheus, Grafana |
| Deployment | Docker, Docker Compose, Nginx |

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Git

### One-Command Setup

```bash
# Clone the repository
git clone https://github.com/vigoordi/DigitalProductStore.git
cd DigitalProductStore

# Copy environment configuration
cp .env.example .env

# Start all services
docker-compose up -d
```

Once started, access:
- 🌐 Store Frontend: http://localhost
- 📡 API Docs: http://localhost/api/swagger/index.html
- 📊 Grafana: http://localhost:3001 (admin/admin)
- 📈 Prometheus: http://localhost:9090

### Default Admin Account

With `SEED_DEMO_DATA=true` (default), demo data is created:

| Email | Password | Role |
|-------|----------|------|
| admin@demo.local | Admin@1234 | super_admin |

## 📁 Project Structure

```
DigitalProductStore/
├── backend/                 # Go backend service
│   ├── cmd/api/            # Application entry point
│   ├── internal/
│   │   ├── config/         # Configuration
│   │   ├── database/       # Database connection & migrations
│   │   ├── handlers/       # HTTP handlers
│   │   ├── middleware/     # Middleware (auth, logging, etc.)
│   │   ├── models/         # Data models
│   │   ├── repositories/   # Data access layer
│   │   └── services/       # Business logic layer
│   └── api/openapi/        # Swagger documentation
├── frontend/               # Next.js frontend app
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # React components
│   │   ├── lib/           # Utilities and API client
│   │   └── stores/        # Zustand state management
│   └── public/            # Static assets
├── nginx/                  # Nginx configuration
├── monitoring/             # Prometheus & Grafana config
├── scripts/                # Deployment and maintenance scripts
└── docker-compose.yml      # Docker orchestration
```

## ⚙️ Environment Variables

Key configuration options (see `.env.example` for full list):

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_ENV` | Runtime environment | development |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `JWT_SECRET` | JWT secret key | change-me-in-production |
| `STRIPE_SECRET_KEY` | Stripe API key | - |
| `SEED_DEMO_DATA` | Create demo data | true |

## 🔌 API Overview

### Public Endpoints
```
GET    /api/v1/products          # Product list
GET    /api/v1/products/:id      # Product details
GET    /api/v1/categories        # Category list
POST   /api/v1/cart/items        # Add to cart
POST   /api/v1/orders            # Create order
POST   /api/v1/auth/register     # User registration
POST   /api/v1/auth/login        # User login
```

### Admin Endpoints (Auth Required)
```
POST   /api/v1/admin/products    # Create product
PUT    /api/v1/admin/orders/:id  # Update order status
GET    /api/v1/admin/analytics   # Analytics data
```

Full API documentation available at `/api/swagger/index.html`

## 🧪 Development

### Local Development (Without Docker)

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your database connection
go run ./cmd/api
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend
go test ./...

# Frontend lint
cd frontend
npm run lint
```

## 📊 Monitoring

The project includes Prometheus + Grafana monitoring:

- **Prometheus** collects API performance metrics
- **Grafana** provides visualization dashboards

Pre-configured metrics:
- HTTP request latency and throughput
- Database connection pool status
- Redis cache hit rate
- Order and payment success rates

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

[MIT License](LICENSE)

---

Questions or suggestions? [Open an issue](https://github.com/vigoordi/DigitalProductStore/issues).
