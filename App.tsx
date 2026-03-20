import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  FolderOpen,
  FolderPlus,
  HardDrive,
  History,
  Info,
  Layers,
  Loader2,
  Play,
  PlusCircle,
  ScrollText,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { GlassCard } from './components/GlassCard';
import { BackupMode, BackupStatus, type BackupScheme, type BackupStats, type FolderItem, type LogEntry } from './types';
import { runBackupSchemes } from './services/backupExecutionService';
import { convertFileListToHandle, isFileSystemApiSupported } from './utils/compatibility';
import { loadSchemesFromDB, saveSchemesToDB } from './utils/storage';

const createEmptyStats = (): BackupStats => ({
  totalFiles: 0,
  processedFiles: 0,
  copiedFiles: 0,
  skippedFiles: 0,
  bytesCopied: 0,
  deletedFiles: 0,
});

const createDefaultScheme = (): BackupScheme => ({
  id: 'default',
  name: '我的重要备份',
  sources: [],
  destination: null,
  lastRun: null,
  mode: BackupMode.INCREMENTAL,
});

const createFolderItem = (
  name: string,
  handle: FileSystemDirectoryHandle,
  pathLabel: string,
): FolderItem => ({
  id: Math.random().toString(36).slice(2, 11),
  name,
  handle,
  pathLabel,
});

interface PermissionCapableHandle {
  queryPermission: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

const App: React.FC = () => {
  const [schemes, setSchemes] = useState<BackupScheme[]>([]);
  const [activeSchemeId, setActiveSchemeId] = useState('');
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<Set<string>>(new Set());
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isCompatible, setIsCompatible] = useState(true);

