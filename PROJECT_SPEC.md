# GlassBackup 项目规格说明

## 1. 项目目标

GlassBackup 是一个浏览器端文件夹备份工具，面向个人场景提供：

- 多方案管理
- 多源目录到单目标目录的同步
- 增量备份与镜像备份两种模式
- 会话统计与运行日志
- 不支持 File System Access API 时的回退体验

## 2. 当前分层结构

本次重整后，项目按以下职责分层：

### `/config`

- [backupDefaults.ts](/D:/coding/backuptool/config/backupDefaults.ts)
- 负责默认数据、默认文案、路径标签规则

### `/core`

- [backupTargets.ts](/D:/coding/backuptool/core/backupTargets.ts)
- [schemeState.ts](/D:/coding/backuptool/core/schemeState.ts)
- 负责纯逻辑计算，不接触浏览器 API、IndexedDB 或 React

### `/service`

- [backupService.ts](/D:/coding/backuptool/service/backupService.ts)
- [backupExecutionService.ts](/D:/coding/backuptool/service/backupExecutionService.ts)
- [fileSystemAccessService.ts](/D:/coding/backuptool/service/fileSystemAccessService.ts)
- [schemeStorageService.ts](/D:/coding/backuptool/service/schemeStorageService.ts)
- 负责文件系统适配、备份编排、持久化和运行时副作用

### `/ui`

- [useBackupWorkspace.ts](/D:/coding/backuptool/ui/hooks/useBackupWorkspace.ts)
- [BackupWorkspaceScreen.tsx](/D:/coding/backuptool/ui/components/BackupWorkspaceScreen.tsx)
- [SchemeSidebar.tsx](/D:/coding/backuptool/ui/components/SchemeSidebar.tsx)
- [SchemeEditor.tsx](/D:/coding/backuptool/ui/components/SchemeEditor.tsx)
- [SessionSummary.tsx](/D:/coding/backuptool/ui/components/SessionSummary.tsx)
- [AlertModal.tsx](/D:/coding/backuptool/ui/components/AlertModal.tsx)
- [BackupLogModal.tsx](/D:/coding/backuptool/ui/components/BackupLogModal.tsx)
- 负责渲染与交互绑定，不直接访问 IndexedDB 或底层文件系统逻辑

## 3. 兼容层说明

为避免一次性大改，本次保留了两个兼容目录：

- [services/backupService.ts](/D:/coding/backuptool/services/backupService.ts)
- [services/backupExecutionService.ts](/D:/coding/backuptool/services/backupExecutionService.ts)
- [utils/compatibility.ts](/D:/coding/backuptool/utils/compatibility.ts)
- [utils/storage.ts](/D:/coding/backuptool/utils/storage.ts)

这些文件现在只做 re-export，用于兼容旧导入路径。  
后续可以在确认没有遗留引用后删除。

## 4. 核心业务规则

### 4.1 方案执行

- 每个方案包含：
  - 名称
  - 多个源目录
  - 一个目标目录
  - 备份模式
  - 最后成功执行时间

### 4.2 同名源目录规则

同一方案中若存在多个同名源目录，执行时必须映射到不同目标子目录：

- `photos`
- `photos (2)`
- `photos (3)`

目的：避免镜像模式下不同源目录互相覆盖或误删。

### 4.3 权限规则

- 任一源目录读权限失败：整套方案跳过
- 目标目录读写权限失败：整套方案跳过
- 被跳过或失败的方案不得更新 `lastRun`
- 只要有失败或跳过项，最终状态不得显示为纯成功

### 4.4 类型冲突恢复

目标端若出现同一路径“文件/目录类型不一致”：

- 源是目录、目标是文件：删除目标文件并重建目录
- 源是文件、目标是目录：删除目标目录并重建文件

恢复后继续当前方案，而不是直接中断整个任务。

## 5. 浏览器兼容策略

### 5.1 支持 File System Access API

- 使用 `showDirectoryPicker`
- 源目录请求 `read`
- 目标目录请求 `readwrite`

### 5.2 不支持 File System Access API

- 使用 `input[webkitdirectory]`
- 用 mock 目录句柄模拟树结构
- 该模式用于流程回退和演示，不代表真实磁盘写入

## 6. 本次架构重整内容

### 6.1 已完成

- 将页面状态编排从 [App.tsx](/D:/coding/backuptool/App.tsx) 抽离到 hook
- 将页面拆成侧栏、编辑区、统计区、告警弹窗、日志弹窗
- 将默认值和命名规则移入 `config`
- 将方案增删改查纯逻辑移入 `core`
- 将文件系统访问与 IndexedDB 持久化移入 `service`
- 为新层补充自动化测试

### 6.2 当前收益

- `App.tsx` 变为薄入口
- UI 不再直接依赖 IndexedDB 与权限 API
- 纯逻辑模块可单测
- 服务边界更清晰，后续扩展 dry-run、差异预览或桌面版适配更容易

## 7. 验证基线

必须通过：

- `npm test`
- `npm run build`

当前结果：

- 单元测试：通过
- 生产构建：通过

## 8. 已知风险与后续建议

### 8.1 已知风险

- 非兼容浏览器回退模式仍是 mock，不会真实写盘
- 兼容 shim 目录仍存在，需要后续清理
- [components/GlassCard.tsx](/D:/coding/backuptool/components/GlassCard.tsx) 仍在旧目录，尚未完全并入 `/ui`
- `index.html` 仍依赖 Tailwind CDN，适合当前分发方式，但不适合长期生产化

### 8.2 后续建议

- 清理旧 `services/` 与 `utils/` shim
- 继续把公共 UI 组件迁入 `/ui/components`
- 为 `schemeStorageService` 增加独立测试
- 评估把 Tailwind CDN 改为本地构建
