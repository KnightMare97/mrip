# Use official Node.js runtime based on Debian Bookworm (provides Python 3.11+)
FROM node:22-bookworm-slim

# Install system runtime tools required for audio extraction and metadata:
# - ffmpeg and ffprobe for media transcoding and probe verification
# - python3 for yt-dlp execution (Debian Bookworm packages Python 3.11)
# - ca-certificates for secure outbound HTTPS requests
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install project dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy project source
COPY . .

# Establish executable permissions explicitly during image build
RUN chmod +x bin/yt-dlp

# Build client-side assets for production distribution
RUN npm run build

# Ensure temporary export working directory exists and is writable
RUN mkdir -p /tmp/musicrip_exports && chmod 777 /tmp/musicrip_exports

# Production runtime configuration
ENV NODE_ENV=production
ENV PORT=3000

# Platform will bind dynamically; default container exposure
EXPOSE 3000

# Start production server (serves static Vite bundle and Express API routes)
CMD ["npm", "start"]
