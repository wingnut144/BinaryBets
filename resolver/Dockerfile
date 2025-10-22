FROM node:18-alpine

# Install dcron and required tools
RUN apk add --no-cache dcron

WORKDIR /app

# Copy package files
COPY package.json ./
RUN npm install

# Copy resolver script
COPY market-resolver.js ./

# Create cron job file (runs daily at 2 AM UTC)
RUN echo "0 2 * * * cd /app && /usr/local/bin/node market-resolver.js >> /var/log/resolver.log 2>&1" > /etc/crontabs/root

# Create log file and set permissions
RUN touch /var/log/resolver.log && chmod 666 /var/log/resolver.log

# Start cron in foreground
CMD ["crond", "-f", "-d", "8"]
