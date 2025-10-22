FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy resolver script
COPY market-resolver.js ./

# Wait for backend to be ready, then run resolver
CMD ["sh", "-c", "echo 'Waiting for backend to be ready...' && sleep 60 && echo 'Starting market resolver service...' && while true; do node market-resolver.js; echo 'Sleeping for 24 hours...'; sleep 86400; done"]
