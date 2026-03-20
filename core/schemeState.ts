import { createSchemeName } from '../config/backupDefaults';
import { BackupMode, type BackupScheme } from '../types';

const createRandomId = () => Math.random().toString(36).slice(2, 11);

interface AddSchemeOptions {
  schemes: BackupScheme[];
  selectedSchemeIds: Set<string>;
  createId?: () => string;
}

interface UpdateActiveSchemeOptions {
  schemes: BackupScheme[];
  activeSchemeId: string;
  updates: Partial<BackupScheme>;
}

interface RemoveSchemeOptions {
  schemes: BackupScheme[];
  activeSchemeId: string;
  selectedSchemeIds: Set<string>;
  schemeId: string;
}

export const addScheme = ({
  schemes,
  selectedSchemeIds,
  createId = createRandomId,
}: AddSchemeOptions) => {
  const scheme: BackupScheme = {
    id: createId(),
    name: createSchemeName(schemes.length),
    sources: [],
    destination: null,
    lastRun: null,
    mode: BackupMode.INCREMENTAL,
  };

  const nextSelectedSchemeIds = new Set(selectedSchemeIds);
  nextSelectedSchemeIds.add(scheme.id);

  return {
    scheme,
    schemes: [...schemes, scheme],
    activeSchemeId: scheme.id,
    selectedSchemeIds: nextSelectedSchemeIds,
  };
};

export const updateActiveScheme = ({
  schemes,
  activeSchemeId,
  updates,
}: UpdateActiveSchemeOptions) => {
  return schemes.map((scheme) =>
    scheme.id === activeSchemeId ? { ...scheme, ...updates } : scheme,
  );
};

export const removeScheme = ({
  schemes,
  activeSchemeId,
  selectedSchemeIds,
  schemeId,
}: RemoveSchemeOptions) => {
  const nextSchemes = schemes.filter((scheme) => scheme.id !== schemeId);
  const nextSelectedSchemeIds = new Set(selectedSchemeIds);
  nextSelectedSchemeIds.delete(schemeId);

  return {
    schemes: nextSchemes,
    activeSchemeId: activeSchemeId === schemeId ? nextSchemes[0]?.id ?? '' : activeSchemeId,
    selectedSchemeIds: nextSelectedSchemeIds,
  };
};

export const toggleSchemeSelection = (selectedSchemeIds: Set<string>, schemeId: string) => {
  const nextSelectedSchemeIds = new Set(selectedSchemeIds);
  if (nextSelectedSchemeIds.has(schemeId)) {
    nextSelectedSchemeIds.delete(schemeId);
  } else {
    nextSelectedSchemeIds.add(schemeId);
  }
  return nextSelectedSchemeIds;
};