  const [status, setStatus] = useState<BackupStatus>(BackupStatus.IDLE);
  const [stats, setStats] = useState<BackupStats>(createEmptyStats());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ show: boolean; title: string; message: string } | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setIsCompatible(isFileSystemApiSupported());

      try {
        const loadedSchemes = await loadSchemesFromDB();
        if (cancelled) return;

        const nextSchemes = loadedSchemes.length > 0 ? loadedSchemes : [createDefaultScheme()];
        setSchemes(nextSchemes);
        setActiveSchemeId(nextSchemes[0].id);
        setSelectedSchemeIds(new Set([nextSchemes[0].id]));
      } catch (error) {
        console.error(error);
        if (cancelled) return;

        const fallbackScheme = createDefaultScheme();
        setSchemes([fallbackScheme]);
        setActiveSchemeId(fallbackScheme.id);
        setSelectedSchemeIds(new Set([fallbackScheme.id]));
        setAlertInfo({
          show: true,
          title: '数据加载失败',
          message: '本地方案读取失败，已回退到默认方案。你仍然可以继续使用当前会话。',
        });
      } finally {
        if (!cancelled) {
          setIsDataLoaded(true);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;

    void saveSchemesToDB(schemes).catch((error) => {
      console.error(error);
    });
  }, [isDataLoaded, schemes]);

  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  const activeScheme = schemes.find((scheme) => scheme.id === activeSchemeId) ?? schemes[0];
  const isBusy = status === BackupStatus.SCANNING || status === BackupStatus.COPYING;

  const verifyPermission = async (handle: unknown, mode: 'read' | 'readwrite') => {
    if (!handle || typeof handle !== 'object' || !('queryPermission' in handle)) {
      return true;
    }

    try {
      const permissionHandle = handle as PermissionCapableHandle;
      if ((await permissionHandle.queryPermission({ mode })) === 'granted') {
        return true;
      }
      if ((await permissionHandle.requestPermission({ mode })) === 'granted') {
        return true;
      }
    } catch (error) {
      console.error(error);
    }

    return false;
  };

  const handleUpdateScheme = (updates: Partial<BackupScheme>) => {
    setSchemes((previous) =>
      previous.map((scheme) => (scheme.id === activeSchemeId ? { ...scheme, ...updates } : scheme)),
    );
  };

  const handleAddScheme = () => {
    const newId = Math.random().toString(36).slice(2, 11);
    const newScheme: BackupScheme = {
      id: newId,
      name: `新方案 ${schemes.length + 1}`,
      sources: [],
      destination: null,
      lastRun: null,
      mode: BackupMode.INCREMENTAL,
    };

    setSchemes((previous) => [...previous, newScheme]);
    setActiveSchemeId(newId);
    setSelectedSchemeIds((previous) => new Set(previous).add(newId));
  };

  const handleDeleteScheme = (schemeId: string) => {
    if (schemes.length === 1 || isBusy) return;

    const nextSchemes = schemes.filter((scheme) => scheme.id !== schemeId);
    setSchemes(nextSchemes);

    if (activeSchemeId === schemeId) {
      setActiveSchemeId(nextSchemes[0].id);
    }

    setSelectedSchemeIds((previous) => {
      const nextSelection = new Set(previous);
      nextSelection.delete(schemeId);
      return nextSelection;
    });
  };

  const toggleSchemeSelection = (schemeId: string) => {
    setSelectedSchemeIds((previous) => {
      const nextSelection = new Set(previous);
      if (nextSelection.has(schemeId)) {
        nextSelection.delete(schemeId);
      } else {
        nextSelection.add(schemeId);
      }
      return nextSelection;
    });
  };

  const handleFileSystemError = (error: any) => {
    if (error?.name === 'AbortError') return;

    if (error?.name === 'SecurityError' || error?.name === 'NotAllowedError') {
      setAlertInfo({
        show: true,
        title: '权限受限',
        message:
          '浏览器安全策略阻止了当前目录选择。\n\n请优先选择桌面、下载目录或磁盘根目录下的子文件夹。',
      });
      return;
    }

    setAlertInfo({
      show: true,
      title: '无法选择文件夹',
      message: `发生意外错误：${error?.message ?? '未知错误'}\n请重试或改选其他目录。`,
    });
  };

  const addSourceFromHandle = (handle: FileSystemDirectoryHandle, isMock: boolean) => {
    if (!activeScheme) return;

    handleUpdateScheme({
      sources: [
        ...activeScheme.sources,
        createFolderItem(handle.name, handle, `${isMock ? '(模拟) 源' : '源'}: .../${handle.name}`),
      ],
    });
  };

  const setDestinationFromHandle = (handle: FileSystemDirectoryHandle, isMock: boolean) => {
    handleUpdateScheme({
      destination: createFolderItem(handle.name, handle, `${isMock ? '(模拟) 目标' : '目标'}: .../${handle.name}`),
    });
  };

  const handleAddSource = async () => {
    if (!activeScheme) return;

    if (!isCompatible) {
      sourceInputRef.current?.click();
      return;
    }

    try {
      // @ts-expect-error File System Access API
      const handle = await window.showDirectoryPicker();
      addSourceFromHandle(handle, false);
    } catch (error) {
      handleFileSystemError(error);
    }
  };

  const handleSetDestination = async () => {
    if (!activeScheme) return;

    if (!isCompatible) {
      destinationInputRef.current?.click();
      return;
    }

    try {
      // @ts-expect-error File System Access API
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setDestinationFromHandle(handle, false);
    } catch (error) {
      handleFileSystemError(error);
    }
  };

  const startMultiBackup = async () => {
    if (selectedSchemeIds.size === 0) return;

    setLogs([]);
    setStats(createEmptyStats());
    setStatus(BackupStatus.SCANNING);
    setShowLogs(true);

    const result = await runBackupSchemes({
      schemes,
      selectedSchemeIds,
      verifyPermission,
      onLog: (log) => setLogs((previous) => [...previous, log]),
      onProgress: (nextStats) => setStats(nextStats),
      onSchemeStarted: () => setStatus(BackupStatus.COPYING),
      onSchemeCompleted: (schemeId, completedAt) => {
        setSchemes((previous) =>
          previous.map((scheme) =>
            scheme.id === schemeId ? { ...scheme, lastRun: completedAt } : scheme,
          ),
        );
      },
    });

    setStats(result.stats);
    setStatus(result.finalStatus);
  };

  if (!isDataLoaded || !activeScheme) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">正在加载...</div>;
  }

  return (
    <div className="min-h-screen w-full flex flex-col p-4 md:p-6 lg:p-8 font-sans selection:bg-blue-100">
      <style>{`
        @keyframes rainbow-flow {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-rainbow {
          background-size: 200% 100%;
          animation: rainbow-flow 3s linear infinite;
        }
      `}</style>

      <input
        type="file"
        ref={sourceInputRef}
        onChange={(event) => {
          if (!event.target.files?.length) return;
          const handle = convertFileListToHandle(event.target.files);
          addSourceFromHandle(handle as unknown as FileSystemDirectoryHandle, true);
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
          if (!event.target.files?.length) return;
          const handle = convertFileListToHandle(event.target.files);
          setDestinationFromHandle(handle as unknown as FileSystemDirectoryHandle, true);
          event.target.value = '';
        }}
        className="hidden"
        {...({ webkitdirectory: '' } as any)}
        multiple
      />

      {alertInfo?.show && (
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
              onClick={() => setAlertInfo(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {showLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl h-[80vh] flex flex-col bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
              <h3 className="text-emerald-400 font-bold flex items-center gap-2 font-mono text-sm">
                <Layers className="w-4 h-4" />
                BATCH_BACKUP_CONSOLE
              </h3>
              <button
                onClick={() => setShowLogs(false)}
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
      )}

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto mx-auto">
        <div className="lg:col-span-3 flex flex-col gap-5">
          <div className="flex items-center gap-3 px-4 py-3 bg-white/40 rounded-2xl border border-white/60 backdrop-blur-md shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">备份方案库</h1>
          </div>

          <GlassCard
            title="全部方案"
            icon={<Settings2 className="w-4 h-4 text-emerald-600" />}
            className="flex-1 overflow-hidden"
            actions={
              <button onClick={handleAddScheme} className="text-emerald-600 hover:scale-110 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </button>
            }
          >
            <div className="space-y-3 mt-3 max-h-[500px] overflow-y-auto pr-1">
              {schemes.map((scheme) => (
                <div
                  key={scheme.id}
                  onClick={() => {
                    if (!isBusy) {
                      setActiveSchemeId(scheme.id);
                    }
                  }}
                  className={`group relative flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all border ${
                    activeSchemeId === scheme.id
                      ? 'bg-white border-emerald-200 shadow-md translate-x-1'
                      : 'bg-white/30 border-transparent hover:bg-white/50'
                  }`}
                >
                  <div
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSchemeSelection(scheme.id);
                    }}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedSchemeIds.has(scheme.id)
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-slate-300'
                    }`}
                  >
                    {selectedSchemeIds.has(scheme.id) && <Check className="w-3 h-3 stroke-[4px]" />}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div
                      className={`text-sm font-bold truncate ${
                        activeSchemeId === scheme.id ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      {scheme.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                      {scheme.mode === BackupMode.MIRROR ? '镜像模式' : '增量模式'}
                    </div>
                  </div>

                  {activeSchemeId === scheme.id && schemes.length > 1 && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteScheme(scheme.id);
                      }}
                      className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="bg-white/80 backdrop-blur-xl p-2 rounded-2xl border border-white shadow-lg flex gap-1">
            <button
              onClick={() => handleUpdateScheme({ mode: BackupMode.INCREMENTAL })}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                activeScheme.mode === BackupMode.INCREMENTAL
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100'
                  : 'text-slate-400 hover:bg-white'
              }`}
            >
              增量备份
            </button>
            <button
              onClick={() => handleUpdateScheme({ mode: BackupMode.MIRROR })}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                activeScheme.mode === BackupMode.MIRROR
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-100'
                  : 'text-slate-400 hover:bg-white'
              }`}
            >
              镜像备份
            </button>
          </div>

          <div className="flex items-center gap-3 bg-white/80 p-4 rounded-3xl border border-white shadow-md">
            <input
              type="text"
              value={activeScheme.name}
              onChange={(event) => handleUpdateScheme({ name: event.target.value })}
              className="flex-1 bg-transparent text-xl font-bold text-slate-800 focus:outline-none"
              placeholder="方案名称..."
            />
            <CheckCircle2
              className={`w-6 h-6 ${
                activeScheme.sources.length > 0 && activeScheme.destination ? 'text-emerald-500' : 'text-slate-200'
              }`}
            />
          </div>

          <GlassCard
            title="源文件夹"
            icon={<FolderOpen className="text-blue-500" />}
            actions={
              <button
                onClick={handleAddSource}
                className="bg-blue-500 text-white p-2.5 rounded-xl shadow-lg hover:scale-105 transition-transform"
              >
                <FolderPlus className="w-5 h-5" />
              </button>
            }
          >
            <div className="min-h-[140px] max-h-[200px] overflow-y-auto pr-2 space-y-3 mt-2">
              {activeScheme.sources.map((folder) => (
                <div key={folder.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-sm font-bold text-slate-700 truncate">{folder.name}</span>
                  </div>
                  <button
                    onClick={() =>
                      handleUpdateScheme({
                        sources: activeScheme.sources.filter((source) => source.id !== folder.id),
                      })
                    }
                    className="text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {activeScheme.sources.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 border border-dashed rounded-xl gap-2 px-6 text-center">
                  <span className="text-slate-300 text-xs">点击右上角按钮添加源文件夹</span>
                  <div className="flex gap-1.5 items-start text-[10px] text-amber-500 bg-amber-50 px-2 py-1 rounded">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>浏览器限制下无法直接选择桌面或磁盘根目录，请优先选择子文件夹。</span>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard
            title="目标位置"
            icon={<HardDrive className="text-emerald-500" />}
            actions={
              <button
                onClick={handleSetDestination}
                className="bg-emerald-500 text-white p-2.5 rounded-xl shadow-lg hover:scale-105 transition-transform"
              >
                <HardDrive className="w-5 h-5" />
              </button>
            }
          >
            <div className="mt-2">
              {activeScheme.destination ? (
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50/30 border border-emerald-100">
                  <HardDrive className="w-6 h-6 text-emerald-500" />
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

          <div className="bg-white p-6 rounded-[2rem] border border-white shadow-2xl shadow-emerald-100/40">
            {isBusy ? (
              <div className="w-full h-16 rounded-[1.2rem] bg-slate-900/5 p-1.5 relative overflow-hidden transition-all duration-500">
                <div className="relative w-full h-full rounded-[1rem] overflow-hidden bg-slate-100 shadow-inner">
                  <div
                    className="absolute inset-0 w-full h-full animate-rainbow"
                    style={{
                      background: 'linear-gradient(90deg, #22d3ee, #34d399, #facc15, #f87171, #a855f7, #22d3ee)',
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
                  disabled={selectedSchemeIds.size === 0}
                  onClick={startMultiBackup}
                  className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-lg shadow-xl shadow-emerald-200 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-3 hover:shadow-emerald-200/50 hover:-translate-y-0.5"
                >
                  <Play className="fill-current w-6 h-6" />
                  执行勾选的 {selectedSchemeIds.size} 个任务
                </button>

                {status === BackupStatus.ERROR && (
                  <p className="mt-3 text-xs text-amber-600 text-center">本次执行包含失败或跳过项，请查看运行日志。</p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-6">
          <GlassCard title="会话统计" icon={<History className="text-indigo-500" />}>
            <div className="space-y-3">
              <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-500 font-bold">更新文件</span>
                <span className="text-sm font-black text-emerald-600">{stats.copiedFiles}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-500 font-bold">镜像清理</span>
                <span className="text-sm font-black text-rose-500">{stats.deletedFiles}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-500 font-bold">传输数据</span>
                <span className="text-sm font-black text-blue-600">{(stats.bytesCopied / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </div>
            <button
              onClick={() => setShowLogs(true)}
              className="mt-4 w-full py-3 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <ScrollText className="w-4 h-4" />
              查看运行日志
            </button>
          </GlassCard>

          <GlassCard title="模式说明" icon={<BookOpen className="text-emerald-500" />}>
            <div className="space-y-4 text-[11px] leading-relaxed text-slate-600">
              <p>
                <b className="text-emerald-600">增量备份：</b>
                仅新增或替换。目标文件夹中原有的多余文件会原样保留，适合累计存档。
              </p>
              <p>
                <b className="text-rose-500">镜像备份：</b>
                严格同步。目标文件夹会删除一切在源中不存在的内容，使其与源完全一致，适合同步备份。
              </p>
              <hr className="opacity-50" />
              <p className="text-slate-400 font-medium italic">* 方案支持多选运行，各方案模式独立生效。</p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default App;
