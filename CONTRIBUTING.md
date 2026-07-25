# Contributing

Thanks for helping improve the Digital Store Community Edition.

Please keep pull requests focused on the public demo: UI, accessibility, documentation, tests, performance, and safe local development. Do not add real credentials, customer data, production domains, payment integrations, warehouse rules, or private deployment configuration.

Before opening a pull request:

1. Run `npm run lint` and `npm run build` in `frontend/`.
2. Run `go test ./...` in `backend/` when changing the API.
3. Confirm that `.env` and generated files are not staged.
4. Describe any security or data-handling impact.

By contributing, you agree that your contribution is licensed under the repository's AGPL-3.0 license.
