Run the docker

```
docker pull wemove/read2burn:latest
docker run --restart=always -d -p 3300:3300 --volume=/opt/read2burn/data:/app/data --name read2burn -e READ2BURN_MAX_SECRET_CHARS=4000 -e READ2BURN_PUBLIC_URL=https://read2burn.example.com wemove/read2burn:latest
```

The container can run as a non-root user. The official image defaults to the `node` user (uid 1000).
If you bind-mount a host directory to `/app/data`, make sure it is writable by uid 1000 (or run with `--user` to match your host permissions).

`READ2BURN_MAX_SECRET_CHARS` controls the maximum secret length and defaults to `4000`.
The backend request-body limit is computed from this value with transfer overhead for URL encoding.

`READ2BURN_PUBLIC_URL` is optional and can be used to force generated share links to a canonical URL.
This is recommended when running behind a reverse proxy.

Examples:

```sh
# root path deployment
-e READ2BURN_PUBLIC_URL=https://read2burn.example.com

# context path deployment
-e READ2BURN_PUBLIC_URL=https://read2burn.example.com/read2burn
```

Apache config for sub paths

---
    <Location />
            ProxyPass http://localhost:3300/
            ProxyPassReverse http://localhost:3300/
            ProxyPreserveHost On
            RequestHeader set X-Forwarded-Proto "https"
            RequestHeader set X-Forwarded-Ssl on
    </Location>
---


Build docker

```sh
cd ..
docker build -t wemove/read2burn:latest -f docker/Dockerfile .
``` 

Push image to a docker registry

```sh
docker login <docker-registry>
docker tag wemove/read2burn:latest <docker-registry or your-dockerhub-username>/read2burn:l<version>
docker push <docker-registry or your-dockerhub-username>/read2burn:<version>
```

The official Docker image is built automatically by a GitHub Action. You can find it on Docker Hub: [wemove/read2burn](https://hub.docker.com/r/wemove/read2burn)

