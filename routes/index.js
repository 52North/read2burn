const app = require('../app');
const crypto = require('crypto');
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const base62 = require('base-x')(BASE62);

// per-IP rate limiting
const rateLimitStore = new Map();
const RATE_LIMIT = {
  windowMs: 60_000,
  max: 30
};

// TTL: 1 Hour
const SECRET_TTL_MS = 60 * 60 * 1000 ;

// async wrapper for nedb.findOne
function findOneAsync(nedb, query) {
  return new Promise((resolve, reject) => {
    nedb.findOne(query, (err, doc) => {
      if (err) reject(err);
      else resolve(doc);
    });
  });
}

// collision-free key generator
async function generateUniqueKey(nedb, cryptor) {
  while (true) {
    const key = cryptor.createKey();
    const existing = await findOneAsync(nedb, { key });
    if (!existing) return key;
  }
}

// secure rate limiter
function checkRateLimit(req, res) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitStore.get(ip) || { count: 0, start: now };

  if (now - record.start < RATE_LIMIT.windowMs) {
    record.count += 1;

    if (record.count > RATE_LIMIT.max) {
      rateLimitStore.set(ip, record);
      res.status(429);
      res.send('Too many requests. Please slow down.');
      return false;
    }

    rateLimitStore.set(ip, record);
  } else {
    rateLimitStore.delete(ip);
    rateLimitStore.set(ip, { count: 1, start: now });
  }

  return true;
}

exports.index = async function (req, res) {
  try {
    const nedb = app.nedb;
    const ERR_NO_SUCH_ENTRY = 'ERR_NO_SUCH_ENTRY';
    const ERR_SECRET_EXPIRED = 'SECRET_EXPIRED';

    let url = '';
    let encrypted = '';

    const cf = new CryptorFactory();

    if (!checkRateLimit(req, res)) return;

    // CREATE SECRET
    if (req.body?.secret) {
      const secret = req.body.secret;

      if (typeof secret !== 'string' || secret.length === 0) {
        res.status(400);
        return res.send('Secret must be a non-empty string.');
      }

      if (secret.length > 10_000_000) {
        res.status(413);
        return res.send('Argument too large.');
      }

      const cryptor = cf.createCurrent();
      const key = await generateUniqueKey(nedb, cryptor);

      const timestamp = Date.now();
      encrypted = cryptor.encrypt(secret);

      const entry = {
        key,
        timestamp,
        encrypted,
        expiresAt: timestamp + SECRET_TTL_MS
      };

      nedb.insert(entry, function (err) {
        if (err) {
          res.status(500);
          return res.send('Failed to store secret.');
        }

        let genUrl = `${req.protocol}://${req.hostname}${req.baseUrl}${req.path}`;

        if (process.env.BASE_URL) {
          genUrl = process.env.BASE_URL.replace(/\/+$/, '');
        }

        genUrl += `?id=${cryptor.getId()}`;

        return res.render('index', {
          url: genUrl,
          secret,
          error: undefined,
          found: false
        });
      });

      return;
    }

    // READ SECRET
    if (req.query.key || req.body?.id || req.query.id) {
      let id = req.query.key || req.query.id || req.body?.id;

      const crypt = cf.createFromId(id);

      if (!crypt.validateId(id)) {
        res.status(422);
        return res.send('Invalid argument.');
      }

      const key = crypt.parseKey(id);

      nedb.findOne({ key }, function (err, doc) {
        if (err || !doc) {
          return res.render('index', {
            url,
            secret: false,
            error: ERR_NO_SUCH_ENTRY,
            found: false
          });
        }

        const now = Date.now();

        // EXPIRED? show error immediately (fix)
        if (doc.expiresAt && doc.expiresAt < now) {
          nedb.remove({ key }, function () {
            nedb.compactDatafile();
          });

          return res.render('index', {
            url,
            secret: false,
            error: ERR_SECRET_EXPIRED,
            found: false
          });
        }

        // SHOW secret (decrypt)
        try {
          if (req.body?.show && doc.encrypted) {
            const decrypted = crypt.decrypt(doc.encrypted, id);

            nedb.remove({ key }, function () {
              nedb.compactDatafile();
            });

            return res.render('index', {
              url,
              secret: decrypted,
              error: undefined,
              found: true
            });
          }


          return res.render('index', {
            url,
            secret: false,
            error: undefined,
            found: true,
            id
          });

        } catch (e) {
          console.error('Decryption error:', e);
          return res.render('index', {
            url,
            secret: false,
            error: ERR_NO_SUCH_ENTRY,
            found: false
          });
        }
      });

      return;
    }

    return res.render('index', {
      url,
      secret: encrypted,
      error: undefined,
      found: false
    });
  } catch (err) {
    console.error('Unexpected server error:', err);
    res.status(500);
    res.send('Unexpected server error.');
  }
};

