# TurboPlaylist Backend

This is the Node.js backend for the TurboPlaylist downloader.

## Prerequisites
1. **Node.js** (v16+)
2. **Python 3** (required for yt-dlp)
3. **FFmpeg** (installed and in system PATH)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. The server runs on `http://localhost:3001`.

## Environment Variables
- `PORT`: Port to run on (default 3001)
- `REDIS_URL`: (Optional) If you implement the Bull queue for scaling.

## Performance Tuning
To optimize for Bangladesh ISPs:
- The code uses `--concurrent-fragments` in `yt-dlp`.
- `retries` are set to 10 to handle packet loss.
- Increase `concurrentDownloads` in the frontend config if bandwidth allows.
