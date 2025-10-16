FROM node:18-alpine

# Install git
RUN apk add --no-cache git

WORKDIR /app

# Clone the repository
ARG GITHUB_REPO
ARG GITHUB_BRANCH=main
RUN git clone --depth 1 --branch ${GITHUB_BRANCH} ${GITHUB_REPO} /tmp/repo && \
    cp -r /tmp/repo/backend/* /app/ && \
    rm -rf /tmp/repo

# Install dependencies
RUN npm install

EXPOSE 5000

CMD ["npm", "start"]
