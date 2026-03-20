# GlassBackup

GlassBackup 是一个基于 React + TypeScript + Vite 的浏览器端备份工具，支持多方案、多源目录、增量备份与镜像备份。

## 功能

- 多个备份方案管理
- 多选方案批量执行
- 增量备份
- 镜像备份
- 会话统计与运行日志
- File System Access API 回退支持

## 开发

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 运行测试

```bash
npm test
```

### 构建

```bash
npm run build
```

## GitHub Pages 自动部署

仓库已增加 [deploy-pages.yml](./.github/workflows/deploy-pages.yml)。

使用方式：

1. 在 GitHub 仓库 `Settings -> Pages`
2. `Build and deployment -> Source` 选择 `GitHub Actions`
3. push 到 `main` 后会自动执行：
   - `npm ci`
   - `npm test`
   - `npm run build`
   - 部署 `dist/` 到 GitHub Pages

说明：

- 当前 `vite.config.ts` 已配置 `base: './'`，适合 Pages 子路径访问
- 想完整使用目录选择与真实写盘，建议使用 Chromium 系浏览器访问 Pages 链接
- 非 Chromium 浏览器只能走回退模式，无法提供完整真实写盘能力

## 目录说明

- `config/`：默认值与配置规则
- `core/`：纯逻辑
- `service/`：文件系统、持久化、备份编排
- `ui/`：页面、组件、hooks
- `services/`、`utils/`：旧路径兼容层，后续可清理

详细设计见 [PROJECT_SPEC.md](./PROJECT_SPEC.md)。
