import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, 
  Youtube, 
  AlertCircle, 
  FileArchive, 
  Wifi, 
  Zap, 
  ShieldCheck, 
  Info 
} from 'lucide-react';
import { Button } from './components/Button';
import { SettingsPanel } from './components/SettingsPanel';
import { VideoList } from './components/VideoList';
import { ProgressBar } from './components/ProgressBar';
import { fetchPlaylistInfo, fetchVideoFormats, fetchFfmpegStatus, DownloadSocket } from './services/api';
import { AppConfig, AudioQuality, DownloadFormat, SpeedMode, VideoItem, VideoQuality, PlaylistStats } from './types';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'input' | 'preview' | 'downloading' | 'finished'>('input');
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [downloadStartedAt, setDownloadStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const downloadStartedAtRef = useRef<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formatLoadingIds, setFormatLoadingIds] = useState<Set<string>>(new Set());
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  
  const [config, setConfig] = useState<AppConfig>({
    format: DownloadFormat.VIDEO,
    audioQuality: AudioQuality.ULTRA,
    videoQuality: VideoQuality.P2160,
    speedMode: SpeedMode.TURBO,
    concurrentDownloads: 3
  });

  const [playlistItems, setPlaylistItems] = useState<VideoItem[]>([]);
  const socketRef = useRef<DownloadSocket | null>(null);

  // Computed stats
  const completedCount = playlistItems.filter(i => i.status === 'completed').length;
  const totalProgress = playlistItems.length > 0 
    ? playlistItems.reduce((acc, curr) => acc + (curr.status === 'completed' ? 100 : curr.progress), 0) / playlistItems.length 
    : 0;

  const activeDownloads = playlistItems.filter(i => i.status === 'downloading');
  const currentSpeed = activeDownloads.length > 0 
    ? activeDownloads.map(i => parseFloat(i.speed) || 0).reduce((a, b) => a + b, 0).toFixed(1) + ' MiB/s'
    : '0 MiB/s';

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  };

  const pickBestFormatId = (formats: VideoItem['formats']) => {
    if (!formats || formats.length === 0) return undefined;
    if (config.format === DownloadFormat.AUDIO) {
      const audioOnly = formats.filter(format => format.hasAudio && !format.hasVideo);
      if (audioOnly.length === 0) return undefined;
      audioOnly.sort((a, b) => {
        const aScore = (a.tbr ?? 0) + (a.filesize ?? 0) / 1_000_000;
        const bScore = (b.tbr ?? 0) + (b.filesize ?? 0) / 1_000_000;
        return bScore - aScore;
      });
      return audioOnly[0].id;
    }

    const bestByHeight = new Map<number, typeof formats[number]>();
    const candidates = formats.filter(format => format.hasVideo && format.height);
    if (candidates.length === 0) return undefined;
    for (const format of candidates) {
      const height = format.height as number;
      const current = bestByHeight.get(height);
      if (!current) {
        bestByHeight.set(height, format);
        continue;
      }
      const score = (item: typeof format) => {
        const extBonus = item.ext?.toLowerCase() === 'mp4' ? 1000 : 0;
        const fps = item.fps ?? 0;
        const tbr = item.tbr ?? 0;
        const size = (item.filesize ?? 0) / 1_000_000;
        return extBonus + fps * 10 + tbr + size;
      };
      if (score(format) > score(current)) {
        bestByHeight.set(height, format);
      }
    }

    const sorted = Array.from(bestByHeight.values()).sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    return sorted[0]?.id;
  };

  const handleFetchInfo = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchPlaylistInfo(url);
      setPlaylistItems(items);
      setFormatLoadingIds(new Set());
      setSelectedIds(new Set(items.map(item => item.id)));
      setPhase('preview');
    } catch (err) {
      setError("Could not fetch playlist. Ensure the URL is public and valid.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartDownload = () => {
    const selectedItems = playlistItems.filter(item => selectedIds.has(item.id));
    if (selectedItems.length === 0) {
      setError('Select at least one item to download.');
      return;
    }
    const hasMissingFormat = selectedItems.some(item => item.formats && item.formats.length > 0 && !item.selectedFormatId);
    if (hasMissingFormat) {
      setError('Choose a format for each loaded item.');
      return;
    }
    setPlaylistItems(selectedItems);
    setSelectedIds(new Set(selectedItems.map(item => item.id)));
    const startedAt = Date.now();
    setDownloadStartedAt(startedAt);
    downloadStartedAtRef.current = startedAt;
    setElapsedMs(0);
    setPhase('downloading');
    
    // Initialize socket connection
    socketRef.current = new DownloadSocket();
    socketRef.current.connect();

    socketRef.current.startDownload(
      selectedItems,
      config,
      // On Progress
      (data) => {
        setPlaylistItems(prev => prev.map(item => {
          if (item.id === data.videoId) {
            return {
              ...item,
              status: 'downloading',
              progress: data.progress,
              speed: data.speed,
              eta: data.eta
            };
          }
          return item;
        }));
      },
      // On Video Complete
      (data) => {
        setPlaylistItems(prev => prev.map(item => {
          if (item.id === data.videoId) {
            return { ...item, status: 'completed', progress: 100, speed: '-', eta: '-' };
          }
          return item;
        }));
      },
      // On All Complete
      (data) => {
        setPhase('finished');
        setDownloadUrl(data.downloadUrl);
        if (downloadStartedAtRef.current) {
          setElapsedMs(Date.now() - downloadStartedAtRef.current);
        }
        socketRef.current?.disconnect();
      },
      // On Error
      (msg) => {
        setError(msg);
        socketRef.current?.disconnect();
      }
    );
  };

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchFfmpegStatus()
      .then((data) => setFfmpegAvailable(data.available))
      .catch(() => setFfmpegAvailable(null));
  }, []);

  useEffect(() => {
    if (phase !== 'downloading' || downloadStartedAt === null) return;
    const intervalId = setInterval(() => {
      setElapsedMs(Date.now() - downloadStartedAt);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [phase, downloadStartedAt]);

  const handleDownloadZip = () => {
    if (downloadUrl) {
      window.location.href = `http://localhost:3001${downloadUrl}`;
    }
  };

  const handleLoadFormats = async (id: string) => {
    if (formatLoadingIds.has(id)) return;
    setFormatLoadingIds(prev => new Set(prev).add(id));
    try {
      const formats = await fetchVideoFormats(id);
      setPlaylistItems(prev => prev.map(item => {
        if (item.id !== id) return item;
        const bestFormatId = pickBestFormatId(formats);
        return { ...item, formats, selectedFormatId: item.selectedFormatId ?? bestFormatId };
      }));
    } catch (err) {
      setError('Failed to load formats for this video.');
    } finally {
      setFormatLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSelectFormat = (id: string, formatId: string) => {
    setPlaylistItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, selectedFormatId: formatId };
    }));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-dark-900 text-ink-50 selection:bg-electric-500/30">
      <div className="pointer-events-none absolute -top-40 -left-40 h-80 w-80 rounded-full bg-electric-500/20 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute top-24 -right-24 h-96 w-96 rounded-full bg-neon-500/20 blur-3xl animate-float-fast" />
      <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.04),transparent_40%)]" />

      <div className="relative">
        {/* Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-dark-900/70 border-b border-ink-900/60">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-electric-600 to-neon-500 p-2 shadow-lg shadow-electric-600/30 animate-glow">
                <Download className="w-5 h-5 text-dark-900" />
              </div>
              <div>
                <div className="font-semibold text-lg tracking-tight text-white">
                  Turbo<span className="text-neon-400">Playlist</span>
                </div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-ink-500 font-mono">Batch media engine</div>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-ink-300">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-ink-800/60 bg-dark-800/60">
                <Wifi className="w-3 h-3 text-electric-400" /> Made by PRONOB
              </span>
              <span className="px-2 py-1 rounded-full border border-ink-800/60 bg-dark-800/60">v2.4.0</span>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10">
          
          {/* Hero & Input */}
          <section className="space-y-6 sm:space-y-8">
            <div className="grid gap-6 sm:gap-8 md:grid-cols-[1.4fr_1fr] items-center">
              <div className="space-y-5 animate-fade-up text-center md:text-left">
                <div className="inline-flex items-center gap-2 text-xs font-mono text-ink-300 bg-dark-800/70 border border-ink-800/60 px-3 py-1 rounded-full">
                  <span className="h-2 w-2 rounded-full bg-neon-500 animate-pulse"></span>
                  Turbo-ready downloads
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white leading-tight">
                  Download playlists and single videos
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-electric-400 to-neon-400">
                    with studio-grade speed
                  </span>
                </h1>
                <p className="text-ink-400 text-sm sm:text-base md:text-lg max-w-xl mx-auto md:mx-0">
                  Built for unstable networks and high volume queues. Auto-retries, adaptive chunking,
                  and parallel streams tuned for real-world reliability.
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 text-xs text-ink-300">
                  <span className="px-3 py-1 rounded-full border border-ink-800/60 bg-dark-800/50">4K ready</span>
                  <span className="px-3 py-1 rounded-full border border-ink-800/60 bg-dark-800/50">Smart retries</span>
                  <span className="px-3 py-1 rounded-full border border-ink-800/60 bg-dark-800/50">Batch ZIP export</span>
                </div>
              </div>

              <div className="bg-dark-800/60 border border-ink-800/60 rounded-2xl p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Session Overview</div>
                  <span className="text-xs font-mono text-ink-400">Live</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-dark-900/60 border border-ink-800/60 p-3">
                    <div className="text-xs text-ink-400 uppercase">Queue</div>
                    <div className="text-lg font-semibold text-white">{playlistItems.length}</div>
                  </div>
                  <div className="rounded-xl bg-dark-900/60 border border-ink-800/60 p-3">
                    <div className="text-xs text-ink-400 uppercase">Completed</div>
                    <div className="text-lg font-semibold text-white">{completedCount}</div>
                  </div>
                  <div className="rounded-xl bg-dark-900/60 border border-ink-800/60 p-3 col-span-2">
                    <div className="text-xs text-ink-400 uppercase">Current Speed</div>
                    <div className="text-lg font-semibold text-neon-400">{currentSpeed}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative max-w-3xl mx-auto group animate-fade-up">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-electric-600 to-neon-500 rounded-2xl opacity-25 group-hover:opacity-45 blur transition duration-500"></div>
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-2 bg-dark-800/80 rounded-2xl p-2 shadow-2xl border border-ink-800/70">
                <div className="pl-3 flex items-center pointer-events-none text-ink-500">
                  <Youtube className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  placeholder="Paste a YouTube playlist or single video URL..."
                  className="flex-1 w-full bg-transparent border-none focus:ring-0 text-white placeholder-ink-500 px-4 py-2"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={phase !== 'input' && phase !== 'preview'}
                />
                <Button 
                  onClick={handleFetchInfo} 
                  isLoading={loading}
                  disabled={phase !== 'input' && phase !== 'preview'}
                  className="w-full sm:w-auto"
                >
                  {phase === 'input' ? 'Analyze' : 'Refresh'}
                </Button>
              </div>
            </div>
            
            {error && (
              <div className="flex items-center justify-center gap-2 text-red-300 bg-red-900/20 py-2 px-4 rounded-xl border border-red-900/40 mx-auto max-w-md animate-pulse">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
          </section>

        {/* Configuration */}
        {phase !== 'input' && (
          <div className="space-y-6 animate-fade-up">
            <SettingsPanel 
              config={config} 
              setConfig={setConfig} 
              disabled={phase === 'downloading' || phase === 'finished'} 
            />
            {ffmpegAvailable === false && config.format === DownloadFormat.VIDEO && (
              <div className="flex items-center gap-2 text-amber-200 bg-amber-900/30 py-2 px-4 rounded-xl border border-amber-700/40">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  FFmpeg not detected. 2K/4K and video+audio merges will fail. Install FFmpeg to get a single file.
                </span>
              </div>
            )}

            {/* Dashboard or Preview */}
            <div className="bg-dark-800/70 rounded-2xl border border-ink-800/60 overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              {/* Stats Header */}
              <div className="bg-dark-900/60 p-4 border-b border-ink-800/60 flex flex-wrap gap-4 justify-between items-center">
                <div className="flex gap-6">
                  <div>
                    <div className="text-ink-400 text-xs font-bold uppercase">Videos</div>
                    <div className="text-white font-mono text-lg">
                      {phase === 'downloading' || phase === 'finished' ? completedCount : 0} 
                      <span className="text-ink-500">/</span> {playlistItems.length}
                    </div>
                  </div>
                  {(phase === 'downloading' || phase === 'finished') && (
                    <>
                      <div className="hidden sm:block">
                        <div className="text-ink-400 text-xs font-bold uppercase flex items-center gap-1">
                          Current Speed <Zap className="w-3 h-3 text-neon-500" />
                        </div>
                        <div className="text-neon-400 font-mono text-lg">{currentSpeed}</div>
                      </div>
                      <div className="hidden sm:block">
                        <div className="text-ink-400 text-xs font-bold uppercase">Total Time</div>
                        <div className="text-ink-50 font-mono text-lg">{formatDuration(elapsedMs)}</div>
                      </div>
                    </>
                  )}
                </div>
                
                {phase === 'preview' && (
                  <Button onClick={handleStartDownload} className="w-full sm:w-auto" disabled={selectedIds.size === 0}>
                    Download Selected ({selectedIds.size})
                  </Button>
                )}
                
                {phase === 'finished' && (
                  <Button onClick={handleDownloadZip} variant="primary" icon={<FileArchive className="w-4 h-4"/>}>
                    Download ZIP
                  </Button>
                )}
              </div>

              {/* Total Progress */}
              {(phase === 'downloading' || phase === 'finished') && (
                <div className="px-4 py-3 bg-dark-900/50 border-b border-ink-800/60">
                  <div className="flex justify-between text-xs text-ink-400 mb-1">
                    <span>Overall Progress</span>
                    <span>{phase === 'finished' ? 'Complete' : 'Downloading...'}</span>
                  </div>
                  <ProgressBar progress={totalProgress} height="h-3" color="bg-gradient-to-r from-neon-600 to-emerald-500" />
                </div>
              )}

              {/* List */}
              <div className="p-4 max-h-[520px] overflow-y-auto">
                <VideoList
                  items={playlistItems}
                  isAudio={config.format === DownloadFormat.AUDIO}
                  selectable={phase === 'preview'}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onLoadFormats={handleLoadFormats}
                  onSelectFormat={handleSelectFormat}
                  formatLoadingIds={formatLoadingIds}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <footer className="text-center text-ink-500 text-xs py-10 space-y-2">
          <div className="flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>All rights reserved || PRONOB</span>
          </div>
          <p className="flex items-center justify-center gap-1">
            <Info className="w-3 h-3" />
            Disclaimer: For personal use only.
          </p>
        </footer>
      </main>
    </div>
  </div>
  );
}

export default App;
