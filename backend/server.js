/**
 * TURBOPLAYLIST BACKEND
 *
 * Optimized for High Performance in South Asia
 * Uses yt-dlp-exec with custom flags for network resilience.
 */

const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const youtubedl = require('yt-dlp-exec');
const archiver = require('archiver');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// --- CONFIGURATION ---
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

let ffmpegAvailable = false;
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
  ffmpegAvailable = true;
} catch (err) {
  ffmpegAvailable = false;
}

const YT_USER_AGENT =
  process.env.YT_USER_AGENT ||
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const YT_COOKIES_PATH = process.env.YT_COOKIES_PATH;

const applyYtFlags = (flags) => {
  const next = {
    ...flags,
    userAgent: YT_USER_AGENT,
    geoBypass: true,
    geoBypassCountry: 'US'
  };
  if (YT_COOKIES_PATH) {
    next.cookies = YT_COOKIES_PATH;
  }
  return next;
};

// Clean up old files every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  fs.readdir(DOWNLOAD_DIR, (err, files) => {
    if (err) return;
    files.forEach((file) => {
      const filePath = path.join(DOWNLOAD_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (stats.ctimeMs < oneHourAgo) {
          fs.rm(filePath, { recursive: true, force: true }, () =>
            console.log(`Deleted old session: ${file}`)
          );
        }
      });
    });
  });
}, 3600000);

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send('OK');
});

app.get('/api/ffmpeg', (req, res) => {
  res.json({ available: ffmpegAvailable });
});

app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const isPlaylist = /[?&]list=/.test(url);
    const infoFlags = applyYtFlags({
      dumpSingleJson: true,
      noWarnings: true,
      skipDownload: true,
      noCheckCertificates: true,
      ignoreErrors: true
    });

    if (isPlaylist) {
      infoFlags.flatPlaylist = true;
    } else {
      infoFlags.noPlaylist = true;
    }

    const output = await youtubedl(url, infoFlags);

    const rawEntries = Array.isArray(output.entries) ? output.entries.filter(Boolean) : [];
    const entries = rawEntries.length > 0 ? rawEntries : output.id ? [output] : [];
    const videos = entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      thumbnail: entry.thumbnails
        ? entry.thumbnails[0].url
        : `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`,
      duration: entry.duration_string || '00:00',
      status: 'pending',
      progress: 0,
      size: 'waiting...',
      speed: '-',
      eta: '-'
    }));

    res.json(videos);
  } catch (err) {
    const details = err?.stderr?.toString?.() || err?.message || String(err);
    console.error('Info Error:', details);
    res.status(500).json({ error: 'Failed to fetch playlist info', details });
  }
});

app.get('/api/formats/:id', async (req, res) => {
  const videoId = req.params.id;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });

  try {
    const output = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, applyYtFlags({
      dumpSingleJson: true,
      noWarnings: true,
      skipDownload: true,
      noCheckCertificates: true,
      ignoreErrors: true
    }));

    const formats = (output.formats || []).map((format) => ({
      id: format.format_id,
      ext: format.ext || '',
      height: format.height || undefined,
      fps: format.fps || undefined,
      filesize: format.filesize || format.filesize_approx || undefined,
      tbr: format.tbr || undefined,
      hasVideo: format.vcodec && format.vcodec !== 'none',
      hasAudio: format.acodec && format.acodec !== 'none',
      note: format.format_note || format.format || ''
    }));

    res.json(formats);
  } catch (err) {
    const details = err?.stderr?.toString?.() || err?.message || String(err);
    console.error('Formats Error:', details);
    res.status(500).json({ error: 'Failed to fetch video formats', details });
  }
});

app.get('/api/download/:id', (req, res) => {
  const socketId = req.params.id;
  const folderPath = path.join(DOWNLOAD_DIR, socketId);

  if (!fs.existsSync(folderPath)) return res.status(404).send('Expired or invalid');

  const archive = archiver('zip', { zlib: { level: 9 } });

  res.attachment('playlist.zip');
  archive.pipe(res);
  archive.directory(folderPath, false);

  archive.on('error', (err) => {
    res.status(500).send({ error: err.message });
  });

  res.on('finish', () => {
    fs.rm(folderPath, { recursive: true, force: true }, () => {});
  });

  archive.finalize();
});

// --- DOWNLOAD MANAGER ---

