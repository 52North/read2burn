const app = require('../app');
const crypto = require('crypto');
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const base62 = require('base-x')(BASE62);

function buildShareUrl(req, id) {
	const path = `?id=${id}`;
	if (app.publicBaseUrl) {
		return new URL(path, app.publicBaseUrl).toString();
	}
	return `${req.protocol}://${req.get('host')}/?id=${id}`;
}

exports.index = function (req, res) {
	try {
		const nedb = app.nedb;
		const ERR_NO_SUCH_ENTRY = 'ERR_NO_SUCH_ENTRY';
		const MAX_SECRET_CHARS = app.maxSecretChars || 4000;

		let url = "";
		let encrypted = "";

		const cf = new CryptorFactory();

		if (req.body.secret) {
			if (req.body.secret.length > MAX_SECRET_CHARS) {
				res.status(413);
				return res.send('Argument too large.');
			}
			const cryptor = cf.createCurrent();
			let found = false;
			let key = null;
			const secret = req.body.secret;
			do {
				key = cryptor.createKey();
				nedb.findOne({ key }, function (err, doc) {
					if (doc) {
						found = true;
					}
				});
			} while (found);
	
			const timestamp = new Date().getTime();
			const encrypted = cryptor.encrypt(secret);
			const entry = { key, timestamp, encrypted }
			nedb.insert(entry, function (err, doc) {
				url = buildShareUrl(req, cryptor.getId());
				res.render('index', { url: url, secret: secret, error: undefined, found: false });
			});
		// parameter 'key' is deprecated, remove related code after 01.01.2025
		} else if (req.query.key || req.body.id || req.query.id) {
			let id = req.query.key;
			if (!id) id = req.query.id;
			if (!id) id = req.body.id;

			const crypt = cf.createFromId(id);

			if (!crypt.validateId(id)) {
				res.status(422);
				return res.send('Invalid argument.');
			} else {

				const key = crypt.parseKey(id);
				
				nedb.findOne({ key, consumed: { $ne: true } }, function (err, doc) {
					if (err) {
						res.render('index', { url: url, secret: false, error: ERR_NO_SUCH_ENTRY, found: false });
					} else {
						try {
							if (doc && doc.encrypted && req.body.show) {
								// Atomically claim the secret before decrypting to enforce read-once semantics.
								nedb.update(
									{ key, consumed: { $ne: true } },
									{ $set: { consumed: true, consumedAt: new Date().getTime() } },
									{ returnUpdatedDocs: true },
									function (err, numAffected, affectedDoc) {
										if (err || !numAffected || !affectedDoc || !affectedDoc.encrypted) {
											return res.render('index', { url: url, secret: false, error: ERR_NO_SUCH_ENTRY, found: false });
										}
										try {
											const decrypted = crypt.decrypt(affectedDoc.encrypted, id);
											nedb.remove({ key, consumed: true }, function (err, numDeleted) {
												nedb.compactDatafile();
											});
											return res.render('index', { url: url, secret: decrypted, error: undefined, found: true });
										} catch (e) {
											return res.render('index', { url: url, secret: false, error: ERR_NO_SUCH_ENTRY, found: false });
										}
									}
								);
							} else if (doc && doc.encrypted) {
								res.render('index', { url: url, secret: false, error: undefined, found: true, id: id });
							} else {
								res.render('index', { url: url, secret: false, error: ERR_NO_SUCH_ENTRY, found: false });
							}
						} catch (e) {
							res.render('index', { url: url, secret: false, error: ERR_NO_SUCH_ENTRY, found: false });
						}
					}
				});
			}
		} else {
			res.render('index', { url: url, secret: encrypted, error: undefined, found: false });
		}
	} catch (err) {
		console.log(err);
		res.status(500);
		res.send('Unexpected server error.');
	}

};



class CryptorFactory {
	V2_ID_LENGTH = CryptorV2.ID_LENGTH;

	createFromId(id) {
		switch (id.length) {
			case this.V2_ID_LENGTH:
				return new CryptorV2();
			default:
				return new CryptorV2();
		}
	}

	createCurrent() {
		return new CryptorV2();
	}

}

class Cryptor {

	KEY_LENGTH = 8;

	key = null;

	encrypt( message ) {
		throw new Error('This method must be implemented by concrete classes.');
	}

	decrypt( message, key ) {
		throw new Error('This method must be implemented by concrete classes.');
	}

	getId( id ) {
		throw new Error('This method must be implemented by concrete classes.');
	}

	validateId( id ) {
		throw new Error('This method must be implemented by concrete classes.');
	}

	parseKey(id) {
		return id.substr(0, this.KEY_LENGTH);
	}

	createKey() {
		this.key = this.uid(this.KEY_LENGTH);
		return this.key;
	}
	
	uid(len) {
		return base62.encode(crypto.randomBytes(len)).slice(0, len);
	}

}

class CryptorV2 extends Cryptor {

	static KEY_LENGTH = 8;
	static PASSWORD_LENGTH = 32;
	static IV_LENGTH = 16;
	static SALT_LENGTH = 16;
	static ID_LENGTH = this.KEY_LENGTH + this.PASSWORD_LENGTH + this.IV_LENGTH + this.SALT_LENGTH;
	CIPHER_ALGORITHM = "aes-256-cbc"

	password = null;
	iV = null;
	salt = null;

	constructor() {
		super();
		this.KEY_LENGTH = CryptorV2.KEY_LENGTH;
	}

	encrypt( message ) {
		// store in members to be used later to create the parameter 'id'
		this.password  = Buffer.from(this.uid(CryptorV2.PASSWORD_LENGTH)).subarray(0, 32);
		this.iV = Buffer.from(this.uid(CryptorV2.IV_LENGTH)).subarray(0, 16);
		this.salt = Buffer.from(this.uid(CryptorV2.SALT_LENGTH)).subarray(0, 16);

		const passKey = crypto.scryptSync(this.password, this.salt, 32);
		const cipher = crypto.createCipheriv(this.CIPHER_ALGORITHM, passKey, this.iV);
		return cipher.update(message, 'utf8', 'hex') + cipher.final('hex');
	}

	decrypt(message, id ) {
		const baseBuf = Buffer.from(id);
		const password = baseBuf.subarray(CryptorV2.KEY_LENGTH, CryptorV2.KEY_LENGTH + CryptorV2.PASSWORD_LENGTH)
		const iV = baseBuf.subarray(CryptorV2.KEY_LENGTH + CryptorV2.PASSWORD_LENGTH, CryptorV2.KEY_LENGTH + CryptorV2.PASSWORD_LENGTH + CryptorV2.IV_LENGTH)
		const salt = baseBuf.subarray(CryptorV2.KEY_LENGTH + CryptorV2.PASSWORD_LENGTH + CryptorV2.IV_LENGTH, CryptorV2.KEY_LENGTH + CryptorV2.PASSWORD_LENGTH + CryptorV2.IV_LENGTH + CryptorV2.SALT_LENGTH)

		const passKey = crypto.scryptSync(password, salt, 32);
		const decipher = crypto.createDecipheriv(this.CIPHER_ALGORITHM, passKey, iV);
		return decipher.update(message, 'hex', 'utf8') + decipher.final('utf8');
	}

	getId() {
		return this.key.toString() + this.password.toString() + this.iV.toString() + this.salt.toString();
	}

	validateId(id) {
		return id.length == CryptorV2.ID_LENGTH && id.match(/^[a-zA-Z0-9]+$/);
	}

}