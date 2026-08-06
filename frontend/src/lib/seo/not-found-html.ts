import type { StorefrontLocale } from './policy';

const copy = {
  'es-CL': {
    title: 'No encontramos lo que buscabas',
    description: 'Es posible que el producto ya no esté disponible, que haya cambiado de dirección o que el enlace esté incompleto. Puedes buscar otra opción o volver a explorar nuestro catálogo.',
    searchLabel: 'Buscar en Plexoria',
    searchPlaceholder: 'Busca un producto, modelo o conector...',
    searchAction: 'Buscar',
    products: 'Ver todos los productos',
    home: 'Volver al inicio',
    navHome: 'Inicio',
    navProducts: 'Productos',
    footer: 'Tecnología y accesorios seleccionados en Chile.',
  },
  en: {
    title: "We couldn't find what you were looking for",
    description: 'The product may no longer be available, its address may have changed, or the link may be incomplete. Search for another option or continue browsing our catalog.',
    searchLabel: 'Search Plexoria',
    searchPlaceholder: 'Search by product, model or connector...',
    searchAction: 'Search',
    products: 'Browse all products',
    home: 'Back to home',
    navHome: 'Home',
    navProducts: 'Products',
    footer: 'Selected technology and accessories in Chile.',
  },
} as const;

export function renderProductNotFoundHTML(locale: StorefrontLocale): string {
  const text = copy[locale];
  const home = `/${locale}`;
  const products = `/${locale}/products`;
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>404 · ${text.title} | Plexoria</title>
  <style>
    :root{color-scheme:light;--brand:#123f4b;--ink:#16343d;--muted:#61767c;--accent:#ee7953;--line:#dce6e8;--soft:#e8f4fb;--bg:#f4f7f7}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-decoration:none}.header{height:76px;background:#fff;border-bottom:1px solid var(--line)}.bar{width:min(1180px,calc(100% - 32px));height:100%;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:24px}.logo{font-size:23px;font-weight:950;letter-spacing:.08em;color:var(--brand)}.nav{display:flex;gap:24px;font-size:14px;font-weight:750;color:var(--muted)}.shell{width:min(1180px,calc(100% - 32px));min-height:calc(100vh - 148px);margin:auto;padding:56px 0;display:flex;align-items:center}.card{width:100%;display:grid;grid-template-columns:1.08fr .92fr;overflow:hidden;border:1px solid var(--line);border-radius:28px;background:#fff;box-shadow:0 24px 70px rgba(16,48,58,.08)}.content{padding:62px 56px}.eyebrow{display:inline-flex;padding:6px 12px;border-radius:999px;background:var(--soft);color:var(--brand);font-size:12px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}h1{max-width:620px;margin:20px 0 0;font-size:42px;line-height:1.12;letter-spacing:-.035em}p{max-width:650px;margin:18px 0 0;color:var(--muted);font-size:16px;line-height:1.75}.search{max-width:650px;margin-top:30px;display:flex;gap:12px}.input{min-width:0;flex:1;height:50px;border:1px solid var(--line);border-radius:13px;background:var(--bg);padding:0 16px;font:inherit;outline:none}.input:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--soft)}.button{min-height:48px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--brand);border-radius:13px;padding:0 20px;font:inherit;font-size:14px;font-weight:850;cursor:pointer}.primary{background:var(--brand);color:#fff}.secondary{background:#fff;color:var(--brand)}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}.visual{position:relative;min-height:470px;overflow:hidden;background:linear-gradient(145deg,var(--soft),#dff3ed);display:flex;align-items:center;justify-content:center}.orb{width:264px;height:264px;border-radius:50%;background:rgba(255,255,255,.78);box-shadow:0 22px 60px rgba(30,84,94,.13);display:flex;align-items:center;justify-content:center;color:var(--brand);font-size:92px;font-weight:950;letter-spacing:-.08em}.glass{position:absolute;right:calc(50% - 150px);bottom:80px;width:78px;height:78px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 30px rgba(88,48,34,.2)}.glass:before{content:"";width:25px;height:25px;border:5px solid currentColor;border-radius:50%}.glass:after{content:"";position:absolute;width:18px;height:5px;background:currentColor;border-radius:5px;transform:translate(16px,16px) rotate(45deg)}.footer{height:72px;display:flex;align-items:center;justify-content:center;border-top:1px solid var(--line);background:#fff;color:var(--muted);font-size:13px;text-align:center;padding:0 20px}@media(max-width:820px){.nav{display:none}.shell{padding:28px 0}.card{grid-template-columns:1fr}.content{padding:42px 28px}.visual{display:none}h1{font-size:34px}.search{flex-direction:column}.search .button{width:100%}.actions{flex-direction:column}.actions .button{width:100%}}@media(max-width:440px){.bar,.shell{width:min(100% - 24px,1180px)}.content{padding:36px 20px}h1{font-size:30px}}
  </style>
</head>
<body>
  <header class="header"><div class="bar"><a class="logo" href="${home}" aria-label="Plexoria">PLEXORIA</a><nav class="nav" aria-label="Principal"><a href="${home}">${text.navHome}</a><a href="${products}">${text.navProducts}</a></nav></div></header>
  <main class="shell"><section class="card"><div class="content"><span class="eyebrow">Error 404</span><h1>${text.title}</h1><p>${text.description}</p><form class="search" action="${products}" role="search"><label for="q" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">${text.searchLabel}</label><input class="input" id="q" name="q" type="search" placeholder="${text.searchPlaceholder}"><button class="button primary" type="submit">${text.searchAction}</button></form><div class="actions"><a class="button primary" href="${products}">${text.products}</a><a class="button secondary" href="${home}">${text.home}</a></div></div><div class="visual" aria-hidden="true"><div class="orb">404</div><div class="glass"></div></div></section></main>
  <footer class="footer">© ${new Date().getUTCFullYear()} PLEXORIA · ${text.footer}</footer>
</body>
</html>`;
}
