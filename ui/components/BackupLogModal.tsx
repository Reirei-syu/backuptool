import { Layers, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../types';

interface BackupLogModalProps {
  logs: LogEntry[];
  show: boolean;
  onClose: () => void;
}

export const BackupLogModal = ({ logs, show, onClose }: BackupLogModalProps) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, show]);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sky-950/32 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-[80vh] flex flex-col glass-modal overflow-hidden">
        <div className="flex items-center justify-between p-4 glass-header">
          <h3 className="text-sky-700 font-bold flex items-center gap-2 font-mono text-sm">
            <Layers className="w-4 h-4" />
            BATCH_BACKUP_CONSOLE
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/50 text-slate-500 hover:text-sky-700 transition-colors border border-white/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-2 font-mono text-[11px] scroll-smooth">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`flex gap-3 border-b border-white/50 pb-1 ${
                log.type === 'error'
                  ? 'text-rose-700'
                  : log.type === 'success'
                    ? 'text-sky-700'
                    : log.type === 'warning'
                      ? 'text-amber-700'
                      : log.type === 'delete'
                        ? 'text-indigo-700'
                        : 'text-slate-600'
              }`}
            >
              <span className="opacity-70 shrink-0 w-16">[{log.timestamp.toLocaleTimeString()}]</span>
              <span className="break-all">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};
