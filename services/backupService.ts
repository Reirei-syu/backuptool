
import { BackupStats, LogEntry, BackupMode } from '../types';

interface GenericFileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface GenericFileHandle extends GenericFileSystemHandle {
  kind: 'file';
  getFile: () => Promise<File>;
  createWritable?: () => Promise<{ write: (data: any) => Promise<void>; close: () => Promise<void>; }>;
}

interface GenericDirectoryHandle extends GenericFileSystemHandle {
  kind: 'directory';
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<GenericDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<GenericFileHandle>;
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>;
  values: () => AsyncIterable<GenericFileSystemHandle>;
}

// Windows/System folder names to ignore
const IGNORED_SYSTEM_ITEMS = new Set([
  'desktop.ini',
  'thumbs.db',
  '$recycle.bin',
  'system volume information',
  'recovery',
  'config.msi',
  'ntuser.dat',
  'swapfile.sys',
  'pagefile.sys',
  'hiberfil.sys',
  'dumpstack.log.tmp',
  '$windows.~bt',
  '$windows.~ws',
  'my computer',
  'recycle bin',
  'network',
]);

const isIgnored = (name: string) => {
  return IGNORED_SYSTEM_ITEMS.has(name.toLowerCase());
};

const isValidDirectoryHandle = (handle: any): handle is GenericDirectoryHandle => {
  return handle && typeof handle.getDirectoryHandle === 'function' && typeof handle.values === 'function';
};

const getFileStats = async (fileHandle: GenericFileHandle) => {
  const file = await fileHandle.getFile();
  return {
    lastModified: file.lastModified,
    size: file.size,
    name: file.name,
    originalFile: file
  };
};

export const performBackup = async (
  sources: any[], 
  destination: any,
  mode: BackupMode,
  onProgress: (stats: BackupStats) => void,
  onLog: (log: LogEntry) => void,
  currentStats: BackupStats
) => {
  const stats = { ...currentStats };

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    onLog({
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      message,
      type
    });
  };

  if (!isValidDirectoryHandle(destination)) {
    addLog('错误：目标文件夹句柄无效。', 'error');
    return stats;
  }

  const modeText = mode === BackupMode.MIRROR ? '全量镜像同步' : '增量备份同步';
  addLog(`开始任务 [${modeText}]...`, 'info');

  try {
    // 1. 正向同步
    // 我们不再维护 sourceFolderNames 来扫描根目录，因为这会导致不同方案之间互相删除对方的文件夹。
    for (const sourceHandle of sources) {
      if (!isValidDirectoryHandle(sourceHandle)) continue;

      addLog(`正在处理: ${sourceHandle.name}`, 'info');
      
      // 强制在目标下创建同名子文件夹，确保不同源文件互不干扰
      const destSubFolder = await destination.getDirectoryHandle(sourceHandle.name, { create: true });
      
      // 这里的 processDirectory 内部仍然会执行“子文件/子目录”级别的镜像清理
      // 从而保证 sourceHandle.name 这个文件夹内部是严格镜像的
      await processDirectory(sourceHandle, destSubFolder, mode, stats, onProgress, addLog);
    }

    // 2. [已移除] 根目录反向清理逻辑
    // 为了防止多个备份方案共用同一个目标盘时互相删除（打架），
    // 根目录级别不再执行删除操作。只有在进入了具体的子文件夹后（processDirectory内部）才执行镜像删除。
    
    addLog(`方案完成。`, 'success');
  } catch (error: any) {
    addLog(`方案中断: ${error.message}`, 'error');
  }
  return stats;
};

const processDirectory = async (
  source: GenericDirectoryHandle,
  dest: GenericDirectoryHandle,
  mode: BackupMode,
  stats: BackupStats,
  onProgress: (stats: BackupStats) => void,
  addLog: (msg: string, type: LogEntry['type']) => void
) => {
  const sourceEntryNames = new Set<string>();

  for await (const entry of source.values()) {
    // 自动过滤系统文件/文件夹
    if (isIgnored(entry.name)) {
      continue;
    }

    sourceEntryNames.add(entry.name);

    if (entry.kind === 'file') {
      stats.totalFiles++;
      onProgress({...stats});
      
      const sourceFileHandle = entry as GenericFileHandle;
      await handleFileMirror(sourceFileHandle, dest, stats, addLog);
      
      stats.processedFiles++;
      onProgress({...stats});
    } else if (entry.kind === 'directory') {
      const sourceDirHandle = entry as GenericDirectoryHandle;
      const destDirHandle = await dest.getDirectoryHandle(sourceDirHandle.name, { create: true });
      await processDirectory(sourceDirHandle, destDirHandle, mode, stats, onProgress, addLog);
    }
  }

  // 子目录清理 (仅镜像模式)
  // 这是关键：我们只清理“当前正在处理的这个文件夹”内部的冗余文件
  if (mode === BackupMode.MIRROR) {
    for await (const destEntry of dest.values()) {
      // 同样跳过系统文件的删除检查
      if (isIgnored(destEntry.name)) continue;

      if (!sourceEntryNames.has(destEntry.name)) {
        try {
          await dest.removeEntry(destEntry.name, { recursive: true });
          stats.deletedFiles++;
          addLog(`已同步删除: ${destEntry.name}`, 'delete');
          onProgress({...stats});
        } catch (err: any) {
          addLog(`删除失败: ${destEntry.name}`, 'error');
        }
      }
    }
  }
};

const handleFileMirror = async (
  sourceFileHandle: GenericFileHandle,
  destDirHandle: GenericDirectoryHandle,
  stats: BackupStats,
  addLog: (msg: string, type: LogEntry['type']) => void
) => {
  try {
    const sourceStats = await getFileStats(sourceFileHandle);
    let shouldCopy = false;

    let destFileHandle: GenericFileHandle | null = null;
    let destStats: { lastModified: number; size: number } | null = null;

    try {
      destFileHandle = await destDirHandle.getFileHandle(sourceFileHandle.name);
      destStats = await getFileStats(destFileHandle);
    } catch (e: any) {
      if (e.name === 'NotFoundError' || e.message === 'NotFound') {
        // 目标文件不存在，必须复制
        shouldCopy = true;
      } else {
        throw e; // 其他错误（权限等）
      }
    }

    if (destStats) {
      // 目标文件存在，对比逻辑
      // 1. 如果源文件修改时间晚于目标文件 -> 更新
      // 2. 如果文件大小不同 -> 更新 (覆盖修改内容但未改名的情况)
      if (sourceStats.lastModified > destStats.lastModified || sourceStats.size !== destStats.size) {
        shouldCopy = true;
      }
    }

    if (shouldCopy) {
      const newDestHandle = await destDirHandle.getFileHandle(sourceFileHandle.name, { create: true });
      
      if (newDestHandle.createWritable) {
        const writable = await newDestHandle.createWritable();
        const fileData = await sourceFileHandle.getFile();
        await writable.write(fileData);
        await writable.close();
        
        stats.copiedFiles++;
        stats.bytesCopied += sourceStats.size;
        addLog(`已${destStats ? '更新' : '备份'}: ${sourceFileHandle.name}`, 'success');
      } else {
        throw new Error('当前环境不支持写入文件');
      }
    } else {
      stats.skippedFiles++;
    }
  } catch (error: any) {
    addLog(`文件处理错误 [${sourceFileHandle.name}]: ${error.message}`, 'error');
  }
};
