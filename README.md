# read2burn

A simple application for more secure password transportation.
It encrypts an entry and generates a secret link. Accessing the link displays the entry and removes it at the same time.

The link can be sent by email and the email can be archived without compromising the secret entry (of cource only if it has been accessed by the receipient once).

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

```sh
git clone https://github.com/52North/read2burn.git .
docker build --no-cache -t 52North/read2burn:<VERSION> .

# push to 52North docker repository
docker login docker.52North.org
docker tag 52North/read2burn:<VERSION> docker.52North.org/52North/read2burn:<VERSION>
docker push docker.52North.org/52North/read2burn:<VERSION>
```

Run the image

```sh
docker run --restart=always -d -p 3300:3300 --volume=/opt/read2burn/data:/app/data -e REL_PATH=<RELATIVE PATH, IE '/r2b'> --name read2burn 52North/read2burn:<VERSION>
```

Apache config for sub paths

```config
    RewriteRule ^/r2b$ %{HTTPS_HOST}/r2b/ [R=permanent,L]
    <Location /r2b/>
            ProxyPass http://localhost:3300/
            ProxyPassReverse http://localhost:3300/
            ProxyPreserveHost On
            RequestHeader set X-Forwarded-Proto "https"
            RequestHeader set X-Forwarded-Ssl on
    </Location>
```

This Apache configuration block sets up a RewriteRule that redirects requests to the root path /r2b to the sub-path /r2b/, using the R=permanent flag to issue a permanent redirect.

The <Location> block that follows defines a block of configuration directives that apply to the /r2b/ sub-path. The ProxyPass and ProxyPassReverse directives tell Apache to proxy requests to the specified URL, which in this case is http://localhost:3300/. The ProxyPreserveHost directive tells Apache to preserve the original host header when proxying the request.

The RequestHeader directives set the X-Forwarded-Proto and X-Forwarded-Ssl headers to "https" and "on", respectively. These headers are often used to indicate to the backend server that the original request was made over a secure connection, even if it is being proxied over an unencrypted connection.

Overall, this configuration block redirects requests to /r2b to /r2b/ and proxies requests to the /r2b/ sub-path to the specified URL, preserving the host header and adding the X-Forwarded-Proto and X-Forwarded-Ssl headers to the proxied request.
