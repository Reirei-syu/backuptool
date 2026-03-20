import { describe, expect, it, vi } from 'vitest';
import { runBackupSchemes } from './backupExecutionService';
import { BackupMode, BackupStatus, type BackupScheme, type BackupStats, type FolderItem } from '../types';
import { MockDirectoryHandle } from '../utils/compatibility';

const createStats = (): BackupStats => ({
  totalFiles: 0,
  processedFiles: 0,
  copiedFiles: 0,
  skippedFiles: 0,
  bytesCopied: 0,
  deletedFiles: 0,
});

const createSource = (id: string, name: string): FolderItem => ({
  id,
  name,
  handle: new MockDirectoryHandle(name) as unknown as FileSystemDirectoryHandle,
  pathLabel: `source:${name}`,
});

const createDestination = (name = 'dest'): FolderItem => ({
  id: 'dest',
  name,
  handle: new MockDirectoryHandle(name) as unknown as FileSystemDirectoryHandle,
  pathLabel: `dest:${name}`,
});

const createScheme = (overrides: Partial<BackupScheme> = {}): BackupScheme => ({
  id: 'scheme-1',
  name: '方案 1',
  sources: [createSource('source-1', 'photos')],
  destination: createDestination(),
  mode: BackupMode.INCREMENTAL,
  lastRun: null,
  ...overrides,
});

describe('runBackupSchemes', () => {
  it('assigns unique target folders for duplicate source names', async () => {
    const scheme = createScheme({
      sources: [createSource('source-1', 'photos'), createSource('source-2', 'photos')],
    });
    const performBackup = vi.fn().mockResolvedValue({
      stats: createStats(),
      completed: true,
      hadErrors: false,
    });

    await runBackupSchemes({
      schemes: [scheme],
      selectedSchemeIds: new Set([scheme.id]),
      verifyPermission: vi.fn().mockResolvedValue(true),
      performBackup,
      onLog: () => undefined,
      onProgress: () => undefined,
      onSchemeCompleted: vi.fn(),
    });

    expect(performBackup).toHaveBeenCalledTimes(1);
    expect(performBackup.mock.calls[0][0]).toMatchObject([
      { name: 'photos', targetName: 'photos' },
      { name: 'photos', targetName: 'photos (2)' },
    ]);
  });

  it('skips the whole scheme when a source permission is denied', async () => {
    const deniedHandle = new MockDirectoryHandle('restricted');
    const scheme = createScheme({
      sources: [
        {
          id: 'source-1',
          name: 'restricted',
          handle: deniedHandle as unknown as FileSystemDirectoryHandle,
          pathLabel: 'source:restricted',
        },
      ],
    });
    const performBackup = vi.fn();
    const onSchemeCompleted = vi.fn();

    const result = await runBackupSchemes({
      schemes: [scheme],
      selectedSchemeIds: new Set([scheme.id]),
      verifyPermission: vi.fn(async (handle: unknown) => handle !== deniedHandle),
      performBackup,
      onLog: () => undefined,
      onProgress: () => undefined,
      onSchemeCompleted,
    });

    expect(performBackup).not.toHaveBeenCalled();
    expect(onSchemeCompleted).not.toHaveBeenCalled();
    expect(result.finalStatus).toBe(BackupStatus.ERROR);
  });

  it('keeps the final status in error when backup execution reports failures', async () => {
    const scheme = createScheme();
    const onSchemeCompleted = vi.fn();

    const result = await runBackupSchemes({
      schemes: [scheme],
      selectedSchemeIds: new Set([scheme.id]),
      verifyPermission: vi.fn().mockResolvedValue(true),
      performBackup: vi.fn().mockResolvedValue({
        stats: createStats(),
        completed: false,
        hadErrors: true,
      }),
      onLog: () => undefined,
      onProgress: () => undefined,
      onSchemeCompleted,
    });

    expect(onSchemeCompleted).not.toHaveBeenCalled();
    expect(result.finalStatus).toBe(BackupStatus.ERROR);
  });
});
