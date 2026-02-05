import React from 'react';
import { VideoItem, VideoFormatOption } from '../types';
import { CheckCircle2, AlertCircle, Loader2, PlayCircle, Film, Music } from 'lucide-react';
import { ProgressBar } from './ProgressBar';

interface VideoListProps {
  items: VideoItem[];
  isAudio: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onLoadFormats?: (id: string) => void;
  onSelectFormat?: (id: string, formatId: string) => void;
  formatLoadingIds?: Set<string>;
}

export const VideoList: React.FC<VideoListProps> = ({
  items,
  isAudio,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onLoadFormats,
  onSelectFormat,
  formatLoadingIds
}) => {
  const formatBytes = (bytes?: number) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatLabel = (format: VideoFormatOption) => {
    const parts: string[] = [];
    if (format.height) parts.push(`${format.height}p`);
    if (format.fps) parts.push(`${format.fps}fps`);
    if (format.ext) parts.push(format.ext.toUpperCase());
    if (format.hasVideo && format.hasAudio) parts.push('A/V');
    else if (format.hasVideo) parts.push('Video');
    else if (format.hasAudio) parts.push('Audio');
    if (format.tbr) parts.push(`${Math.round(format.tbr)}kbps`);
    const size = formatBytes(format.filesize);
    if (size) parts.push(size);
    if (format.note) parts.push(format.note);
    return parts.join(' · ');
  };
  const getStatusIcon = (status: VideoItem['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-neon-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'downloading': 
      case 'converting':
        return <Loader2 className="w-5 h-5 text-neon-400 animate-spin" />;
      default: return <div className="w-5 h-5 rounded-full border-2 border-slate-700" />;
    }
  };

  const getStatusText = (item: VideoItem) => {
    switch (item.status) {
      case 'completed': return 'Done';
      case 'error': return 'Failed';
      case 'downloading': return `${item.speed} | ETA ${item.eta}`;
      case 'converting': return 'Converting...';
      case 'preparing': return 'Queued';
      default: return 'Pending';
    }
  };

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div className="flex gap-3 items-center" key={item.id}>
          {selectable && (
            <input
              type="checkbox"
              className="w-4 h-4 accent-electric-500 cursor-pointer"
              checked={selectedIds?.has(item.id) ?? false}
              onChange={() => onToggleSelect?.(item.id)}
            />
          )}
        <div 
          className="flex-1 bg-dark-800/50 border border-ink-800/60 rounded-xl p-3 hover:bg-dark-800/70 transition-colors flex gap-4 items-center group"
        >
          {/* Thumbnail */}
          <div className="relative w-24 h-16 shrink-0 rounded-lg overflow-hidden bg-dark-900/80">
            <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-1 right-1 bg-dark-900/80 text-[10px] px-1 rounded text-ink-50 font-mono">
              {item.duration}
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-dark-900/40">
              {isAudio ? <Music className="w-6 h-6 text-white" /> : <PlayCircle className="w-6 h-6 text-white" />}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <h4 className="text-sm font-medium text-ink-50 truncate pr-4" title={item.title}>{item.title}</h4>
              <span className="text-xs text-ink-500 font-mono shrink-0">{item.size}</span>
            </div>
            
            <div className="flex items-center gap-3 mb-1.5">
              {getStatusIcon(item.status)}
              <span className={`text-xs font-mono ${item.status === 'error' ? 'text-red-400' : 'text-ink-400'}`}>
                {getStatusText(item)}
              </span>
            </div>

            {/* Progress */}
            {(item.status === 'downloading' || item.status === 'converting' || item.status === 'completed') && (
              <ProgressBar 
                progress={item.progress} 
                height="h-1" 
                color={item.status === 'completed' ? 'bg-neon-600' : 'bg-neon-500'} 
              />
            )}

            {selectable && (
              <div className="mt-2">
                {item.formats && item.formats.length > 0 ? (
                  <select
                    value={item.selectedFormatId ?? ''}
                    onChange={(e) => onSelectFormat?.(item.id, e.target.value)}
                    className="w-full bg-dark-900/70 border border-ink-800/70 text-ink-100 text-xs rounded-lg focus:ring-electric-500 focus:border-electric-500 block p-2"
                  >
                    <option value="" disabled>Select a format</option>
                    {item.formats.map((format) => (
                      <option key={format.id} value={format.id}>
                        {formatLabel(format)} (id: {format.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => onLoadFormats?.(item.id)}
                    disabled={formatLoadingIds?.has(item.id)}
                    className="text-xs text-ink-300 border border-ink-800/70 rounded-lg px-3 py-2 hover:bg-dark-900/60 transition disabled:opacity-50"
                  >
                    {formatLoadingIds?.has(item.id) ? 'Loading formats…' : 'Load formats'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      ))}
    </div>
  );
};
