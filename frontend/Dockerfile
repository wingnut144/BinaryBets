FROM node:18-alpine as build

# Install git
RUN apk add --no-cache git

WORKDIR /app

# Clone the repository
ARG GITHUB_REPO
ARG GITHUB_BRANCH=main
RUN git clone --depth 1 --branch ${GITHUB_BRANCH} ${GITHUB_REPO} /tmp/repo && \
    cp -r /tmp/repo/frontend/* /app/ && \
    rm -rf /tmp/repo

# Install dependencies and build
RUN npm install
RUN npm run build

FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
