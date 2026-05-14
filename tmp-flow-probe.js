// One-shot probe: register a user, log in, add SKU#3, then GET /cart and dump full payload
const http = require('http');

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const buf = body ? Buffer.from(JSON.stringify(body)) : null;
    if (buf) headers['Content-Length'] = buf.length;
    const r = http.request({ hostname: 'api', port: 8080, path, method, headers }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (buf) r.write(buf);
    r.end();
  });
}

(async () => {
  const email = `probe${Math.floor(Math.random()*999999)}@t.local`;
  await req('POST', '/api/v1/auth/register', { email, password: 'Probe1234!', full_name: 'Probe User' });
  const lr = await req('POST', '/api/v1/auth/login', { email, password: 'Probe1234!' });
  const token = lr.json.data.access_token;
  console.log('login status:', lr.status, 'tokenLen:', token?.length);

  const ar = await req('POST', '/api/v1/cart/items', { sku_id: 3, quantity: 1 }, token);
  console.log('add:', ar.status, JSON.stringify(ar.json).slice(0,200));

  const cr = await req('GET', '/api/v1/cart', null, token);
  console.log('cart status:', cr.status);
  console.log('cart body:');
  console.log(JSON.stringify(cr.json, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
