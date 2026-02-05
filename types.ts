export interface VideoItem {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  status: 'pending' | 'preparing' | 'downloading' | 'converting' | 'completed' | 'error';
  progress: number;
  size: string;
  speed: string; // e.g., "5.2 MB/s"
  eta: string; // e.g., "30s"
  formats?: VideoFormatOption[];
  selectedFormatId?: string;
}

export interface VideoFormatOption {
  id: string;
  ext: string;
  height?: number;
  fps?: number;
  filesize?: number;
  tbr?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  note?: string;
}

export interface PlaylistStats {
  totalVideos: number;
  completedVideos: number;
  totalSize: string;
  totalProgress: number;
  elapsedTime: string;
  estimatedTotalTime: string;
  currentSpeed: string;
}

export enum DownloadFormat {
  AUDIO = 'audio',
  VIDEO = 'video'
}

export enum AudioQuality {
  LOW = '64k',
  MEDIUM = '128k',
  HIGH = '192k',
  ULTRA = '320k'
}

export enum VideoQuality {
  P360 = '360p',
  P480 = '480p',
  P720 = '720p',
  P1080 = '1080p',
  P1440 = '1440p',
  P2160 = '2160p'
}

export enum SpeedMode {
  NORMAL = 'NORMAL',
  FAST = 'FAST',
  TURBO = 'TURBO'
}

export interface AppConfig {
  format: DownloadFormat;
  audioQuality: AudioQuality;
  videoQuality: VideoQuality;
  speedMode: SpeedMode;
  concurrentDownloads: number;
}
