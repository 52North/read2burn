# read2burn

A simple application for secure one-time secret sharing.  
It encrypts a secret, generates a single-use access link, and deletes the secret as soon as it is viewed.

The link can be sent safely via email and can even be archived afterward — as long as the recipient has accessed the secret once.

Visit: <https://www.read2burn.com/>

---

##  Recent Improvements

The application now includes several enhancements to improve security, reliability, and production readiness:

###  Security Updates
- **Secret Expiration (TTL):**  
  Every stored secret now has a configurable time-to-live.  
  If a secret is not accessed within the TTL period, it expires and is securely deleted.

- **Clear Expiry UI:**  
  Expired links now display a user-friendly `SECRET_EXPIRED` message instead of a generic error.

- **Rate Limiting:**  
  Limits excessive requests per IP to mitigate brute-force attempts and abuse.

###  System Reliability
- **Automatic Database Cleanup:**  
  A periodic cron job removes expired or stale entries and compacts the NeDB datastore.

- **Safer Production Defaults:**  
  Helmet security headers and compression are enabled for better performance and security.

These improvements maintain backwards compatibility while significantly strengthening the system.

---
## Dependencies

nodejs, npm, git

## Install

1. Install the application:

   ```sh
   git clone https://github.com/52north/read2burn.git
   ```

1. Load the required modules:

   ```sh
   npm install
   ```

1. Start the application:

   ```sh
   node app.js
   ```

## Docker

*Here*: `<VERSION>` must be replaced with a version identifier following semantic versioning.

### Build

```shell
VERSION=0.12.2 \
REGISTRY=docker.io \
IMAGE=52north/read2burn \
; \
docker build --no-cache \
  -t "${REGISTRY}/${IMAGE}:latest" \
  -t "${REGISTRY}/${IMAGE}:${VERSION}" \
  --build-arg BUILD_ID="$VERSION" \
  --build-arg BUILD_DATE=$(date -u --iso-8601=seconds) \
  --build-arg GIT_COMMIT=$(git rev-parse --short=20 -q --verify HEAD) \
  .
```

### Publish

Push to 52North docker repository

```shell
docker login docker.52North.org
docker tag "52North/read2burn:$VERSION" "docker.52North.org/52North/read2burn:$VERSION"
docker tag "52North/read2burn:latest" "docker.52North.org/52North/read2burn:latest"
docker push --all-tags docker.52North.org/52North/read2burn
```

### Run

Run the image

*Here*:

* To run another version than the "latest", replace `latest` in the command.
* The value of the environment variable `REL_PATH` must be replaced with a valid relative path, e.g. `/r2b`.

```shell
docker run \
   --rm \
   -p 3300:3300 \
   --volume=/tmp/read2burn/data:/app/data \
   --env REL_PATH=/ \
   --name read2burn \
   "${REGISTRY}/${IMAGE}:latest"
```

Apache config for sub paths:

```apacheconf
RewriteRule ^/r2b$ %{HTTPS_HOST}/r2b/ [R=permanent,L]
<Location /r2b/>
      ProxyPass http://localhost:3300/
      ProxyPassReverse http://localhost:3300/
      ProxyPreserveHost On
      RequestHeader set X-Forwarded-Proto "https"
      RequestHeader set X-Forwarded-Ssl on
</Location>
```
