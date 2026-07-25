# Public release checklist

Run this checklist before pushing a new public release or creating a public fork.

## Secrets and data

- [ ] `git ls-files` contains no `.env`, private key, credential, dump, backup, or customer export.
- [ ] Current files and recent Git history were scanned for payment keys, JWT secrets, SMTP credentials, and cloud credentials.
- [ ] Demo data contains no real customer, order, address, payment, or warehouse information.
- [ ] Production certificates, Grafana credentials, backups, and deployment files are excluded.

## Product boundary

- [ ] README labels this repository as the Community Edition.
- [ ] README links to the public store at `https://www.plexoria.cl`.
- [ ] `.env.community.example` contains blank third-party credentials and local-only defaults.
- [ ] Community compose starts only the frontend preview.
- [ ] Payment webhooks, inventory mutation, fulfillment, admin operations, analytics, and recommendation rules are not documented as public APIs.
- [ ] No private API endpoint, admin URL, monitoring URL, internal email, or deployment-only URL is hard-coded.

## Verification

```bash
git status --short
git ls-files | grep -E '(^|/)(\.env$|.*\.pem$|.*\.key$|.*\.dump$|.*\.sql$)'
```

On PowerShell, use `Select-String -Pattern` instead of `grep`.

Then run the frontend lint/build and the backend tests. If sensitive content ever entered Git history, rotate the credential first and rewrite history separately; deleting the current file is not enough.
