####################
# Build application

FROM node:lts-alpine AS builder

ENV READ2BURN_HOME="/app"

WORKDIR ${READ2BURN_HOME}

COPY . .

# Run a command inside the image
# If you are building your code for production
# RUN npm ci --only=production
# else
# RUN npm install
RUN apk update \
  && apk upgrade \
  && apk add --no-cache tzdata \
  && npm ci --only=production \
  && rm -rf ${READ2BURN_HOME}/docker

####################
# Create image

FROM node:lts-alpine

# Your contact info
LABEL maintainer="Jürrens, Eike Hinderk <e.h.juerrens@52north.org>" \
      org.opencontainers.image.authors="Jürrens, Eike Hinderk <e.h.juerrens@52north.org>" \
      org.opencontainers.image.url="https://github.com/52North/read2burn.git" \
      org.opencontainers.image.vendor="52°North GmbH" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.title="52°North Read 2 Burn Deployment"
ENV READ2BURN_HOME="/app"

WORKDIR ${READ2BURN_HOME}

COPY --from=builder ${READ2BURN_HOME} .

EXPOSE 3300

VOLUME ["${READ2BURN_HOME}/data"]

CMD ["node", "app.js"]

ARG GIT_COMMIT
LABEL org.opencontainers.image.revision "${GIT_COMMIT}"

ARG BUILD_DATE
LABEL org.opencontainers.image.created "${BUILD_DATE}"
