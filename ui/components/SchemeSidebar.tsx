import { Check, Layers, PlusCircle, Settings2, Trash2 } from 'lucide-react';
import { GlassCard } from '../../components/GlassCard';
import { BackupMode, type BackupScheme } from '../../types';

interface SchemeSidebarProps {
  activeSchemeId: string;
  isBusy: boolean;
  schemes: BackupScheme[];
  selectedSchemeIds: Set<string>;
  onAddScheme: () => void;
  onDeleteScheme: (schemeId: string) => void;
  onSelectScheme: (schemeId: string) => void;
  onToggleSchemeSelection: (schemeId: string) => void;
}

export const SchemeSidebar = ({
  activeSchemeId,
  isBusy,
  schemes,
  selectedSchemeIds,
  onAddScheme,
  onDeleteScheme,
  onSelectScheme,
  onToggleSchemeSelection,
}: SchemeSidebarProps) => {
  return (
    <div className="lg:col-span-3 flex flex-col gap-5">
      <div className="flex items-center gap-3 px-4 py-3 bg-white/60 rounded-2xl border border-sky-100/80 backdrop-blur-md shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-100">
          <Layers className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-black text-slate-800 tracking-tight">备份方案库</h1>
      </div>

      <GlassCard
        title="全部方案"
        icon={<Settings2 className="w-4 h-4 text-sky-600" />}
        className="flex-1 overflow-hidden"
        actions={
          <button onClick={onAddScheme} className="text-sky-600 hover:scale-110 transition-transform">
            <PlusCircle className="w-5 h-5" />
          </button>
        }
      >
        <div className="space-y-3 mt-3 max-h-[500px] overflow-y-auto pr-1">
          {schemes.map((scheme) => (
            <div
              key={scheme.id}
              onClick={() => onSelectScheme(scheme.id)}
              className={`group relative flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all border ${
                activeSchemeId === scheme.id
                  ? 'bg-white border-sky-200 shadow-md translate-x-1'
                  : 'bg-white/45 border-transparent hover:bg-white/70'
              }`}
            >
              <div
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleSchemeSelection(scheme.id);
                }}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedSchemeIds.has(scheme.id)
                    ? 'bg-sky-500 border-sky-500 text-white'
                    : 'border-slate-300 bg-white/70'
                }`}
              >
                {selectedSchemeIds.has(scheme.id) && <Check className="w-3 h-3 stroke-[4px]" />}
              </div>

              <div className="flex-1 overflow-hidden">
                <div
                  className={`text-sm font-bold truncate ${
                    activeSchemeId === scheme.id ? 'text-sky-800' : 'text-slate-600'
                  }`}
                >
                  {scheme.name}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                  {scheme.mode === BackupMode.MIRROR ? '镜像模式' : '增量模式'}
                </div>
              </div>

              {activeSchemeId === scheme.id && schemes.length > 1 && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteScheme(scheme.id);
                  }}
                  disabled={isBusy}
                  className="p-1 text-slate-300 hover:text-sky-600 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};
