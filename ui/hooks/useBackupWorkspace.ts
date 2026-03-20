import { useEffect, useState } from 'react';
import { LOADING_TEXT, createDefaultScheme, createEmptyStats } from '../../config/backupDefaults';
import {
  addScheme,
  removeScheme,
  toggleSchemeSelection as toggleSchemeSelectionState,
  updateActiveScheme,
} from '../../core/schemeState';
import { BackupStatus, type BackupScheme, type BackupStats, type LogEntry } from '../../types';
import { runBackupSchemes } from '../../service/backupExecutionService';
import {
  convertFileListToHandle,
  createDestinationFolderItem,
  createSourceFolderItem,
  describeFileSystemError,
  isFileSystemApiSupported,
  pickDirectory,
  verifyPermission,
} from '../../service/fileSystemAccessService';
import { loadInitialSchemes, saveSchemes } from '../../service/schemeStorageService';

export interface AlertInfo {
  show: boolean;
  title: string;
  message: string;
}

export interface UseBackupWorkspaceResult {
  activeScheme: BackupScheme;
  activeSchemeId: string;
  alertInfo: AlertInfo | null;
  isBusy: boolean;
  isCompatible: boolean;
  isReady: boolean;
  loadingText: string;
  logs: LogEntry[];
  schemes: BackupScheme[];
  selectedSchemeIds: Set<string>;
  showLogs: boolean;
  stats: BackupStats;
  status: BackupStatus;
  addScheme: () => void;
  closeAlert: () => void;
  deleteScheme: (schemeId: string) => void;
  requestAddSource: () => Promise<'fallback' | void>;
  requestSetDestination: () => Promise<'fallback' | void>;
  selectScheme: (schemeId: string) => void;
  setShowLogs: (show: boolean) => void;
  startMultiBackup: () => Promise<void>;
  submitDestinationFiles: (files: FileList | null) => void;
  submitSourceFiles: (files: FileList | null) => void;
  toggleSchemeSelection: (schemeId: string) => void;
  updateScheme: (updates: Partial<BackupScheme>) => void;
}