const queueDownload = async (video, sessionDir, flags, socket) => {
  const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;

  // Create a promise that wraps the yt-dlp execution
  return new Promise((resolve) => {
    try {
      // Add newline flag to ensure parsable stdout
      const subprocess = youtubedl.exec(videoUrl, { ...flags, newline: true });

      if (subprocess.stdout) {
        subprocess.stdout.on('data', (data) => {
          const lines = data.toString().split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;

            // Regex for newline output: [download] 25.5% of 10.00MiB at 5.00MiB/s ETA 00:05
            const progressMatch = line.match(/(\d+(?:\.\d+)?)%/);
            const speedMatch = line.match(/at\s+([0-9.]+\w+\/s)/);
            const etaMatch = line.match(/ETA\s+(\d{2}:\d{2})/);

            if (progressMatch) {
              const progress = parseFloat(progressMatch[1]);
              socket.emit('progress_update', {
                videoId: video.id,
                progress,
                speed: speedMatch ? speedMatch[1] : '',
                eta: etaMatch ? etaMatch[1] : ''
              });
            }
          }
        });
      }

      // Handle completion
      subprocess
        .then(() => {
          socket.emit('video_complete', { videoId: video.id });
          resolve();
        })
        .catch((err) => {
          console.error(`Error downloading ${video.id}:`, err);
          // Treat as complete but maybe with error state in future
          socket.emit('video_complete', { videoId: video.id });
          resolve();
        });
    } catch (error) {
      console.error(`Spawn error ${video.id}:`, error);
      resolve();
    }
  });
};

io.on('connection', (socket) => {
  const socketId = socket.id;
  const sessionDir = path.join(DOWNLOAD_DIR, socketId);
  fs.mkdirSync(sessionDir, { recursive: true });

  socket.on('start_download', async (data) => {
    const { videos, format, quality, speedMode } = data;

    // Config Flags
    const isAudio = format === 'audio';
    const concurrentFragments =
      speedMode === 'TURBO' ? 8 : speedMode === 'FAST' ? 4 : 2;

    const baseFlags = applyYtFlags({
      noWarnings: true,
      output: `${sessionDir}/%(title)s.%(ext)s`,
      retries: 10,
      fragmentRetries: 10,
      concurrentFragments: concurrentFragments,
      bufferSize: '16K',
      httpChunkSize: '10M'
    });

    const audioQualityMap = {
      '64k': '6',
      '128k': '4',
      '192k': '2',
      '320k': '0'
    };

    const maxHeight = Number.parseInt(String(quality).replace('p', ''), 10);
    const defaultFormatFlags = isAudio
      ? {
          extractAudio: true,
          audioFormat: 'mp3',
          audioQuality: audioQualityMap[quality] ?? '5'
        }
      : {
          // Prefer separate best video + audio so 2K/4K are available, then merge.
          format: `bestvideo[height<=${maxHeight}][vcodec!=none]+bestaudio[acodec!=none]/best[height<=${maxHeight}][vcodec!=none][acodec!=none]`,
          mergeOutputFormat: 'mp4',
          recodeVideo: 'mp4'
        };

    const flags = { ...baseFlags, ...defaultFormatFlags };

    // Concurrency
    const parallelLimit = speedMode === 'TURBO' ? 4 : speedMode === 'FAST' ? 2 : 1;

    let active = 0;
    let index = 0;
    let completed = 0;

    const runNext = async () => {
      if (index >= videos.length) {
        if (active === 0) {
          socket.emit('playlist_complete', {
            downloadUrl: `/api/download/${socketId}`
          });
        }
        return;
      }

      const video = videos[index++];
      active++;

      let perVideoFlags = flags;
      if (video && video.formatId) {
        const hasVideo = video.hasVideo === true;
        const hasAudio = video.hasAudio === true;

        if (hasVideo && hasAudio) {
          perVideoFlags = {
            ...baseFlags,
            format: video.formatId,
            mergeOutputFormat: 'mp4',
            recodeVideo: 'mp4'
          };
        } else if (hasVideo && !hasAudio) {
          perVideoFlags = {
            ...baseFlags,
            format: `${video.formatId}+bestaudio[acodec!=none]`,
            mergeOutputFormat: 'mp4',
            recodeVideo: 'mp4'
          };
        } else if (!hasVideo && hasAudio) {
          perVideoFlags = {
            ...baseFlags,
            format: video.formatId,
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: audioQualityMap[quality] ?? '5'
          };
        } else {
          perVideoFlags = {
            ...baseFlags,
            format: video.formatId,
            mergeOutputFormat: 'mp4',
            recodeVideo: 'mp4'
          };
        }
      }

      // We await the individual video download here
      await queueDownload(video, sessionDir, perVideoFlags, socket);

      active--;
      completed++;

      // Continue queue
      runNext();
    };

    // Start initial batch
    for (let i = 0; i < Math.min(parallelLimit, videos.length); i++) {
      runNext();
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
