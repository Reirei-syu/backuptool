import { describe, expect, it } from 'vitest';
import {
  MockDirectoryHandle,
  createDestinationFolderItem,
  createSourceFolderItem,
  describeFileSystemError,
  verifyPermission,
} from './fileSystemAccessService';

describe('fileSystemAccessService', () => {
  it('treats handles without permission API as accessible', async () => {
    await expect(verifyPermission({}, 'read')).resolves.toBe(true);
  });

  it('normalizes permission errors to a user-facing message', () => {
    const detail = describeFileSystemError({ name: 'SecurityError' });
    expect(detail.title).toBe('权限受限');
    expect(detail.message).toContain('浏览器安全策略');
  });

  it('creates source and destination folder items with proper labels', () => {
    const handle = new MockDirectoryHandle('photos') as unknown as FileSystemDirectoryHandle;

    const source = createSourceFolderItem(handle, true, () => 'source-1');
    const destination = createDestinationFolderItem(handle, false, () => 'dest-1');

    expect(source).toMatchObject({
      id: 'source-1',
      name: 'photos',
      pathLabel: '(模拟) 源: .../photos',
    });
    expect(destination).toMatchObject({
      id: 'dest-1',
      name: 'photos',
      pathLabel: '目标: .../photos',
    });
  });
});