export const useBackupWorkspace = (): UseBackupWorkspaceResult => {
  const [schemes, setSchemes] = useState<BackupScheme[]>([]);
  const [activeSchemeId, setActiveSchemeId] = useState('');
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<Set<string>>(new Set());
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isCompatible, setIsCompatible] = useState(true);
  const [status, setStatus] = useState<BackupStatus>(BackupStatus.IDLE);
  const [stats, setStats] = useState<BackupStats>(createEmptyStats());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setIsCompatible(isFileSystemApiSupported());

      try {
        const loadedSchemes = await loadInitialSchemes();
        if (cancelled) return;

        setSchemes(loadedSchemes);
        setActiveSchemeId(loadedSchemes[0].id);
        setSelectedSchemeIds(new Set([loadedSchemes[0].id]));
      } catch (error) {
        console.error(error);
        if (cancelled) return;

        const fallbackScheme = createDefaultScheme();
        setSchemes([fallbackScheme]);
        setActiveSchemeId(fallbackScheme.id);
        setSelectedSchemeIds(new Set([fallbackScheme.id]));
        setAlertInfo({
          show: true,
          title: '数据加载失败',
          message: '本地方案读取失败，已回退到默认方案。你仍然可以继续使用当前会话。',
        });
      } finally {
        if (!cancelled) {
          setIsDataLoaded(true);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDataLoaded) return;

    void saveSchemes(schemes).catch((error) => {
      console.error(error);
    });
  }, [isDataLoaded, schemes]);

  const activeScheme = schemes.find((scheme) => scheme.id === activeSchemeId) ?? schemes[0];
  const isReady = isDataLoaded && Boolean(activeScheme);
  const isBusy = status === BackupStatus.SCANNING || status === BackupStatus.COPYING;

  const updateScheme = (updates: Partial<BackupScheme>) => {
    setSchemes((previous) => updateActiveScheme({ schemes: previous, activeSchemeId, updates }));
  };

  const addSourceFromHandle = (handle: FileSystemDirectoryHandle, isMock: boolean) => {
    if (!activeScheme) return;

    updateScheme({
      sources: [...activeScheme.sources, createSourceFolderItem(handle, isMock)],
    });
  };

  const setDestinationFromHandle = (handle: FileSystemDirectoryHandle, isMock: boolean) => {
    updateScheme({
      destination: createDestinationFolderItem(handle, isMock, () => 'dest'),
    });
  };

  const addSchemeAction = () => {
    setSchemes((previousSchemes) => {
      const result = addScheme({
        schemes: previousSchemes,
        selectedSchemeIds,
      });
      setActiveSchemeId(result.activeSchemeId);
      setSelectedSchemeIds(result.selectedSchemeIds);
      return result.schemes;
    });
  };

  const deleteScheme = (schemeId: string) => {
    if (schemes.length === 1 || isBusy) return;

    const result = removeScheme({
      schemes,
      activeSchemeId,
      selectedSchemeIds,
      schemeId,
    });
    setSchemes(result.schemes);
    setActiveSchemeId(result.activeSchemeId);
    setSelectedSchemeIds(result.selectedSchemeIds);
  };

  const toggleSchemeSelection = (schemeId: string) => {
    setSelectedSchemeIds((previous) => toggleSchemeSelectionState(previous, schemeId));
  };

  const requestAddSource = async () => {
    if (!activeScheme) return;
    if (!isCompatible) return 'fallback';

    try {
      const handle = await pickDirectory();
      addSourceFromHandle(handle, false);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      setAlertInfo({ show: true, ...describeFileSystemError(error) });
    }
  };

  const requestSetDestination = async () => {
    if (!activeScheme) return;
    if (!isCompatible) return 'fallback';

    try {
      const handle = await pickDirectory({ mode: 'readwrite' });
      setDestinationFromHandle(handle, false);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      setAlertInfo({ show: true, ...describeFileSystemError(error) });
    }
  };

  const submitSourceFiles = (files: FileList | null) => {
    if (!files?.length) return;
    addSourceFromHandle(convertFileListToHandle(files) as unknown as FileSystemDirectoryHandle, true);
  };

  const submitDestinationFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setDestinationFromHandle(convertFileListToHandle(files) as unknown as FileSystemDirectoryHandle, true);
  };

  const startMultiBackup = async () => {
    if (selectedSchemeIds.size === 0) return;

    setLogs([]);
    setStats(createEmptyStats());
    setStatus(BackupStatus.SCANNING);
    setShowLogs(true);

    const result = await runBackupSchemes({
      schemes,
      selectedSchemeIds,
      verifyPermission,
      onLog: (log) => setLogs((previous) => [...previous, log]),
      onProgress: (nextStats) => setStats(nextStats),
      onSchemeStarted: () => setStatus(BackupStatus.COPYING),
      onSchemeCompleted: (schemeId, completedAt) => {
        setSchemes((previous) =>
          previous.map((scheme) =>
            scheme.id === schemeId ? { ...scheme, lastRun: completedAt } : scheme,
          ),
        );
      },
    });

    setStats(result.stats);
    setStatus(result.finalStatus);
  };

  return {
    activeScheme,
    activeSchemeId,
    alertInfo,
    isBusy,
    isCompatible,
    isReady,
    loadingText: LOADING_TEXT,
    logs,
    schemes,
    selectedSchemeIds,
    showLogs,
    stats,
    status,
    addScheme: addSchemeAction,
    closeAlert: () => setAlertInfo(null),
    deleteScheme,
    requestAddSource,
    requestSetDestination,
    selectScheme: (schemeId) => {
      if (!isBusy) {
        setActiveSchemeId(schemeId);
      }
    },
    setShowLogs,
    startMultiBackup,
    submitDestinationFiles,
    submitSourceFiles,
    toggleSchemeSelection,
    updateScheme,
  };
};
