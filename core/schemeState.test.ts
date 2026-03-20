import { describe, expect, it } from 'vitest';
import { addScheme, removeScheme, toggleSchemeSelection, updateActiveScheme } from './schemeState';
import { BackupMode, type BackupScheme } from '../types';

const createScheme = (id: string, name: string): BackupScheme => ({
  id,
  name,
  sources: [],
  destination: null,
  mode: BackupMode.INCREMENTAL,
  lastRun: null,
});

describe('schemeState', () => {
  it('adds a new scheme and selects it by default', () => {
    const result = addScheme({
      schemes: [createScheme('default', '我的重要备份')],
      selectedSchemeIds: new Set(['default']),
      createId: () => 'scheme-2',
    });

    expect(result.scheme.id).toBe('scheme-2');
    expect(result.scheme.name).toBe('新方案 2');
    expect(result.activeSchemeId).toBe('scheme-2');
    expect(Array.from(result.selectedSchemeIds)).toContain('scheme-2');
  });

  it('removes the active scheme and falls back to the next available scheme', () => {
    const result = removeScheme({
      schemes: [createScheme('s1', '方案 1'), createScheme('s2', '方案 2')],
      activeSchemeId: 's1',
      selectedSchemeIds: new Set(['s1', 's2']),
      schemeId: 's1',
    });

    expect(result.schemes.map((scheme) => scheme.id)).toEqual(['s2']);
    expect(result.activeSchemeId).toBe('s2');
    expect(Array.from(result.selectedSchemeIds)).toEqual(['s2']);
  });

  it('updates only the active scheme', () => {
    const result = updateActiveScheme({
      schemes: [createScheme('s1', '方案 1'), createScheme('s2', '方案 2')],
      activeSchemeId: 's2',
      updates: { name: '已更新方案' },
    });

    expect(result[0].name).toBe('方案 1');
    expect(result[1].name).toBe('已更新方案');
  });

  it('toggles selection membership', () => {
    const selected = toggleSchemeSelection(new Set(['s1']), 's2');
    expect(Array.from(selected).sort()).toEqual(['s1', 's2']);

    const unselected = toggleSchemeSelection(selected, 's1');
    expect(Array.from(unselected)).toEqual(['s2']);
  });
});
