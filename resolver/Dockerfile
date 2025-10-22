FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy resolver script
COPY market-resolver.js ./

# Run resolver once on startup, then every 24 hours
CMD sh -c "echo 'Starting market resolver service...' && while true; do node market-resolver.js; echo 'Sleeping for 24 hours...'; sleep 86400; done"
