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

*Here*: `<VERSION>` must be replaced with `latest` or any other version identifier following semantic versioning.

```shell
VERSION=<VERSION>
git clone https://github.com/52North/read2burn.git .
docker build --no-cache -t "52North/read2burn:$VERSION" .

# push to 52North docker repository
docker login docker.52North.org
docker tag "52North/read2burn:$VERSION" "docker.52North.org/52North/read2burn:$VERSION"
docker push "docker.52North.org/52North/read2burn:$VERSION"
```

Run the image

*Here*:

* `<VERSION>` must be replaced with the value used above.
* `<RELATIVE PATH, IE '/r2b'>`must be replaced with a valid relative path, e.g. `/r2b`.

```shell
docker run --restart=always -d -p 3300:3300 --volume=/opt/read2burn/data:/app/data -e REL_PATH=<RELATIVE PATH, IE '/r2b'> --name read2burn 52North/read2burn:<VERSION>
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
