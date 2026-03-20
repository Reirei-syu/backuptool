import { describe, expect, it } from 'vitest';
import { performBackup } from './backupService';
import { BackupMode, type BackupStats, type LogEntry } from '../types';
import { MockDirectoryHandle, MockFileHandle } from '../utils/compatibility';

const createStats = (): BackupStats => ({
  totalFiles: 0,
  processedFiles: 0,
  copiedFiles: 0,
  skippedFiles: 0,
  bytesCopied: 0,
  deletedFiles: 0,
});

describe('performBackup', () => {
  it('replaces a conflicting file with a directory instead of aborting the scheme', async () => {
    const source = new MockDirectoryHandle('src');
    source.children.set('docs', new MockDirectoryHandle('docs'));

    const destination = new MockDirectoryHandle('dest');
    const destSource = await destination.getDirectoryHandle('src', { create: true });
    destSource.children.set('docs', new MockFileHandle(new File(['legacy'], 'docs')));

    const logs: LogEntry[] = [];
    const result = await performBackup(
      [{ handle: source, name: 'src', targetName: 'src' }],
      destination,
      BackupMode.MIRROR,
      () => undefined,
      (log) => logs.push(log),
      createStats(),
    );

    expect(result.completed).toBe(true);
    expect(result.hadErrors).toBe(false);
    const repairedDirectory = await destSource.getDirectoryHandle('docs');
    expect(repairedDirectory.kind).toBe('directory');
    expect(logs.some((log) => log.type === 'warning')).toBe(true);
  });

  it('replaces a conflicting directory with a file when syncing files', async () => {
    const source = new MockDirectoryHandle('src');
    source.children.set('readme.txt', new MockFileHandle(new File(['new-content'], 'readme.txt', { lastModified: 10 })));

    const destination = new MockDirectoryHandle('dest');
    const destSource = await destination.getDirectoryHandle('src', { create: true });
    destSource.children.set('readme.txt', new MockDirectoryHandle('readme.txt'));

    const result = await performBackup(
      [{ handle: source, name: 'src', targetName: 'src' }],
      destination,
      BackupMode.INCREMENTAL,
      () => undefined,
      () => undefined,
      createStats(),
    );

    expect(result.completed).toBe(true);
    expect(result.hadErrors).toBe(false);
    const syncedFile = await destSource.getFileHandle('readme.txt');
    expect(syncedFile.kind).toBe('file');
  });
});
