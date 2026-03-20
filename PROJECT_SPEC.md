# GlassBackup 项目规格说明

## 1. 项目目标

GlassBackup 是一个浏览器端的轻量备份工具，面向个人文件夹同步场景，提供以下核心能力：

- 管理多个备份方案
- 为每个方案配置多个源目录和一个目标目录
- 支持“增量备份”与“镜像备份”两种执行模式
- 展示会话统计与可追踪运行日志
- 在不支持 File System Access API 的浏览器中提供模拟回退路径

## 2. 功能范围

### 2.1 备份方案管理

- 新增、删除、编辑备份方案
- 多选方案后批量执行
- 每个方案独立维护：
  - 方案名称
  - 源目录列表
  - 目标目录
  - 备份模式
  - 最后成功执行时间

### 2.2 备份模式

- `INCREMENTAL`
  - 仅复制新增或已变更文件
  - 目标目录中的多余文件保留
- `MIRROR`
  - 复制新增或已变更文件
  - 删除目标目录中源目录不存在的冗余内容

### 2.3 兼容策略

- 支持 `showDirectoryPicker` 时：
  - 直接请求浏览器文件系统授权
  - 源目录使用只读权限
  - 目标目录使用读写权限
- 不支持 `showDirectoryPicker` 时：
  - 使用 `input[webkitdirectory]` 读取目录快照
  - 通过 `MockDirectoryHandle` / `MockFileHandle` 模拟目录结构
  - 该模式仅用于流程演示与兼容回退，不代表真实磁盘写入

## 3. 当前模块结构

> 当前仓库是渐进式整理状态，尚未完全迁移到理想的 `/ui` 目录结构。

- [App.tsx](/D:/coding/backuptool/App.tsx)
  - 页面入口
  - 负责 UI 状态、交互绑定、日志弹窗、方案选择
  - 只调用 service / utils，不直接执行文件同步
- [components/GlassCard.tsx](/D:/coding/backuptool/components/GlassCard.tsx)
  - 通用玻璃态卡片 UI
- [core/backupTargets.ts](/D:/coding/backuptool/core/backupTargets.ts)
  - 纯逻辑层
  - 负责为同名源目录生成稳定且唯一的目标子目录名
- [services/backupExecutionService.ts](/D:/coding/backuptool/services/backupExecutionService.ts)
  - 业务编排层
  - 负责批量执行方案、权限校验、状态汇总、成功回写
- [services/backupService.ts](/D:/coding/backuptool/services/backupService.ts)
  - 文件系统同步服务
  - 负责目录递归、文件比较、镜像清理、冲突恢复
- [utils/compatibility.ts](/D:/coding/backuptool/utils/compatibility.ts)
  - 浏览器兼容与 mock 文件系统实现
- [utils/storage.ts](/D:/coding/backuptool/utils/storage.ts)
  - IndexedDB 持久化

## 4. 核心执行规则

### 4.1 同名源目录规则

同一方案下如果存在多个同名源目录，执行时必须映射到不同目标子目录。

示例：

- 第一个 `photos` -> `photos`
- 第二个 `photos` -> `photos (2)`
- 第三个 `photos` -> `photos (3)`

这样可以避免镜像模式下多个同名源目录互相覆盖和误删。

### 4.2 权限校验规则

方案开始执行前必须完成权限检查：

- 任一源目录无权限：整套方案跳过
- 目标目录无权限：整套方案跳过
- 被跳过的方案不得更新 `lastRun`
- 有失败或跳过项时，最终状态不得标记为纯成功

### 4.3 类型冲突恢复规则

当目标端同一路径出现“文件/目录类型不一致”时：

- 源是目录、目标是文件：删除目标文件并重建目录
- 源是文件、目标是目录：删除目标目录并重建文件

该恢复必须继续当前方案，而不是直接中断整套备份。

### 4.4 成功判定规则

只有在以下条件同时满足时，方案才算成功：

- 权限校验通过
- 同步过程未产生 error
- 文件系统处理未中断

只有成功方案才会写回 `lastRun`。

## 5. 数据模型

### 5.1 `BackupScheme`

- `id: string`
- `name: string`
- `sources: FolderItem[]`
- `destination: FolderItem | null`
- `mode: BackupMode`
- `lastRun: Date | null`

### 5.2 `FolderItem`

- `id: string`
- `name: string`
- `handle: FileSystemDirectoryHandle`
- `pathLabel: string`

### 5.3 `BackupExecutionResult`

- `stats: BackupStats`
- `completed: boolean`
- `hadErrors: boolean`

## 6. 本次修复内容

### 6.1 已修复

- 修复同名源目录在镜像模式下互相覆盖的问题
- 修复文件/目录类型冲突导致整套方案中断的问题
- 修复权限拒绝后仍继续执行且误更新 `lastRun` 的问题
- 修复最终状态无条件显示完成的问题
- 修复非 File System Access API 环境下无法设置目标目录的问题
- 补充 IndexedDB 读取失败时的默认回退，避免页面卡在加载态
- 补充 Vitest 自动化测试与计划文档

### 6.2 影响范围

- 方案执行状态流
- 目标目录映射逻辑
- 文件系统冲突恢复逻辑
- 浏览器兼容回退路径
- 项目验证流程

## 7. 验证基线

当前必须通过以下验证：

- `npm test`
- `npm run build`

当前验证结果：

- 单元测试：通过
- 生产构建：通过

## 8. 已知风险与后续建议

### 8.1 当前风险

- 非兼容浏览器中的回退模式属于 mock，同步结果不会真实写入磁盘
- 项目目录尚未完全收敛到 `/config /core /service /ui` 的理想分层
- `index.html` 仍依赖 `cdn.tailwindcss.com`，适合原型或单文件分发，不适合长期生产化
- `vite` 仍存在 dev-only 的 `esbuild` 审计提示，若要彻底消除需要评估大版本升级

### 8.2 建议

- 下一步将页面组件迁入 `ui/`，逐步消除根目录中的 UI 入口耦合
- 为 `storage.ts` 增加独立测试，覆盖 IndexedDB 异常路径
- 视交付目标决定是否将 Tailwind CDN 改为本地构建
