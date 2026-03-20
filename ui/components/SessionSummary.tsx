import { BookOpen, History, ScrollText } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import type { BackupStats } from '../../types';

interface SessionSummaryProps {
  stats: BackupStats;
  onShowLogs: () => void;
}

export const SessionSummary = ({ stats, onShowLogs }: SessionSummaryProps) => {
  return (
    <div className="lg:col-span-3 flex flex-col gap-6">
      <GlassCard title="会话统计" icon={<History className="text-sky-600" />}>
        <div className="space-y-3">
          <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500 font-bold">更新文件</span>
            <span className="text-sm font-black text-sky-600">{stats.copiedFiles}</span>
          </div>
          <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500 font-bold">镜像清理</span>
            <span className="text-sm font-black text-indigo-500">{stats.deletedFiles}</span>
          </div>
          <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500 font-bold">传输数据</span>
            <span className="text-sm font-black text-slate-700">{(stats.bytesCopied / 1024 / 1024).toFixed(2)} MB</span>
          </div>
        </div>
        <button
          onClick={onShowLogs}
          className="mt-4 w-full py-3 rounded-xl bg-sky-950 text-slate-100 text-xs font-bold hover:bg-sky-900 transition-all flex items-center justify-center gap-2"
        >
          <ScrollText className="w-4 h-4" />
          查看运行日志
        </button>
      </GlassCard>

      <GlassCard title="模式说明" icon={<BookOpen className="text-indigo-500" />}>
        <div className="space-y-4 text-[11px] leading-relaxed text-slate-600">
          <p>
            <b className="text-sky-600">增量备份：</b>
            仅新增或替换。目标文件夹中原有的多余文件会原样保留，适合累计存档。
          </p>
          <p>
            <b className="text-indigo-500">镜像备份：</b>
            严格同步。目标文件夹会删除一切在源中不存在的内容，使其与源完全一致，适合同步备份。
          </p>
          <hr className="opacity-50" />
          <p className="text-slate-400 font-medium italic">* 方案支持多选运行，各方案模式独立生效。</p>
        </div>
      </GlassCard>
    </div>
  );
};
