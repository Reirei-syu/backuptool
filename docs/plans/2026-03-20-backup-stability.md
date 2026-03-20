# Backup Stability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复备份工具的关键运行缺陷，并补齐项目规格文档与可重复验证手段。

**Architecture:** 保持现有 React + service 结构不大改，新增少量纯逻辑辅助层，把“同名源目录映射、方案执行状态汇总”从 UI 中抽离到可测试模块。备份文件系统处理继续放在 service 层，文档和验证脚本独立维护。

**Tech Stack:** React 18, TypeScript, Vite, Vitest, File System Access API mock

---

### Task 1: 建立测试入口

**Files:**
- Modify: `D:\coding\backuptool\package.json`
- Create: `D:\coding\backuptool\services\backupService.test.ts`
- Create: `D:\coding\backuptool\services\backupExecutionService.test.ts`

**Step 1: Write the failing tests**

- 为以下行为写失败用例：
  - 同一方案中同名源目录必须映射为不同目标目录
  - 权限拒绝时必须跳过方案且不更新最后运行时间
  - 备份核心遇到文件/目录类型冲突时必须可恢复处理
  - 备份执行出现错误时最终状态不能标记为完成

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: 因缺失执行服务与冲突处理逻辑而失败

### Task 2: 修复备份执行状态流

**Files:**
- Create: `D:\coding\backuptool\core\backupTargets.ts`
- Create: `D:\coding\backuptool\services\backupExecutionService.ts`
- Modify: `D:\coding\backuptool\App.tsx`

**Step 1: Write the minimal implementation**

- 抽离方案执行编排逻辑
- 在 service 中汇总错误/跳过/成功状态
- 只在方案真实成功后更新 `lastRun`
- 为同名源目录生成唯一目标子目录名

**Step 2: Run targeted tests**

Run: `npm test -- services/backupExecutionService.test.ts`
Expected: PASS

### Task 3: 修复备份核心冲突处理

**Files:**
- Modify: `D:\coding\backuptool\services\backupService.ts`
- Modify: `D:\coding\backuptool\utils\compatibility.ts`

**Step 1: Write the minimal implementation**

- 处理目标端“文件/目录类型冲突”
- 返回明确的执行结果对象，而不是只回传统计
- 改进 mock 写入行为，避免模拟环境与真实行为偏差过大

**Step 2: Run targeted tests**

Run: `npm test -- services/backupService.test.ts`
Expected: PASS

### Task 4: 补齐非兼容浏览器回退路径

**Files:**
- Modify: `D:\coding\backuptool\App.tsx`

**Step 1: Implement**

- 为目标目录添加回退输入
- 保持源目录与目标目录回退行为一致

**Step 2: Verify**

Run: `npm run build`
Expected: PASS

### Task 5: 创建规格文档

**Files:**
- Create: `D:\coding\backuptool\PROJECT_SPEC.md`

**Step 1: Document**

- 说明项目目标、模块职责、备份模式、浏览器兼容策略
- 记录本次修复内容、影响范围、已知风险

**Step 2: Final verification**

Run:
- `npm test`
- `npm run build`

Expected:
- 全部测试通过
- 构建通过
