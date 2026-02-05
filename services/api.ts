import { io, Socket } from 'socket.io-client';
import { VideoItem, AppConfig, DownloadFormat, SpeedMode, VideoFormatOption } from '../types';

const API_URL = 'http://localhost:3001';

export const fetchPlaylistInfo = async (url: string): Promise<VideoItem[]> => {
  const response = await fetch(`${API_URL}/api/info?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch playlist info');
  }
  return response.json();
};

export const fetchVideoFormats = async (videoId: string): Promise<VideoFormatOption[]> => {
  const response = await fetch(`${API_URL}/api/formats/${encodeURIComponent(videoId)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch video formats');
  }
  return response.json();
};

export class DownloadSocket {
  private socket: Socket;

  constructor() {
    this.socket = io(API_URL);
    this.socket.on('connect', () => console.log('Socket connected'));
    this.socket.on('disconnect', () => console.log('Socket disconnected'));
    this.socket.on('connect_error', (err) => console.error('Socket connection error:', err));
  }

  connect() {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  startDownload(
    videos: VideoItem[],
    config: AppConfig,
    onProgress: (data: { videoId: string; progress: number; speed: string; eta: string }) => void,
    onVideoComplete: (data: { videoId: string }) => void,
    onAllComplete: (data: { downloadUrl: string }) => void,
    onError: (msg: string) => void
  ) {
    // Transform videos to simple ID list for backend
    const videoIds = videos.map(v => {
      const selected = v.formats?.find(f => f.id === v.selectedFormatId);
      return {
        id: v.id,
        title: v.title,
        formatId: selected?.id || null,
        hasVideo: selected?.hasVideo ?? null,
        hasAudio: selected?.hasAudio ?? null,
        ext: selected?.ext || null
      };
    });

    console.log('Starting download for', videoIds.length, 'videos');

    this.socket.emit('start_download', {
      videos: videoIds,
      format: config.format,
      quality: config.format === DownloadFormat.AUDIO ? config.audioQuality : config.videoQuality,
      speedMode: config.speedMode
    });

    this.socket.on('progress_update', (data) => {
      // console.log('Progress:', data); // Uncomment for verbose debugging
      onProgress(data);
    });
    
    this.socket.on('video_complete', (data) => {
      console.log('Video complete:', data.videoId);
      onVideoComplete(data);
    });
    
    this.socket.on('playlist_complete', (data) => {
      console.log('All complete');
      onAllComplete(data);
    });
    
    this.socket.on('error', (data) => {
      console.error('Download error:', data);
      onError(data.message);
    });
  }

  disconnect() {
    this.socket.disconnect();
    this.socket.removeAllListeners();
  }
}
