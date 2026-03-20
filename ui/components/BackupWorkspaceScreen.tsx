import { BackupLogModal } from './BackupLogModal';
import { AlertModal } from './AlertModal';
import { SchemeEditor } from './SchemeEditor';
import { SchemeSidebar } from './SchemeSidebar';
import { SessionSummary } from './SessionSummary';
import type { UseBackupWorkspaceResult } from '../hooks/useBackupWorkspace';

type BackupWorkspaceScreenProps = UseBackupWorkspaceResult;

export const BackupWorkspaceScreen = ({
  activeScheme,
  activeSchemeId,
  alertInfo,
  isBusy,
  logs,
  schemes,
  selectedSchemeIds,
  showLogs,
  stats,
  status,
  addScheme,
  closeAlert,
  deleteScheme,
  requestAddSource,
  requestSetDestination,
  selectScheme,
  setShowLogs,
  startMultiBackup,
  submitDestinationFiles,
  submitSourceFiles,
  toggleSchemeSelection,
  updateScheme,
}: BackupWorkspaceScreenProps) => {
  return (
    <div className="min-h-screen w-full flex flex-col p-4 md:p-6 lg:p-8 font-sans selection:bg-blue-100">
      <style>{`
        @keyframes rainbow-flow {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-rainbow {
          background-size: 200% 100%;
          animation: rainbow-flow 3s linear infinite;
        }
      `}</style>

      <AlertModal alertInfo={alertInfo} onClose={closeAlert} />
      <BackupLogModal logs={logs} show={showLogs} onClose={() => setShowLogs(false)} />

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto mx-auto">
        <SchemeSidebar
          activeSchemeId={activeSchemeId}
          isBusy={isBusy}
          schemes={schemes}
          selectedSchemeIds={selectedSchemeIds}
          onAddScheme={addScheme}
          onDeleteScheme={deleteScheme}
          onSelectScheme={selectScheme}
          onToggleSchemeSelection={toggleSchemeSelection}
        />
        <SchemeEditor
          activeScheme={activeScheme}
          isBusy={isBusy}
          selectedCount={selectedSchemeIds.size}
          stats={stats}
          status={status}
          updateScheme={updateScheme}
          requestAddSource={requestAddSource}
          requestSetDestination={requestSetDestination}
          submitSourceFiles={submitSourceFiles}
          submitDestinationFiles={submitDestinationFiles}
          startMultiBackup={startMultiBackup}
        />
        <SessionSummary stats={stats} onShowLogs={() => setShowLogs(true)} />
      </div>
    </div>
  );
};
