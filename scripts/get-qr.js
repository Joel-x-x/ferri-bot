/**
 * Script de prueba — genera JWT de dev y obtiene QR de sesión WhatsApp
 * Uso: node scripts/get-qr.js
 */

const http = require('http');
const jwt  = require('../node_modules/jsonwebtoken');

// ── Config (debe coincidir con .env) ──────────────────────────────────────────
// Lee del .env de ferri-bot (no del sistema)
require('../node_modules/dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true });
const JWT_SECRET = process.env.JWT_SECRET || 'ferri-bot-dev-secret-2024';
const JWT_ISSUER = 'ferridescuentos';
const TENANT_ID  = 'tenant-test-001';

function generateJwt() {
  return jwt.sign(
    { sub: 'user-test-001', tenantId: TENANT_ID, roles: ['ADMIN'] },
    JWT_SECRET,
    { expiresIn: '1h', issuer: JWT_ISSUER },
  );
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function post(path, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({});
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const token = generateJwt();
  console.log('\n🔑 JWT generado para tenant:', TENANT_ID);
  console.log('Token:', token.slice(0, 60) + '...\n');

  console.log('📡 Iniciando sesión WhatsApp...');
  const res = await post('/whatsapp/sessions/start', token);

  console.log('Status HTTP:', res.status);
  console.log('Respuesta:', JSON.stringify({ ...res.body, qr: res.body.qr ? '[QR_BASE64_PRESENTE]' : undefined }, null, 2));

  if (res.body.qr) {
    const fs = require('fs');
    const qrPath = 'scripts/qr.html';
    fs.writeFileSync(qrPath, `<!DOCTYPE html>
<html>
<head><title>Ferri-Bot QR</title></head>
<body style="background:#111;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column">
  <h2 style="color:white;font-family:sans-serif">Escanea con WhatsApp</h2>
  <img src="${res.body.qr}" style="width:300px;height:300px;border-radius:16px"/>
  <p style="color:#888;font-family:sans-serif;margin-top:16px">Tenant: ${TENANT_ID}</p>
</body>
</html>`);
    console.log('\n✅ QR guardado en:', qrPath);
    console.log('→ Abre scripts/qr.html en el browser para escanear');
  } else if (res.body.status === 'CONNECTED') {
    console.log('\n✅ Sesión ya conectada. Número:', res.body.phoneNumber);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  console.error('¿Está corriendo el servidor? npm run start:dev');
});
