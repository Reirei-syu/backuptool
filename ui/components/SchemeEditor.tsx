import {
  CheckCircle2,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Info,
  Loader2,
  Play,
  Trash2,
} from 'lucide-react';
import { useRef } from 'react';
import { GlassCard } from '../../components/GlassCard';
import { BackupMode, BackupStatus, type BackupScheme, type BackupStats } from '../../types';

interface SchemeEditorProps {
  activeScheme: BackupScheme;
  isBusy: boolean;
  selectedCount: number;
  stats: BackupStats;
  status: BackupStatus;
  updateScheme: (updates: Partial<BackupScheme>) => void;
  requestAddSource: () => Promise<'fallback' | void>;
  requestSetDestination: () => Promise<'fallback' | void>;
  submitSourceFiles: (files: FileList | null) => void;
  submitDestinationFiles: (files: FileList | null) => void;
  startMultiBackup: () => Promise<void>;
}

export const SchemeEditor = ({
  activeScheme,
  isBusy,
  selectedCount,
  stats,
  status,
  updateScheme,
  requestAddSource,
  requestSetDestination,
  submitSourceFiles,
  submitDestinationFiles,
  startMultiBackup,
}: SchemeEditorProps) => {
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  const handleAddSource = async () => {
    const result = await requestAddSource();
    if (result === 'fallback') {
      sourceInputRef.current?.click();
    }
  };

  const handleSetDestination = async () => {
    const result = await requestSetDestination();
    if (result === 'fallback') {
      destinationInputRef.current?.click();
    }
  };

  return (
    <div className="lg:col-span-6 flex flex-col gap-6">
      <input
        type="file"
        ref={sourceInputRef}
        onChange={(event) => {
          submitSourceFiles(event.target.files);
          event.target.value = '';
        }}
        className="hidden"
        {...({ webkitdirectory: '' } as any)}
        multiple
      />

      <input
        type="file"
        ref={destinationInputRef}
        onChange={(event) => {
          submitDestinationFiles(event.target.files);
          event.target.value = '';
        }}
        className="hidden"
        {...({ webkitdirectory: '' } as any)}
        multiple
      />

      <div className="bg-white/80 backdrop-blur-xl p-2 rounded-2xl border border-sky-100 shadow-lg flex gap-1">
        <button
          onClick={() => updateScheme({ mode: BackupMode.INCREMENTAL })}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            activeScheme.mode === BackupMode.INCREMENTAL
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-100'
              : 'text-slate-500 hover:bg-sky-50'
          }`}
        >
          增量备份
        </button>
        <button
          onClick={() => updateScheme({ mode: BackupMode.MIRROR })}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            activeScheme.mode === BackupMode.MIRROR
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
              : 'text-slate-500 hover:bg-sky-50'
          }`}
        >
          镜像备份
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white/80 p-4 rounded-3xl border border-sky-100 shadow-md">
        <input
          type="text"
          value={activeScheme.name}
          onChange={(event) => updateScheme({ name: event.target.value })}
          className="flex-1 bg-transparent text-xl font-bold text-slate-800 focus:outline-none"
          placeholder="方案名称..."
        />
        <CheckCircle2
          className={`w-6 h-6 ${
            activeScheme.sources.length > 0 && activeScheme.destination ? 'text-sky-500' : 'text-slate-200'
          }`}
        />
      </div>

      <GlassCard
        title="源文件夹"
        icon={<FolderOpen className="text-sky-500" />}
        actions={
          <button
            onClick={handleAddSource}
            className="bg-sky-500 text-white p-2.5 rounded-xl shadow-lg shadow-sky-100 hover:scale-105 transition-transform"
          >
            <FolderPlus className="w-5 h-5" />
          </button>
        }
      >
        <div className="min-h-[140px] max-h-[200px] overflow-y-auto pr-2 space-y-3 mt-2">
          {activeScheme.sources.map((folder) => (
            <div key={folder.id} className="flex items-center justify-between p-3 rounded-xl bg-white/85 border border-sky-100">
              <div className="flex items-center gap-3 overflow-hidden">
                <FolderOpen className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="text-sm font-bold text-slate-700 truncate">{folder.name}</span>
              </div>
              <button
                onClick={() =>
                  updateScheme({
                    sources: activeScheme.sources.filter((source) => source.id !== folder.id),
                  })
                }
                className="text-slate-300 hover:text-sky-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {activeScheme.sources.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 border border-dashed rounded-xl gap-2 px-6 text-center">
              <span className="text-slate-300 text-xs">点击右上角按钮添加源文件夹</span>
              <div className="flex gap-1.5 items-start text-[10px] text-sky-700 bg-sky-50 px-2 py-1 rounded border border-sky-100">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                <span>浏览器限制下无法直接选择桌面或磁盘根目录，请优先选择子文件夹。</span>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard
        title="目标位置"
        icon={<HardDrive className="text-indigo-500" />}
        actions={
          <button
            onClick={handleSetDestination}
            className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-100 hover:scale-105 transition-transform"
          >
            <HardDrive className="w-5 h-5" />
          </button>
        }
      >
        <div className="mt-2">
          {activeScheme.destination ? (
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100">
              <HardDrive className="w-6 h-6 text-indigo-500" />
              <div className="flex-1 overflow-hidden">
                <div className="font-bold text-sm text-slate-700">{activeScheme.destination.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{activeScheme.destination.pathLabel}</div>
              </div>
            </div>
          ) : (
            <div className="h-24 flex items-center justify-center text-slate-300 text-xs border border-dashed rounded-xl">
              尚未设置目标路径
            </div>
          )}
        </div>
      </GlassCard>

      <div className="bg-white p-6 rounded-[2rem] border border-sky-100 shadow-2xl shadow-sky-100/40">
        {isBusy ? (
          <div className="w-full h-16 rounded-[1.2rem] bg-slate-900/5 p-1.5 relative overflow-hidden transition-all duration-500">
            <div className="relative w-full h-full rounded-[1rem] overflow-hidden bg-slate-100 shadow-inner">
              <div
                className="absolute inset-0 w-full h-full animate-rainbow"
                style={{
                  background: 'linear-gradient(90deg, #7dd3fc, #60a5fa, #4f46e5, #60a5fa, #7dd3fc)',
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
              <div className="absolute inset-0 flex items-center justify-center gap-3 text-white font-black text-lg drop-shadow-[0_2px_2px_rgba(0,0,0,0.15)]">
                <Loader2 className="animate-spin w-5 h-5 text-white" />
                <span className="tracking-wide">
                  正在处理... {stats.processedFiles > 0 ? `${stats.processedFiles} / ${stats.totalFiles}` : '准备中'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button
              disabled={selectedCount === 0}
              onClick={() => {
                void startMultiBackup();
              }}
              className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-lg shadow-xl shadow-sky-200 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-3 hover:shadow-sky-200/50 hover:-translate-y-0.5"
            >
              <Play className="fill-current w-6 h-6" />
              执行勾选的 {selectedCount} 个任务
            </button>

            {status === BackupStatus.ERROR && (
              <p className="mt-3 text-xs text-amber-600 text-center">本次执行包含失败或跳过项，请查看运行日志。</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};
