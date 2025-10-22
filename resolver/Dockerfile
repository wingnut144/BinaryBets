FROM node:18-alpine

# Install cron
RUN apk add --no-cache dcron

WORKDIR /app

# Copy package files
COPY package.json ./
RUN npm install

# Copy resolver script
COPY market-resolver.js ./

# Create cron job (runs daily at 2 AM)
RUN echo "0 2 * * * cd /app && node market-resolver.js >> /var/log/resolver.log 2>&1" > /etc/crontabs/root

# Create log file
RUN touch /var/log/resolver.log

CMD crond -f -l 2
