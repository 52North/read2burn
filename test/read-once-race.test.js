const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

const projectRoot = path.resolve(__dirname, '..');

function request({ port, method, pathname, form }) {
  const body = form ? new URLSearchParams(form).toString() : '';
  const headers = {};
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers
      },
      (res) => {
        let responseBody = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: responseBody });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function waitForServer(port, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await request({ port, method: 'GET', pathname: '/' });
      if (response.statusCode === 200) return;
    } catch (err) {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Server did not start in time.');
}

async function stopProcess(child) {
  if (!child || child.killed) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
    }, 2000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

test('only one concurrent read can reveal a secret', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'read2burn-test-'));
  const dbFile = path.join(tmpDir, 'read2burn.db');
  const port = 34000 + Math.floor(Math.random() * 1000);

  const child = spawn(process.execPath, ['app.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      READ2BURN_DB_FILE: dbFile
    },
    stdio: 'ignore'
  });

  try {
    await waitForServer(port);

    const secret = `race-secret-${Date.now()}`;
    const createResponse = await request({
      port,
      method: 'POST',
      pathname: '/',
      form: { secret }
    });

    assert.equal(createResponse.statusCode, 200);
    const idMatch = createResponse.body.match(/[?&]id=([A-Za-z0-9]+)/);
    assert.ok(idMatch, 'Expected to extract secret id from create response');
    const id = idMatch[1];

    const [r1, r2] = await Promise.all([
      request({ port, method: 'POST', pathname: '/', form: { id, show: 'true' } }),
      request({ port, method: 'POST', pathname: '/', form: { id, show: 'true' } })
    ]);

    const responses = [r1, r2];
    const successfulReads = responses.filter((r) => r.body.includes(secret)).length;
    const missingReads = responses.filter((r) => r.body.includes('No entry found!')).length;

    assert.equal(successfulReads, 1, 'Exactly one request should reveal the secret');
    assert.equal(missingReads, 1, 'Exactly one request should fail after secret is consumed');
  } finally {
    await stopProcess(child);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
