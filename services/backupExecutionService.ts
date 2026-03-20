import { resolveBackupSources } from '../core/backupTargets';
import { BackupStatus, type BackupScheme, type BackupStats, type LogEntry } from '../types';
import { performBackup, type BackupExecutionResult, type BackupSourceEntry } from './backupService';

type PermissionMode = 'read' | 'readwrite';
type VerifyPermission = (handle: unknown, mode: PermissionMode) => Promise<boolean>;
type ProgressHandler = (stats: BackupStats) => void;
type LogHandler = (log: LogEntry) => void;
type SchemeCompletionHandler = (schemeId: string, completedAt: Date) => void;
type SchemeStartHandler = (schemeId: string) => void;
type PerformBackupHandler = (
  sources: BackupSourceEntry[],
  destination: unknown,
  mode: BackupScheme['mode'],
  onProgress: ProgressHandler,
  onLog: LogHandler,
  currentStats: BackupStats,
) => Promise<BackupExecutionResult>;

export interface RunBackupSchemesOptions {
  schemes: BackupScheme[];
  selectedSchemeIds: Set<string>;
  verifyPermission: VerifyPermission;
  onLog: LogHandler;
  onProgress: ProgressHandler;
  onSchemeCompleted: SchemeCompletionHandler;
  onSchemeStarted?: SchemeStartHandler;
  performBackup?: PerformBackupHandler;
}

export interface RunBackupSchemesResult {
  stats: BackupStats;
  finalStatus: BackupStatus;
  completedSchemeIds: string[];
  skippedSchemeIds: string[];
}

const createLogEntry = (message: string, type: LogEntry['type']): LogEntry => ({
  id: Math.random().toString(36).slice(2, 11),
  timestamp: new Date(),
  message,
  type,
});

const hasValidConfiguration = (scheme: BackupScheme) => {
  return scheme.sources.length > 0 && Boolean(scheme.destination);
};

export const runBackupSchemes = async ({
  schemes,
  selectedSchemeIds,
  verifyPermission,
  onLog,
  onProgress,
  onSchemeCompleted,
  onSchemeStarted,
  performBackup: performBackupHandler = performBackup,
}: RunBackupSchemesOptions): Promise<RunBackupSchemesResult> => {
  let currentStats: BackupStats = {
    totalFiles: 0,
    processedFiles: 0,
    copiedFiles: 0,
    skippedFiles: 0,
    bytesCopied: 0,
    deletedFiles: 0,
  };
  let hasErrors = false;
  const completedSchemeIds: string[] = [];
  const skippedSchemeIds: string[] = [];

  const selectedSchemes = schemes.filter((scheme) => selectedSchemeIds.has(scheme.id));

  for (const scheme of selectedSchemes) {
    onLog(createLogEntry(`>>> 准备执行方案: ${scheme.name}`, 'info'));

    if (!hasValidConfiguration(scheme)) {
      hasErrors = true;
      skippedSchemeIds.push(scheme.id);
      onLog(createLogEntry(`方案 [${scheme.name}] 配置不完整，已跳过。`, 'warning'));
      continue;
    }

    let permissionDenied = false;
    for (const source of scheme.sources) {
      if (!(await verifyPermission(source.handle, 'read'))) {
        permissionDenied = true;
        onLog(createLogEntry(`权限被拒绝: ${source.name}`, 'error'));
      }
    }

    if (!(await verifyPermission(scheme.destination!.handle, 'readwrite'))) {
      permissionDenied = true;
      onLog(createLogEntry(`权限被拒绝 (目标): ${scheme.destination!.name}`, 'error'));
    }

    if (permissionDenied) {
      hasErrors = true;
      skippedSchemeIds.push(scheme.id);
      onLog(createLogEntry(`方案 [${scheme.name}] 因权限不足未执行。`, 'warning'));
      continue;
    }

    onSchemeStarted?.(scheme.id);
    const result = await performBackupHandler(
      resolveBackupSources(scheme.sources),
      scheme.destination!.handle,
      scheme.mode,
      (stats) => {
        currentStats = stats;
        onProgress(stats);
      },
      onLog,
      currentStats,
    );

    currentStats = result.stats;
    onProgress(currentStats);

    if (!result.completed || result.hadErrors) {
      hasErrors = true;
      skippedSchemeIds.push(scheme.id);
      continue;
    }

    const completedAt = new Date();
    completedSchemeIds.push(scheme.id);
    onSchemeCompleted(scheme.id, completedAt);
  }

  if (completedSchemeIds.length === selectedSchemes.length && !hasErrors) {
    onLog(createLogEntry('所有选定的备份方案已执行完毕。', 'success'));
  } else {
    onLog(
      createLogEntry(
        `执行结束：成功 ${completedSchemeIds.length} 个，失败或跳过 ${selectedSchemes.length - completedSchemeIds.length} 个。`,
        hasErrors ? 'warning' : 'success',
      ),
    );
  }

  return {
    stats: currentStats,
    finalStatus: hasErrors ? BackupStatus.ERROR : BackupStatus.COMPLETED,
    completedSchemeIds,
    skippedSchemeIds,
  };
};
