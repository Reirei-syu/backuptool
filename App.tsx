import { LOADING_TEXT } from './config/backupDefaults';
import { BackupWorkspaceScreen } from './ui/components/BackupWorkspaceScreen';
import { useBackupWorkspace } from './ui/hooks/useBackupWorkspace';

const App = () => {
  const workspace = useBackupWorkspace();

  if (!workspace.isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        {LOADING_TEXT}
      </div>
    );
  }

  return <BackupWorkspaceScreen {...workspace} />;
};

export default App;
