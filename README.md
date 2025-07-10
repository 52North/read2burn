# read2burn

A simple application for more secure password transportation.
It encrypts an entry and generates a secret link.
Accessing the link displays the entry and removes it at the same time.

The link can be sent by email and the email can be archived without compromising the secret entry (of course only if it has been accessed by the recipient once).

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
