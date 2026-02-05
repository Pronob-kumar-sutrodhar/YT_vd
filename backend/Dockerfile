FROM node:18-bullseye-slim

WORKDIR /app

# Install FFmpeg for video/audio merging
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
