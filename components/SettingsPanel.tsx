import React from 'react';
import { Settings, Zap, Video, Music, Activity } from 'lucide-react';
import { AppConfig, DownloadFormat, AudioQuality, VideoQuality, SpeedMode } from '../types';

interface SettingsPanelProps {
  config: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig>>;
  disabled: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, setConfig, disabled }) => {
  return (
    <div className="bg-dark-800/60 border border-ink-800/60 rounded-2xl p-5 sm:p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2 mb-6 text-neon-400">
        <Settings className="w-5 h-5" />
        <h3 className="font-semibold uppercase tracking-wider text-sm">Download Configuration</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Format Selector */}
        <div className="space-y-3">
          <label className="text-ink-400 text-xs font-bold uppercase tracking-wide">Format</label>
          <div className="flex bg-dark-900/70 rounded-xl p-1 border border-ink-800/70">
            <button
              onClick={() => setConfig(p => ({ ...p, format: DownloadFormat.AUDIO }))}
              disabled={disabled}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                config.format === DownloadFormat.AUDIO 
                  ? 'bg-dark-800 text-white shadow-sm' 
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <Music className="w-4 h-4" /> Audio
            </button>
            <button
              onClick={() => setConfig(p => ({ ...p, format: DownloadFormat.VIDEO }))}
              disabled={disabled}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                config.format === DownloadFormat.VIDEO 
                  ? 'bg-dark-800 text-white shadow-sm' 
                  : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <Video className="w-4 h-4" /> Video
            </button>
          </div>
        </div>

        {/* Quality Selector */}
        <div className="space-y-3">
          <label className="text-ink-400 text-xs font-bold uppercase tracking-wide">Quality</label>
          <select
            value={config.format === DownloadFormat.AUDIO ? config.audioQuality : config.videoQuality}
            onChange={(e) => {
              if (config.format === DownloadFormat.AUDIO) {
                setConfig(p => ({ ...p, audioQuality: e.target.value as AudioQuality }));
              } else {
                setConfig(p => ({ ...p, videoQuality: e.target.value as VideoQuality }));
              }
            }}
            disabled={disabled}
            className="w-full bg-dark-900/70 border border-ink-800/70 text-ink-100 text-sm rounded-xl focus:ring-electric-500 focus:border-electric-500 block p-2.5"
          >
            {config.format === DownloadFormat.AUDIO ? (
              <>
                <option value={AudioQuality.LOW}>64 kbps (Low)</option>
                <option value={AudioQuality.MEDIUM}>128 kbps (Standard)</option>
                <option value={AudioQuality.HIGH}>192 kbps (High)</option>
                <option value={AudioQuality.ULTRA}>320 kbps (Ultra)</option>
              </>
            ) : (
              <>
                <option value={VideoQuality.P360}>360p (Data Saver)</option>
                <option value={VideoQuality.P480}>480p (SD)</option>
                <option value={VideoQuality.P720}>720p (HD)</option>
                <option value={VideoQuality.P1080}>1080p (Full HD)</option>
                <option value={VideoQuality.P1440}>1440p (2K)</option>
                <option value={VideoQuality.P2160}>2160p (4K)</option>
              </>
            )}
          </select>
        </div>

        {/* Speed Selector */}
        <div className="space-y-3">
          <label className="text-ink-400 text-xs font-bold uppercase tracking-wide flex justify-between">
            Speed Mode
            {config.speedMode === SpeedMode.TURBO && (
              <span className="text-neon-400 flex items-center gap-1 text-[10px] animate-pulse">
                <Zap className="w-3 h-3" /> BD Optimized
              </span>
            )}
          </label>
          <div className="relative">
            <select
              value={config.speedMode}
              onChange={(e) => setConfig(p => ({ ...p, speedMode: e.target.value as SpeedMode }))}
              disabled={disabled}
              className={`w-full bg-dark-900/70 border text-sm rounded-xl block p-2.5 appearance-none ${
                config.speedMode === SpeedMode.TURBO 
                  ? 'border-neon-500/50 text-neon-400 shadow-[0_0_12px_rgba(46,229,157,0.15)]' 
                  : 'border-ink-800/70 text-ink-100'
              }`}
            >
              <option value={SpeedMode.NORMAL}>Normal (Safe)</option>
              <option value={SpeedMode.FAST}>Fast (Parallel)</option>
              <option value={SpeedMode.TURBO}>Turbo (Aggressive)</option>
            </select>
            <Activity className={`absolute right-3 top-3 w-4 h-4 pointer-events-none ${config.speedMode === SpeedMode.TURBO ? 'text-neon-500' : 'text-ink-500'}`} />
          </div>
        </div>
      </div>
    </div>
  );
};
