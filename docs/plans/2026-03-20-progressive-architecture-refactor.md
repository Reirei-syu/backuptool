# Progressive Architecture Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变现有功能边界的前提下，把备份工具重整为更接近 `/config /core /service /ui` 分层的结构，并降低页面层与浏览器 API、存储 API 的直接耦合。

**Architecture:** 本次重整保持备份执行算法与 UI 外观不变，重点拆出四层职责：`config` 提供默认数据和文案，`core` 处理纯状态变更，`service` 封装目录访问、持久化和备份编排，`ui` 只负责渲染和交互绑定。现有 `backupService` 与 `backupExecutionService` 迁入 `service`，`App.tsx` 缩减为薄入口。

**Tech Stack:** React 18, TypeScript, Vite, Vitest, IndexedDB, File System Access API mock

---

### Task 1: 建立重整前的失败用例

**Files:**
- Create: `D:\coding\backuptool\core\schemeState.test.ts`
- Create: `D:\coding\backuptool\service\fileSystemAccessService.test.ts`

**Step 1: Write the failing test**

- 为纯状态层写用例，覆盖：
  - 新增方案默认命名与默认选中
  - 删除当前方案后的活动方案回退
  - 切换勾选集合
- 为文件系统适配层写用例，覆盖：
  - 没有权限 API 时应视为可访问
  - 权限错误提示文案归一化
  - 目录句柄转换为 `FolderItem`

**Step 2: Run test to verify it fails**

Run: `npm test -- core/schemeState.test.ts service/fileSystemAccessService.test.ts`
Expected: 因模块尚不存在而失败

### Task 2: 提取 config / core / service

**Files:**
- Create: `D:\coding\backuptool\config\backupDefaults.ts`
- Create: `D:\coding\backuptool\core\schemeState.ts`
- Create: `D:\coding\backuptool\service\backupService.ts`
- Create: `D:\coding\backuptool\service\backupExecutionService.ts`
- Create: `D:\coding\backuptool\service\fileSystemAccessService.ts`
- Create: `D:\coding\backuptool\service\schemeStorageService.ts`
- Modify: `D:\coding\backuptool\core\backupTargets.ts`

**Step 1: Implement minimal code**

- 把默认状态和命名规则移入 `config`
- 把方案增删改选中逻辑移入 `core`
- 把权限、picker、mock 文件系统、错误归一化移入 `service`
- 把 IndexedDB 持久化移入 `service`
- 保持现有备份执行测试继续通过

**Step 2: Run targeted tests**

Run: `npm test -- core/schemeState.test.ts service/fileSystemAccessService.test.ts`
Expected: PASS

### Task 3: 提取 ui hook 与页面组件

**Files:**
- Create: `D:\coding\backuptool\ui\hooks\useBackupWorkspace.ts`
- Create: `D:\coding\backuptool\ui\components\AlertModal.tsx`
- Create: `D:\coding\backuptool\ui\components\BackupLogModal.tsx`
- Create: `D:\coding\backuptool\ui\components\BackupWorkspaceScreen.tsx`
- Modify: `D:\coding\backuptool\App.tsx`

**Step 1: Implement minimal code**

- hook 负责页面状态和动作编排
- 组件只接收数据和回调，不直接访问浏览器文件系统或 IndexedDB
- `App.tsx` 仅保留入口与加载态包装

**Step 2: Run full test**

Run: `npm test`
Expected: PASS

### Task 4: 清理旧路径并更新文档

**Files:**
- Modify: `D:\coding\backuptool\PROJECT_SPEC.md`
- Modify: `D:\coding\backuptool\README.md`
- Delete or stop referencing: `D:\coding\backuptool\utils\storage.ts`
- Delete or stop referencing: `D:\coding\backuptool\utils\compatibility.ts`

**Step 1: Document**

- 写清新分层职责
- 记录仍未完成的渐进项
- 更新运行与测试说明

**Step 2: Final verification**

Run:
- `npm test`
- `npm run build`

Expected:
- 所有测试通过
- 构建通过
