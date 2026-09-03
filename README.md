# Plexoria Digital Store Community Edition

A mobile-first, Chile-ready storefront for physical products, built from the customer experience behind Plexoria's live electronics store.

Plexoria helps merchants turn a product catalog into a clear, localized buying journey: discovery, SKU selection, current price and availability, cart, and checkout. This public Community Edition lets developers and merchants evaluate that storefront, contribute improvements, and see the project in action without exposing production credentials, customer data, fulfillment rules, or private backend services.

[中文说明](README_zh.md) · [Español (Chile)](readme_es_cl.md)

## Live store

Explore the customer-facing experience in the live store:

<https://www.plexoria.cl>

## Why Plexoria stands out

- **Built around real products:** variants, SKU-specific media, pricing, availability, and purchase controls stay connected throughout the product journey.
- **Localized for Chile:** Spanish (Chile) routes, CLP-oriented presentation, locale-preserving navigation, and locally familiar buying language.
- **Designed for mobile shopping:** a responsive experience from 320px, with fast product discovery, Buy Now, cart, and checkout flows.
- **Ready to grow beyond the storefront:** the private Pro platform extends this experience with authoritative ordering, administration, payments, inventory, tax documents, shipping, notifications, and operational observability.

For the merchant-focused overview, local integrations, and honest production-readiness boundaries, read [Plexoria para vender productos físicos en Chile](readme_es_cl.md).

## Repositories

- Community repository: `VolinChan/DigitalProductStore-community`
- Private Pro repository: `VolinChan/DigitalProductStore-Pro`

## What you can evaluate in Community

- Mobile-first responsive storefront from 320px to desktop widths
- Localized English and Spanish (Chile) routes with locale-preserving navigation
- Shareable product discovery with search, filters, sorting, and pagination persisted in the URL
- Product detail pages that connect SKU selection with price, stock, media, and purchase-state updates
- Cart, mini-cart, Buy Now, login, registration, and checkout UI
- Keyboard-accessible menus, drawers, dialogs, focus restoration, reduced-motion support, and localized form errors
- Playwright coverage for storefront discovery, purchasing, accessibility, and responsive layouts
- Demo-oriented frontend configuration
- Next.js storefront code
- Docker-based frontend preview

## A clear production boundary

The Community Edition is an honest storefront preview, not a bundle of production secrets or merchant-specific operating rules. The following remain private operational concerns and may change between deployments:

- Live payment keys, webhook credentials, and payment settlement rules
- Production order, inventory, warehouse, customer, and analytics data
- Admin authorization policy and internal operating procedures
- Pricing, membership, coupon, recommendation, and fraud rules
- Production certificates, backups, monitoring credentials, and deployment secrets

The production backend is maintained in the private Pro repository. This separation keeps the public project useful while protecting each merchant's credentials, customers, operating decisions, and deployment configuration.

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

## Optional Cloudflare real-IP updater

The repository includes a reusable, credential-free updater for deployments that put an Nginx container behind Cloudflare. It downloads Cloudflare's official IPv4 and IPv6 proxy feeds over HTTPS, validates the candidate Nginx configuration, replaces the trusted-network file atomically, and reloads Nginx only after validation succeeds. A systemd timer runs it daily with a randomized delay and preserves the last working configuration if a download or reload fails.

Files:

```text
nginx/runtime/cloudflare-real-ip.conf                 Current public baseline
scripts/update-cloudflare-real-ip.sh                  Validated updater
scripts/systemd/plexoria-cloudflare-real-ip.service   One-shot systemd service
scripts/systemd/plexoria-cloudflare-real-ip.timer     Daily systemd timer
```

This component is not enabled by the frontend-only community Compose preview. To reuse it in your own Docker/Nginx deployment, mount the host directory containing `cloudflare-real-ip.conf` at `/etc/nginx/runtime` in the Nginx container, include that file from the Nginx `http` context, and adjust `CLOUDFLARE_REAL_IP_TARGET` and `NGINX_CONTAINER` in the service for your installation. Trust `CF-Connecting-IP` only through these Cloudflare source networks; do not add a blanket trust rule for arbitrary origin clients.

## Local frontend development

```bash
cd frontend
cp .env.local.example .env.local
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
nginx/runtime/                    Public Cloudflare trusted-network baseline
scripts/update-cloudflare-real-ip.sh  Optional validated network updater
scripts/systemd/                  Optional updater service and timer
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
| **Backend API** | Go 1.25 · Gin · GORM · PostgreSQL · Redis · JWT auth · Payment provider adapters · Transactional email |
| **Infrastructure** | Docker Compose · Nginx (reverse proxy, HTTPS/SSL, rate limiting) · Prometheus · Grafana · Cloudflare Origin CA |
| **Architecture** | RESTful API · Microservices-style (Docker Compose) · Multi-subdomain routing · Background worker (transfer deadline & reminder checkers) |

### Production Backend (Private)

The production backend — including authoritative checkout, payment processing, order management, inventory, shipping, analytics, the admin panel, and deployment configuration — is maintained in the private Pro repository (`VolinChan/DigitalProductStore-Pro`). It is configured and validated for each merchant rather than published with live secrets in this Community Edition.

### Commercial Licensing

This project is dual-licensed. The Community Edition is open-source under AGPLv3. If you are evaluating Plexoria for a physical-goods business, or need a private deployment without AGPL obligations, commercial support, an SLA, catalog migration, custom integrations, or white-label licensing, contact **[VolinChan on GitHub](https://github.com/VolinChan)**. Commercial terms are agreed case by case.
