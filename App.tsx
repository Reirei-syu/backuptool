
import React, { useState, useRef, useEffect } from 'react';
import { 
  FolderPlus, 
  HardDrive, 
  Play, 
  FolderOpen,
  History,
  Trash2,
  Settings2,
  PlusCircle,
  CheckCircle2,
  X,
  ScrollText,
  BookOpen,
  Layers,
  Check,
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react';
import { GlassCard } from './components/GlassCard';
import { BackupStatus, BackupStats, LogEntry, BackupScheme, BackupMode } from './types';
import { performBackup } from './services/backupService';
import { isFileSystemApiSupported, convertFileListToHandle } from './utils/compatibility';
import { loadSchemesFromDB, saveSchemesToDB } from './utils/storage';

const App: React.FC = () => {
  const [schemes, setSchemes] = useState<BackupScheme[]>([]);
  const [activeSchemeId, setActiveSchemeId] = useState<string>('');
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<Set<string>>(new Set());
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [status, setStatus] = useState<BackupStatus>(BackupStatus.IDLE);
  const [stats, setStats] = useState<BackupStats>({ totalFiles: 0, processedFiles: 0, copiedFiles: 0, skippedFiles: 0, bytesCopied: 0, deletedFiles: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Alert State
  const [alertInfo, setAlertInfo] = useState<{show: boolean, title: string, message: string} | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const [isCompatible, setIsCompatible] = useState(true);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsCompatible(isFileSystemApiSupported());
    loadSchemesFromDB().then(loaded => {
      if (loaded.length > 0) {
        setSchemes(loaded);
        setActiveSchemeId(loaded[0].id);
        setSelectedSchemeIds(new Set([loaded[0].id]));
      } else {
        const defaultScheme: BackupScheme = { 
          id: 'default', name: '我的重要备份', sources: [], destination: null, 
          lastRun: null, mode: BackupMode.INCREMENTAL 
        };
        setSchemes([defaultScheme]);
        setActiveSchemeId('default');
        setSelectedSchemeIds(new Set(['default']));
      }
      setIsDataLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (isDataLoaded) saveSchemesToDB(schemes);
  }, [schemes, isDataLoaded]);

  useEffect(() => {
    if (showLogs && logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logs, showLogs]);

  const activeScheme = schemes.find(s => s.id === activeSchemeId) || schemes[0];
  const isBusy = status === BackupStatus.SCANNING || status === BackupStatus.COPYING;

  const verifyPermission = async (handle: any, mode: 'read' | 'readwrite') => {
    if (!handle || !handle.queryPermission) return true;
    try {
      if ((await handle.queryPermission({ mode })) === 'granted') return true;
      if ((await handle.requestPermission({ mode })) === 'granted') return true;
    } catch (e) { console.error(e); }
    return false;
  };

  const handleAddScheme = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newScheme: BackupScheme = {
      id: newId, name: `新方案 ${schemes.length + 1}`, sources: [], destination: null, 
      lastRun: null, mode: BackupMode.INCREMENTAL
    };
    setSchemes([...schemes, newScheme]);
    setActiveSchemeId(newId);
    setSelectedSchemeIds(prev => new Set(prev).add(newId));
  };

  const handleUpdateScheme = (updates: Partial<BackupScheme>) => {
    setSchemes(prev => prev.map(s => s.id === activeSchemeId ? { ...s, ...updates } : s));
  };

  const handleDeleteScheme = (id: string) => {
    if (schemes.length === 1 || isBusy) return;
    const filtered = schemes.filter(s => s.id !== id);
    setSchemes(filtered);
    if (activeSchemeId === id) setActiveSchemeId(filtered[0].id);
    setSelectedSchemeIds(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
    });
  };

  const toggleSchemeSelection = (id: string) => {
    setSelectedSchemeIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const startMultiBackup = async () => {
    const selectedSchemes = schemes.filter(s => selectedSchemeIds.has(s.id));
    if (selectedSchemes.length === 0) return;

    setLogs([]);
    setStats({ totalFiles: 0, processedFiles: 0, copiedFiles: 0, skippedFiles: 0, bytesCopied: 0, deletedFiles: 0 });
    setStatus(BackupStatus.SCANNING);
    setShowLogs(true);

    const addLog = (msg: string, type: LogEntry['type']) => {
      setLogs(prev => [...prev, { id: Math.random().toString(), timestamp: new Date(), message: msg, type }]);
    };

    let currentSessionStats = { totalFiles: 0, processedFiles: 0, copiedFiles: 0, skippedFiles: 0, bytesCopied: 0, deletedFiles: 0 };

    for (const scheme of selectedSchemes) {
      addLog(`>>> 准备执行方案: ${scheme.name}`, 'info');
      
      if (scheme.sources.length === 0 || !scheme.destination) {
        addLog(`方案 [${scheme.name}] 配置不完整，跳过。`, 'warning');
        continue;
      }

      // 权限检查
      for (const source of scheme.sources) {
        if (!(await verifyPermission(source.handle, 'read'))) {
          addLog(`权限拒绝: ${source.name}`, 'error');
          continue;
        }
      }
      if (!(await verifyPermission(scheme.destination.handle, 'readwrite'))) {
        addLog(`权限拒绝 (目标): ${scheme.destination.name}`, 'error');
        continue;
      }

      setStatus(BackupStatus.COPYING);
      currentSessionStats = await performBackup(
        scheme.sources.map(s => s.handle),
        scheme.destination.handle,
        scheme.mode,
        (s) => setStats(s),
        (l) => setLogs(prev => [...prev, l]),
        currentSessionStats
      );

      // 更新最后运行时间
      setSchemes(prev => prev.map(s => s.id === scheme.id ? { ...s, lastRun: new Date() } : s));
    }

    setStatus(BackupStatus.COMPLETED);
    addLog(`所有选定的备份方案已执行完毕。`, 'success');
  };

  const handleFileSystemError = (err: any) => {
    // AbortError通常是用户点了取消，或者由于系统安全弹窗阻止后导致的取消
    if (err.name === 'AbortError') return;
    
    // SecurityError 是浏览器明确拒绝
    if (err.name === 'SecurityError' || err.name === 'NotAllowedError') {
       setAlertInfo({
           show: true,
           title: "权限受限",
           message: "浏览器安全策略禁止直接访问该系统文件夹（如桌面、下载或C盘根目录）。\n\n请在桌面建立一个文件夹，然后选择该子文件夹。"
       });
       return;
    }

    // 其他错误
    setAlertInfo({
        show: true,
        title: "无法添加文件夹",
        message: `发生意外错误: ${err.message}\n请重试或选择其他目录。`
    });
  };

  const handleAddSource = async () => {
    if (isCompatible) {
      try {
        // @ts-ignore
        const handle = await window.showDirectoryPicker();
        handleUpdateScheme({ sources: [...activeScheme.sources, { 
          id: Math.random().toString(36).substr(2, 9), name: handle.name, handle, pathLabel: `源: .../${handle.name}` 
        }] });
      } catch (err) {
        handleFileSystemError(err);
      }
    } else sourceInputRef.current?.click();
  };

  const handleSetDest = async () => {
    if (isCompatible) {
      try {
        // @ts-ignore
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        handleUpdateScheme({ destination: { id: 'dest', name: handle.name, handle, pathLabel: `目标: .../${handle.name}` } });
      } catch (err) {
        handleFileSystemError(err);
      }
    }
  };

  if (!isDataLoaded) return <div className="min-h-screen flex items-center justify-center text-slate-400">正在加载...</div>;

  return (
    // Changed: Remove fixed items-center/justify-center. Use flex-col and let content flow.
    // 'my-auto' on the inner container handles vertical centering when there is space.
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
        onChange={(e) => {
            if (e.target.files?.length) {
                const h = convertFileListToHandle(e.target.files);
                handleUpdateScheme({ sources: [...activeScheme.sources, { id: Math.random().toString(36).substr(2, 9), name: h.name, handle: h as any, pathLabel: `(模拟) .../${h.name}` }] });
            }
        }} 
        className="hidden" 
        {...({ webkitdirectory: "" } as any)}
        multiple 
      />

      {/* Alert Modal */}
      {alertInfo && alertInfo.show && (
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
                      <Layers className="w-4 h-4" /> BATCH_BACKUP_CONSOLE
                  </h3>
                  <button onClick={() => setShowLogs(false)} className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-2 font-mono text-[11px] bg-slate-900/95 scroll-smooth">
                  {logs.map((log) => (
                      <div key={log.id} className={`flex gap-3 border-b border-white/5 pb-1 ${
                        log.type === 'error' ? 'text-rose-400' : 
                        log.type === 'success' ? 'text-emerald-400' : 
                        log.type === 'warning' ? 'text-amber-400' : 
                        log.type === 'delete' ? 'text-rose-300' : 'text-slate-300'
                      }`}>
                         <span className="opacity-30 shrink-0 w-16">[{log.timestamp.toLocaleTimeString()}]</span>
                         <span className="break-all">{log.message}</span>
                      </div>
                  ))}
                  <div ref={logsEndRef} />
              </div>
           </div>
        </div>
      )}

      {/* Changed: Added my-auto to center when space permits, but allows expansion when needed */}
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto mx-auto">
        {/* Schemes List */}
        <div className="lg:col-span-3 flex flex-col gap-5">
           <div className="flex items-center gap-3 px-4 py-3 bg-white/40 rounded-2xl border border-white/60 backdrop-blur-md shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <Layers className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight">备份方案库</h1>
           </div>

           <GlassCard title="全部方案" icon={<Settings2 className="w-4 h-4 text-emerald-600" />} className="flex-1 overflow-hidden"
             actions={<button onClick={handleAddScheme} className="text-emerald-600 hover:scale-110 transition-transform"><PlusCircle className="w-5 h-5" /></button>}>
              <div className="space-y-3 mt-3 max-h-[500px] overflow-y-auto pr-1">
                {schemes.map(s => (
                  <div key={s.id} 
                    onClick={() => { if(!isBusy) setActiveSchemeId(s.id); }}
                    className={`group relative flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all border ${activeSchemeId === s.id ? 'bg-white border-emerald-200 shadow-md translate-x-1' : 'bg-white/30 border-transparent hover:bg-white/50'}`}>
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleSchemeSelection(s.id); }}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedSchemeIds.has(s.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}
                    >
                        {selectedSchemeIds.has(s.id) && <Check className="w-3 h-3 stroke-[4px]" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                       <div className={`text-sm font-bold truncate ${activeSchemeId === s.id ? 'text-emerald-700' : 'text-slate-600'}`}>{s.name}</div>
                       <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{s.mode === BackupMode.MIRROR ? '镜像模式' : '增量模式'}</div>
                    </div>
                    {activeSchemeId === s.id && schemes.length > 1 && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteScheme(s.id); }} className="p-1 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
           </GlassCard>
        </div>

        {/* Configuration */}
        <div className="lg:col-span-6 flex flex-col gap-6">
           {/* Mode Selector */}
           <div className="bg-white/80 backdrop-blur-xl p-2 rounded-2xl border border-white shadow-lg flex gap-1">
              <button 
                onClick={() => handleUpdateScheme({ mode: BackupMode.INCREMENTAL })}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeScheme.mode === BackupMode.INCREMENTAL ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:bg-white'}`}
              >增量备份</button>
              <button 
                onClick={() => handleUpdateScheme({ mode: BackupMode.MIRROR })}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeScheme.mode === BackupMode.MIRROR ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'text-slate-400 hover:bg-white'}`}
              >镜像备份</button>
           </div>

           <div className="flex items-center gap-3 bg-white/80 p-4 rounded-3xl border border-white shadow-md">
              <input 
                type="text" 
                value={activeScheme.name} 
                onChange={(e) => handleUpdateScheme({ name: e.target.value })}
                className="flex-1 bg-transparent text-xl font-bold text-slate-800 focus:outline-none"
                placeholder="方案名称..."
              />
              <CheckCircle2 className={`w-6 h-6 ${activeScheme.sources.length > 0 && activeScheme.destination ? 'text-emerald-500' : 'text-slate-200'}`} />
           </div>

           <GlassCard title="源文件夹" icon={<FolderOpen className="text-blue-500" />} actions={<button onClick={handleAddSource} className="bg-blue-500 text-white p-2.5 rounded-xl shadow-lg hover:scale-105 transition-transform"><FolderPlus className="w-5 h-5" /></button>}>
             <div className="min-h-[140px] max-h-[200px] overflow-y-auto pr-2 space-y-3 mt-2">
               {activeScheme.sources.map(folder => (
                   <div key={folder.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
                     <div className="flex items-center gap-3 overflow-hidden">
                       <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                       <span className="text-sm font-bold text-slate-700 truncate">{folder.name}</span>
                     </div>
                     <button onClick={() => handleUpdateScheme({ sources: activeScheme.sources.filter(s => s.id !== folder.id) })} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                   </div>
               ))}
               {activeScheme.sources.length === 0 && (
                   <div className="flex flex-col items-center justify-center h-32 border border-dashed rounded-xl gap-2 px-6 text-center">
                       <span className="text-slate-300 text-xs">点击上方按钮添加源文件夹</span>
                       <div className="flex gap-1.5 items-start text-[10px] text-amber-500 bg-amber-50 px-2 py-1 rounded">
                           <Info className="w-3 h-3 shrink-0 mt-0.5" />
                           <span>浏览器限制：无法直接选“桌面”或“C盘”，请选子文件夹。</span>
                       </div>
                   </div>
               )}
             </div>
           </GlassCard>

           <GlassCard title="目标位置" icon={<HardDrive className="text-emerald-500" />} actions={<button onClick={handleSetDest} className="bg-emerald-500 text-white p-2.5 rounded-xl shadow-lg hover:scale-105 transition-transform"><HardDrive className="w-5 h-5" /></button>}>
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
                   <div className="h-24 flex items-center justify-center text-slate-300 text-xs border border-dashed rounded-xl">尚未设置目标路径</div>
                 )}
              </div>
           </GlassCard>

           <div className="bg-white p-6 rounded-[2rem] border border-white shadow-2xl shadow-emerald-100/40">
             {isBusy ? (
                 <div className="w-full h-16 rounded-[1.2rem] bg-slate-900/5 p-1.5 relative overflow-hidden transition-all duration-500">
                    <div className="relative w-full h-full rounded-[1rem] overflow-hidden bg-slate-100 shadow-inner">
                        {/* Rainbow Gradient Background */}
                        <div className="absolute inset-0 w-full h-full animate-rainbow"
                             style={{
                               background: 'linear-gradient(90deg, #22d3ee, #34d399, #facc15, #f87171, #a855f7, #22d3ee)'
                             }}
                        />
                        
                        {/* Glass Gloss Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                        
                        {/* Content */}
                        <div className="absolute inset-0 flex items-center justify-center gap-3 text-white font-black text-lg drop-shadow-[0_2px_2px_rgba(0,0,0,0.15)]">
                           <Loader2 className="animate-spin w-5 h-5 text-white" />
                           <span className="tracking-wide">
                               正在处理... {stats.processedFiles > 0 ? `${stats.processedFiles} / ${stats.totalFiles}` : '准备中'}
                           </span>
                        </div>
                    </div>
                 </div>
             ) : (
                 <button 
                   disabled={selectedSchemeIds.size === 0}
                   onClick={startMultiBackup}
                   className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-lg shadow-xl shadow-emerald-200 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center gap-3 hover:shadow-emerald-200/50 hover:-translate-y-0.5"
                 >
                   <Play className="fill-current w-6 h-6" /> 执行勾选的 {selectedSchemeIds.size} 个任务
                 </button>
             )}
           </div>
        </div>

        {/* Stats */}
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
              <button onClick={() => setShowLogs(true)} className="mt-4 w-full py-3 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                <ScrollText className="w-4 h-4" /> 查看运行日志
              </button>
           </GlassCard>

           <GlassCard title="模式说明" icon={<BookOpen className="text-emerald-500" />}>
              <div className="space-y-4 text-[11px] leading-relaxed text-slate-600">
                  <p><b className="text-emerald-600">增量备份：</b>仅新增或替换。目标文件夹中原有的多余文件会原样保留，适合累计存档。</p>
                  <p><b className="text-rose-500">镜像备份：</b>严格同步。目标文件夹会删除一切在源中不存在的内容，使其与源完全一致，适合同步备份。</p>
                  <hr className="opacity-50" />
                  <p className="text-slate-400 font-medium italic">* 方案支持随时多选运行，各方案模式独立生效。</p>
              </div>
           </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default App;