class CryptorFactory {
  createFromVersion(version) {
    switch (version) {
      case 'v1':
        return new CryptorV1();
      default:
        return new CryptorV2();
    }
  }

  createFromId(id) {
    if (typeof id !== 'string') throw new Error('Received non string id.');
    return id.length === 19
      ? this.createFromVersion('v1')
      : this.createFromVersion('v2');
  }

  createCurrent() {
    return this.createFromVersion('CURRENT');
  }
}

class Cryptor {
  KEY_LENGTH = 8;
  key = null;

  encrypt() { throw new Error('Not implemented.'); }
  decrypt() { throw new Error('Not implemented.'); }
  getId() { throw new Error('Not implemented.'); }
  validateId() { throw new Error('Not implemented.'); }

  parseKey(id) {
    return id.substring(0, this.KEY_LENGTH);
  }

  createKey() {
    this.key = this.uid(this.KEY_LENGTH);
    return this.key;
  }

  uid(len) {
    return base62.encode(crypto.randomBytes(len)).slice(0, len);
  }
}

class CryptorV1 extends Cryptor {
  PASSWORD_LENGTH = 12;
  CIPHER_ALGORITHM = 'aes256';

  decrypt(message, id) {
    const password = id.slice(this.KEY_LENGTH, this.KEY_LENGTH + this.PASSWORD_LENGTH);
    const secret = Buffer.from(password).toString('binary');
    const decipher = crypto.createDecipher(this.CIPHER_ALGORITHM, secret);
    return decipher.update(message, 'hex', 'utf8') + decipher.final('utf8');
  }

  validateId(id) {
    return (
      typeof id === 'string' &&
      id.length === this.KEY_LENGTH + this.PASSWORD_LENGTH - 1 &&
      /^[a-z0-9]+$/.test(id)
    );
  }
}

class CryptorV2 extends Cryptor {
  PASSWORD_LENGTH = 32;
  IV_LENGTH = 16;
  SALT_LENGTH = 16;
  CIPHER_ALGORITHM = 'aes-256-cbc';

  encrypt(message) {
    this.password = Buffer.from(this.uid(this.PASSWORD_LENGTH)).subarray(0, 32);
    this.iV = Buffer.from(this.uid(this.IV_LENGTH)).subarray(0, 16);
    this.salt = Buffer.from(this.uid(this.SALT_LENGTH)).subarray(0, 16);

    const key = crypto.scryptSync(this.password, this.salt, 32);
    const cipher = crypto.createCipheriv(this.CIPHER_ALGORITHM, key, this.iV);
    return cipher.update(message, 'utf8', 'hex') + cipher.final('hex');
  }

  decrypt(message, id) {
    const buf = Buffer.from(id);
    const password = buf.subarray(this.KEY_LENGTH, this.KEY_LENGTH + this.PASSWORD_LENGTH);
    const iv = buf.subarray(
      this.KEY_LENGTH + this.PASSWORD_LENGTH,
      this.KEY_LENGTH + this.PASSWORD_LENGTH + this.IV_LENGTH
    );
    const salt = buf.subarray(
      this.KEY_LENGTH + this.PASSWORD_LENGTH + this.IV_LENGTH,
      this.KEY_LENGTH + this.PASSWORD_LENGTH + this.IV_LENGTH + this.SALT_LENGTH
    );

    const key = crypto.scryptSync(password, salt, 32);
    const decipher = crypto.createDecipheriv(this.CIPHER_ALGORITHM, key, iv);
    return decipher.update(message, 'hex', 'utf8') + decipher.final('utf8');
  }

  getId() {
    return (
      this.key.toString() +
      this.password.toString() +
      this.iV.toString() +
      this.salt.toString()
    );
  }

  validateId(id) {
    return (
      typeof id === 'string' &&
      id.length ===
        this.KEY_LENGTH + this.PASSWORD_LENGTH + this.IV_LENGTH + this.SALT_LENGTH &&
      /^[a-zA-Z0-9]+$/.test(id)
    );
  }
}
