import { BackupMode, type BackupScheme, type BackupStats } from '../types';

export const createEmptyStats = (): BackupStats => ({
  totalFiles: 0,
  processedFiles: 0,
  copiedFiles: 0,
  skippedFiles: 0,
  bytesCopied: 0,
  deletedFiles: 0,
});

export const createDefaultScheme = (): BackupScheme => ({
  id: 'default',
  name: '我的重要备份',
  sources: [],
  destination: null,
  lastRun: null,
  mode: BackupMode.INCREMENTAL,
});

export const createSchemeName = (schemeCount: number) => `新方案 ${schemeCount + 1}`;

export const buildSourcePathLabel = (name: string, isMock: boolean) =>
  `${isMock ? '(模拟) 源' : '源'}: .../${name}`;

export const buildDestinationPathLabel = (name: string, isMock: boolean) =>
  `${isMock ? '(模拟) 目标' : '目标'}: .../${name}`;

export const LOADING_TEXT = '正在加载...';
