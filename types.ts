
export enum BackupMode {
  INCREMENTAL = 'INCREMENTAL',
  MIRROR = 'MIRROR'
}

export interface FolderItem {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  pathLabel: string;
}

export interface BackupScheme {
  id: string;
  name: string;
  sources: FolderItem[];
  destination: FolderItem | null;
  mode: BackupMode; // 备份模式
  lastRun: Date | null;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'delete';
}

export enum BackupStatus {
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  COPYING = 'COPYING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface BackupStats {
  totalFiles: number;
  processedFiles: number;
  copiedFiles: number;
  skippedFiles: number;
  bytesCopied: number;
  deletedFiles: number;
}
