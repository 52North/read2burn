# read2burn

A simple application for more secure password transportation.
It encrypts an entry and generates a secret link.
Accessing the link displays the entry and removes it at the same time.

The link can be sent by email or social media.
The link can be archived without compromising the secret entry (of course only if it has been accessed by the recipient once).

Please have a look at <https://www.read2burn.com/>.

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

## Configuration

You can control the maximum secret length with:

```shell
READ2BURN_MAX_SECRET_CHARS
``

Default is `4000`.

To force generated share links to always use a canonical base URL, set:

```shell
READ2BURN_PUBLIC_URL
```

Example:

```shell
READ2BURN_PUBLIC_URL=https://read2burn.example.com
```

When this is set, link generation ignores request host/protocol headers and always uses that base URL.
If unset, the application keeps the original request-based behavior.

You can also include a context path in this URL:

```shell
READ2BURN_PUBLIC_URL=https://read2burn.example.com/read2burn
``

Generated links will then use that prefix (for example `https://read2burn.example.com/read2burn/?id=...`).

This value is used for both:

- the client-side textarea counter (`maxChars`)
- the server-side secret length check in the route

The URL-encoded body-parser limit is derived from this setting with additional transfer overhead, so requests are not rejected too early due to encoding expansion.


## Security Trade-off (Current)

At the moment, CSRF-specific protections (for example anti-CSRF tokens) are not enforced on the current POST endpoints by design.

Rationale:

- the app currently does not expose a formal authenticated API surface
- these POST routes are primarily intended for browser form flow
- adding strict CSRF/API protections now would constrain API-like request patterns planned for a later API boundary

This decision will be revisited when introducing a real API.
At that point, API authentication and CSRF strategy will be defined together.

## Docker

*Here*: `<VERSION>` must be replaced with a version identifier following semantic versioning.

### Build

```shell
VERSION=0.14 \
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

### Scan

```shell
trivy image \
      --scanners vuln \
      --format table \
      --severity CRITICAL,HIGH \
      --ignore-unfixed \
      "${REGISTRY}/${IMAGE}:${VERSION}"
```

## Publish

Push to 52North docker repository

```shell
docker login docker.52North.org
docker tag "52North/read2burn:$VERSION" "docker.52North.org/52North/read2burn:$VERSION"
docker tag "52North/read2burn:latest" "docker.52North.org/52North/read2burn:latest"
docker push --all-tags docker.52North.org/52North/read2burn
```

## Run

Run the image

*Here*:

- To run another version than the "latest", replace `latest` in the command.
- The value of the environment variable `READ2BURN_PUBLIC_URL` must be replaced with a valid domain and may include a context path without trailing `/`, e.g. `https://sh.52n.org/r2b`.

```shell
docker run \
   --rm \
   -p 3300:3300 \
   --volume=/tmp/read2burn/data:/app/data \
   --env READ2BURN_PUBLIC_URL=http://localhost:3300/ \
   --env READ2BURN_MAX_SECRET_CHARS=4000 \
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
