# nginx SSL certificates

`nginx/nginx.conf` references the following files on the HTTPS server block:

- `server.crt` — PEM-encoded certificate chain (leaf + intermediates)
- `server.key` — PEM-encoded private key

Neither file is checked into the repository. Provision them before starting the
`nginx` service via `docker compose up`.

## Option 1: Self-signed cert (development / staging only)

Run from the repository root. `openssl` must be installed locally.

```bash
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout nginx/ssl/server.key \
  -out    nginx/ssl/server.crt \
  -subj   "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
chmod 600 nginx/ssl/server.key
```

Browsers will warn on first visit because the cert is not trusted by any CA.
That is expected; accept the warning or install the cert into your local trust
store for a cleaner experience.

Do **not** ship self-signed certs to production.

## Option 2: Let's Encrypt (production)

Two common approaches, pick whichever matches your deployment.

### 2a. certbot on the host, bind-mount into nginx

1. Install certbot on the host (`apt install certbot`, `dnf install certbot`, …).
2. Obtain a cert using the `standalone` or `webroot` plugin, e.g.

   ```bash
   sudo certbot certonly --standalone -d store.example.com
   ```

3. Symlink (or copy) the issued files into `nginx/ssl/`:

   ```bash
   sudo ln -sf /etc/letsencrypt/live/store.example.com/fullchain.pem nginx/ssl/server.crt
   sudo ln -sf /etc/letsencrypt/live/store.example.com/privkey.pem   nginx/ssl/server.key
   ```

4. Reload nginx after each renewal (`docker compose exec nginx nginx -s reload`)
   or add a renewal hook that does it.

### 2b. certbot as a sidecar container

Add a `certbot` service to `docker-compose.yml` that shares a volume with
nginx's `/etc/letsencrypt` and `/var/www/certbot`, and schedule `certbot renew`
on the host. The ACME http-01 challenge location in `nginx.conf` should be
served over port 80 before the HTTPS redirect.

## Filenames are fixed

`nginx.conf` hard-codes `server.crt` and `server.key`. If your certificate
tooling produces different names (for example Let's Encrypt's `fullchain.pem`
and `privkey.pem`), either symlink them into place as shown above or update
the two `ssl_certificate*` directives in `nginx/nginx.conf`.
