
# TurboPlaylist

High-performance YouTube playlist and single-video downloader with per-video format selection, 4K/2K support, and real-time progress updates.

## Highlights
- Download playlists or single videos.
- Select exactly which items to download.
- Per-video format picker with on-demand format list.
- 4K (2160p) and 2K (1440p) options.
- Force merge of video + audio into a single MP4 (requires FFmpeg).
- Real-time progress, speed, ETA, and total download time.
- Batch ZIP export once downloads finish.

## Screenshots

![Home and Analyzer](docs/screenshots/home.png)
![Format Picker](docs/screenshots/formats.png)
![Download Progress](docs/screenshots/progress.png)

## Tech Stack
- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + Socket.IO
- Downloader: yt-dlp (via `yt-dlp-exec`)
- Media processing: FFmpeg

## Requirements
- Node.js 18+ recommended
- Python 3 (required by yt-dlp on some systems)
- FFmpeg installed and available on PATH (required to merge audio/video)

## Project Structure
```
.
|-- backend/               # Node/Express server + Socket.IO
|-- components/            # UI components
|-- services/              # API client
|-- App.tsx                # Main UI
|-- types.ts               # Shared types
`-- vite.config.ts         # Vite config
```

## Setup
### Frontend
```bash
npm install
npm run dev
```
Frontend runs at `http://localhost:3000`.

### Backend
```bash
cd backend
npm install
npm start
```
Backend runs at `http://localhost:3001`.

## Usage
1. Paste a playlist or single video URL.
2. Click Analyze.
3. (Optional) Select items you want to download.
4. For format control:
   - Click Load formats on any item.
   - Choose the format you want from the dropdown.
5. Click Download Selected.
6. When finished, click Download ZIP to grab everything.

## Format Selection Behavior
- A/V format chosen: downloads the exact format and outputs MP4 if needed.
- Video-only format chosen: automatically merges with the best audio into one MP4.
- Audio-only format chosen: converts to MP3 with your selected audio quality.

Note: Merging requires FFmpeg. If FFmpeg is not installed, audio and video may stay separate.

## API Overview
### REST
- `GET /api/info?url=`
  Returns playlist or single-video metadata.
- `GET /api/formats/:id`
  Returns available formats for a given video ID.
- `GET /api/download/:id`
  Downloads the ZIP for the current session.

### Socket.IO Events
- Client -> Server: `start_download`
- Server -> Client: `progress_update`, `video_complete`, `playlist_complete`

## Roadmap
- Bulk "Load formats" action and cached format lists.
- Per-video presets and batch quality selection.
- Queue controls (pause, resume, reorder).
- Download history with re-run support.
- Multi-host support (YouTube, Vimeo, SoundCloud where allowed).

## Deployment Notes
- Frontend can be hosted on any static host (Vercel, Netlify, Cloudflare Pages).
- Backend must run on a Node server with FFmpeg available on PATH.
- Update `API_URL` in `services/api.ts` or use a proxy for production.
- If deploying behind a reverse proxy, ensure WebSocket support is enabled.
- Consider rate limits and storage cleanup for large playlists.

## Troubleshooting
- Backend fails with "Cannot find module 'express'": run `npm install` inside `backend`.
- Audio/video not merged: ensure FFmpeg is installed and on PATH.
- Formats missing: click Load formats per item; YouTube sometimes limits lists for private videos.

## Disclaimer
For personal use only. Please respect content creators' rights.
