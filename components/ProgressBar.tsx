import React from 'react';

interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: string;
  showText?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  color = "bg-neon-500", 
  height = "h-2",
  showText = false
}) => {
  return (
    <div className="w-full">
      <div className={`w-full bg-dark-900/70 rounded-full overflow-hidden ${height}`}>
        <div 
          className={`${height} ${color} transition-all duration-300 ease-out`} 
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      {showText && (
        <div className="flex justify-between mt-1 text-xs text-ink-400 font-mono">
          <span>{progress.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};
