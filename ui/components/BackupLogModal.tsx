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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl h-[80vh] flex flex-col bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <h3 className="text-emerald-400 font-bold flex items-center gap-2 font-mono text-sm">
            <Layers className="w-4 h-4" />
            BATCH_BACKUP_CONSOLE
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-2 font-mono text-[11px] bg-slate-900/95 scroll-smooth">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`flex gap-3 border-b border-white/5 pb-1 ${
                log.type === 'error'
                  ? 'text-rose-400'
                  : log.type === 'success'
                    ? 'text-emerald-400'
                    : log.type === 'warning'
                      ? 'text-amber-400'
                      : log.type === 'delete'
                        ? 'text-rose-300'
                        : 'text-slate-300'
              }`}
            >
              <span className="opacity-30 shrink-0 w-16">[{log.timestamp.toLocaleTimeString()}]</span>
              <span className="break-all">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
};
