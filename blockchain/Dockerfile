FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native compilation
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

# Ensure entrypoint is executable
RUN chmod +x ./entrypoint.sh

EXPOSE 8545

ENTRYPOINT ["/bin/sh", "./entrypoint.sh"]

