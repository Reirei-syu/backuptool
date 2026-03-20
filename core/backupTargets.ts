import type { FolderItem } from '../types';

export interface ResolvedBackupSource {
  handle: FileSystemDirectoryHandle;
  name: string;
  targetName: string;
}

const createUniqueTargetName = (baseName: string, usedNames: Set<string>) => {
  const normalizedBaseName = baseName.trim() || 'source';
  if (!usedNames.has(normalizedBaseName)) {
    usedNames.add(normalizedBaseName);
    return normalizedBaseName;
  }

  let suffix = 2;
  let candidate = `${normalizedBaseName} (${suffix})`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBaseName} (${suffix})`;
  }

  usedNames.add(candidate);
  return candidate;
};

export const resolveBackupSources = (sources: FolderItem[]): ResolvedBackupSource[] => {
  const usedNames = new Set<string>();

  return sources.map((source) => ({
    handle: source.handle,
    name: source.name,
    targetName: createUniqueTargetName(source.name, usedNames),
  }));
};
