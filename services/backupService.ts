import { BackupMode, type BackupStats, type LogEntry } from '../types';

export interface BackupSourceEntry {
  handle: unknown;
  name: string;
  targetName: string;
}

export interface BackupExecutionResult {
  stats: BackupStats;
  completed: boolean;
  hadErrors: boolean;
}

interface GenericFileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface GenericFileHandle extends GenericFileSystemHandle {
  kind: 'file';
  getFile: () => Promise<File>;
  createWritable?: () => Promise<{
    write: (data: unknown) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface GenericDirectoryHandle extends GenericFileSystemHandle {
  kind: 'directory';
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<GenericDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<GenericFileHandle>;
  removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>;
  values: () => AsyncIterable<GenericFileSystemHandle>;
}

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

const isIgnored = (name: string) => IGNORED_SYSTEM_ITEMS.has(name.toLowerCase());

const isValidDirectoryHandle = (handle: unknown): handle is GenericDirectoryHandle => {
  return Boolean(
    handle &&
      typeof handle === 'object' &&
      'getDirectoryHandle' in handle &&
      'values' in handle,
  );
};

const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const normalizedError = error as { name?: string; message?: string };
  return (
    (normalizedError.name ?? '') === 'NotFoundError' ||
    (normalizedError.message ?? '') === 'NotFound'
  );
};

const isTypeMismatchError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return ((error as { message?: string }).message ?? '') === 'Type mismatch';
};

const cloneStats = (stats: BackupStats): BackupStats => ({ ...stats });

const getFileStats = async (fileHandle: GenericFileHandle) => {
  const file = await fileHandle.getFile();
  return {
    lastModified: file.lastModified,
    size: file.size,
  };
};

const ensureDirectoryHandle = async (
  parent: GenericDirectoryHandle,
  name: string,
  addLog: (message: string, type?: LogEntry['type']) => void,
) => {
  try {
    return await parent.getDirectoryHandle(name, { create: true });
  } catch (error) {
    if (isTypeMismatchError(error)) {
      await parent.removeEntry(name, { recursive: true });
      addLog(`目标项类型冲突，已替换为目录: ${name}`, 'warning');
      return parent.getDirectoryHandle(name, { create: true });
    }
    throw error;
  }
};

const getDestinationFileStats = async (
  destDirHandle: GenericDirectoryHandle,
  fileName: string,
  addLog: (message: string, type?: LogEntry['type']) => void,
) => {
  try {
    const fileHandle = await destDirHandle.getFileHandle(fileName);
    return {
      fileHandle,
      stats: await getFileStats(fileHandle),
      replacedConflict: false,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        fileHandle: null,
        stats: null,
        replacedConflict: false,
      };
    }

    if (isTypeMismatchError(error)) {
      await destDirHandle.removeEntry(fileName, { recursive: true });
      addLog(`目标项类型冲突，已替换为文件: ${fileName}`, 'warning');
      return {
        fileHandle: null,
        stats: null,
        replacedConflict: true,
      };
    }

    throw error;
  }
};

const handleFileMirror = async (
  sourceFileHandle: GenericFileHandle,
  destDirHandle: GenericDirectoryHandle,
  stats: BackupStats,
  addLog: (message: string, type?: LogEntry['type']) => void,
) => {
  try {
    const sourceStats = await getFileStats(sourceFileHandle);
    const destinationState = await getDestinationFileStats(destDirHandle, sourceFileHandle.name, addLog);

    let shouldCopy = destinationState.replacedConflict || !destinationState.stats;
    if (destinationState.stats) {
      shouldCopy =
        sourceStats.lastModified > destinationState.stats.lastModified ||
        sourceStats.size !== destinationState.stats.size;
    }

    if (!shouldCopy) {
      stats.skippedFiles += 1;
      return;
    }

    const targetHandle = await destDirHandle.getFileHandle(sourceFileHandle.name, { create: true });
    if (!targetHandle.createWritable) {
      throw new Error('当前环境不支持写入文件。');
    }

    const writable = await targetHandle.createWritable();
    const fileData = await sourceFileHandle.getFile();
    await writable.write(fileData);
    await writable.close();

    stats.copiedFiles += 1;
    stats.bytesCopied += sourceStats.size;
    addLog(`已${destinationState.stats ? '更新' : '备份'}: ${sourceFileHandle.name}`, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    addLog(`文件处理错误 [${sourceFileHandle.name}]: ${message}`, 'error');
  }
};

const processDirectory = async (
  source: GenericDirectoryHandle,
  dest: GenericDirectoryHandle,
  mode: BackupMode,
  stats: BackupStats,
  onProgress: (stats: BackupStats) => void,
  addLog: (message: string, type?: LogEntry['type']) => void,
) => {
  const sourceEntryNames = new Set<string>();

  for await (const entry of source.values()) {
    if (isIgnored(entry.name)) {
      continue;
    }

    sourceEntryNames.add(entry.name);

    if (entry.kind === 'file') {
      stats.totalFiles += 1;
      onProgress(cloneStats(stats));

      await handleFileMirror(entry as GenericFileHandle, dest, stats, addLog);

      stats.processedFiles += 1;
      onProgress(cloneStats(stats));
      continue;
    }

    const sourceDirectory = entry as GenericDirectoryHandle;
    const destinationDirectory = await ensureDirectoryHandle(dest, sourceDirectory.name, addLog);
    await processDirectory(sourceDirectory, destinationDirectory, mode, stats, onProgress, addLog);
  }

  if (mode !== BackupMode.MIRROR) {
    return;
  }

  for await (const destEntry of dest.values()) {
    if (isIgnored(destEntry.name) || sourceEntryNames.has(destEntry.name)) {
      continue;
    }

    try {
      await dest.removeEntry(destEntry.name, { recursive: true });
      stats.deletedFiles += 1;
      onProgress(cloneStats(stats));
      addLog(`已同步删除: ${destEntry.name}`, 'delete');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      addLog(`删除失败 [${destEntry.name}]: ${message}`, 'error');
    }
  }
};

export const performBackup = async (
  sources: BackupSourceEntry[],
  destination: unknown,
  mode: BackupMode,
  onProgress: (stats: BackupStats) => void,
  onLog: (log: LogEntry) => void,
  currentStats: BackupStats,
): Promise<BackupExecutionResult> => {
  const stats = cloneStats(currentStats);
  let hadErrors = false;

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    if (type === 'error') {
      hadErrors = true;
    }

    onLog({
      id: Math.random().toString(36).slice(2, 11),
      timestamp: new Date(),
      message,
      type,
    });
  };

  if (!isValidDirectoryHandle(destination)) {
    addLog('错误：目标文件夹句柄无效。', 'error');
    return {
      stats,
      completed: false,
      hadErrors,
    };
  }

  const modeText = mode === BackupMode.MIRROR ? '全量镜像同步' : '增量备份同步';
  addLog(`开始任务 [${modeText}]...`, 'info');

  try {
    for (const source of sources) {
      if (!isValidDirectoryHandle(source.handle)) {
        addLog(`错误：源文件夹句柄无效: ${source.name}`, 'error');
        continue;
      }

      addLog(`正在处理: ${source.name}`, 'info');
      const destinationSubFolder = await ensureDirectoryHandle(destination, source.targetName, addLog);
      await processDirectory(source.handle, destinationSubFolder, mode, stats, onProgress, addLog);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    addLog(`方案中断: ${message}`, 'error');
    return {
      stats,
      completed: false,
      hadErrors,
    };
  }

  addLog('方案完成。', hadErrors ? 'warning' : 'success');
  return {
    stats,
    completed: !hadErrors,
    hadErrors,
  };
};
