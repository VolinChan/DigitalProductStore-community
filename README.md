# Plexoria Digital Store Community Edition

Open-source community edition of the storefront behind Plexoria, a live electronics marketplace.

This repository is the public community edition of a real digital-store project. Its main purpose is to showcase the storefront, invite feedback, and send interested visitors to the live store. Production payment credentials, operational data, fulfillment rules, backend services, and private deployment configuration do not belong here.

[中文说明](README_zh.md)

## Live store

Visit the live store here:

<https://www.plexoria.cl>

## Repositories

- Community repository: `VolinChan/DigitalProductStore-community`
- Private Pro repository: `VolinChan/DigitalProductStore-Pro`

## What is included

- Mobile-first responsive storefront from 320px to desktop widths
- Localized English and Spanish (Chile) routes with locale-preserving navigation
- Product discovery with URL-persisted search, filters, sorting, and pagination
- Product detail pages with SKU selection, live price, stock, media, and purchase-state updates
- Cart, mini-cart, Buy Now, login, registration, and checkout UI
- Keyboard-accessible menus, drawers, dialogs, focus restoration, reduced-motion support, and localized form errors
- Playwright coverage for storefront discovery, purchasing, accessibility, and responsive layouts
- Demo-oriented frontend configuration
- Next.js storefront code
- Docker-based frontend preview

## What is intentionally not a production promise

The public repository must not be used as the source of truth for a live store. The following remain private operational concerns and may change without notice:

- Live payment keys, webhook credentials, and payment settlement rules
- Production order, inventory, warehouse, customer, and analytics data
- Admin authorization policy and internal operating procedures
- Pricing, membership, coupon, recommendation, and fraud rules
- Production certificates, backups, monitoring credentials, and deployment secrets

The production backend is maintained in the private Pro repository. Keep production credentials, operational data, and deployment configuration out of community forks.

## Quick start: community UI preview

Requirements: Docker Desktop and Git.

```bash
git clone https://github.com/VolinChan/DigitalProductStore-community.git
cd DigitalProductStore-community
cp .env.community.example .env
docker compose -f docker-compose.community.yml up --build
```

Open <http://localhost:3000>. The community compose file starts the frontend preview only. It does not start the production API, database, Nginx, Grafana, Prometheus, or any live payment integration.

To stop it:

```bash
docker compose -f docker-compose.community.yml down
```

## Local frontend development

```bash
cd frontend
copy .env.local.example .env.local
npm ci
npm run dev
```

## Architecture

```text
Browser -> Next.js storefront preview
```

The production API, deployment topology, certificates, monitoring, backups, and commercial services are deliberately excluded from the community quick start.

## Repository map

```text
frontend/                         Storefront UI
docker-compose.community.yml      Frontend preview stack
.env.community.example            Non-secret demo configuration
```

## Security boundary

Never commit `.env`, credentials, private keys, database dumps, customer data, or real product exports. Public issues should contain reproducible demo information only. See [`SECURITY.md`](SECURITY.md) for reporting instructions.

## Contributing

Bug fixes, accessibility improvements, documentation, tests, and UI contributions are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

## License

The community edition is available under the [GNU Affero General Public License v3.0](LICENSE). Commercial/private deployment, support, and production integrations are outside this repository and require a separate commercial agreement.

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16 · React 19 · TypeScript · Ant Design 6 · Tailwind CSS · Framer Motion · Zustand · Axios · Sonner (toasts) |
| **Backend API** | Go 1.25 · Gin · GORM · PostgreSQL · Redis · JWT auth · Stripe Payments · SMTP email |
| **Infrastructure** | Docker Compose · Nginx (reverse proxy, HTTPS/SSL, rate limiting) · Prometheus · Grafana · Cloudflare Origin CA |
| **Architecture** | RESTful API · Microservices-style (Docker Compose) · Multi-subdomain routing · Background worker (transfer deadline & reminder checkers) |

### Production Backend (Private)

The production backend — including payment processing, order management, inventory, analytics, admin panel, and deployment configuration — is maintained in the private Pro repository (`VolinChan/DigitalProductStore-Pro`). It is not included in this community edition.

### Commercial Licensing

This project is dual-licensed. The community edition is open-source under AGPLv3. For organizations that want to deploy a private fork without AGPL obligations, or require commercial support, SLA, custom integrations, or white-label licensing, please contact **VolinChan** via GitHub. Commercial license terms are negotiable on a case-by-case basis.
