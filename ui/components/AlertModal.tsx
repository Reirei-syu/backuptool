import { AlertTriangle } from 'lucide-react';
import type { AlertInfo } from '../hooks/useBackupWorkspace';

interface AlertModalProps {
  alertInfo: AlertInfo | null;
  onClose: () => void;
}

export const AlertModal = ({ alertInfo, onClose }: AlertModalProps) => {
  if (!alertInfo?.show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border-2 border-rose-100">
        <div className="flex items-center gap-3 text-rose-500 mb-3">
          <AlertTriangle className="w-6 h-6" />
          <h3 className="text-lg font-bold">{alertInfo.title}</h3>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line mb-6">
          {alertInfo.message}
        </p>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
        >
          我知道了
        </button>
      </div>
    </div>
  );
};
