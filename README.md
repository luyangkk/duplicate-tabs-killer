# Duplicate Tabs Killer

**Duplicate Tabs Killer** 是一款基于 React 和 Vite 构建的 Chrome 浏览器扩展，旨在帮助用户高效管理浏览器标签页。它能自动检测并清理重复标签，按域名分组管理标签页，并支持会话归档与恢复功能，从而提升浏览体验并节省系统资源。

## ✨ 核心功能

*   **🚫 智能去重**：自动检测 URL 完全相同的重复标签页，提供一键清理功能，仅保留一份副本。
*   **📂 标签分组**：自动按域名对当前打开的所有标签页进行分组展示，视图清晰有序，便于管理。
*   **💾 会话归档**：支持将当前所有打开的标签页保存为归档会话（Snapshot），并支持自定义命名，方便随时切换工作上下文。
*   **🔄 一键恢复**：可随时从归档历史中恢复整个会话或单个标签页。
*   **🔍 快速搜索**：支持在当前标签页和归档历史中通过标题或 URL 关键词进行快速搜索和筛选。
*   **📊 数据统计**：直观展示重复标签数量、总标签数及分组信息。
*   **🎨 现代化 UI**：基于 Tailwind CSS 设计的现代化界面，简洁美观，响应迅速。

## 🛠 技术栈

本项目采用现代前端技术栈开发，确保高性能和良好的开发体验：

*   **核心框架**: [React](https://react.dev/) 18
*   **构建工具**: [Vite](https://vitejs.dev/)
*   **开发语言**: [TypeScript](https://www.typescriptlang.org/)
*   **样式方案**: [Tailwind CSS](https://tailwindcss.com/)
*   **状态管理**: [Zustand](https://github.com/pmndrs/zustand)
*   **图标库**: [Lucide React](https://lucide.dev/)
*   **Chrome 扩展插件**: [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin) - 支持 HMR 热更新

## 🚀 快速开始

### 环境要求
*   Node.js (推荐 v18 或更高版本)
*   npm 或 yarn

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

启动开发服务器。得益于 CRXJS 插件，开发过程中支持热更新（HMR），修改代码后扩展会自动刷新。

```bash
npm run dev
```

### 3. 构建项目

构建生产环境代码，进行类型检查和打包优化：

```bash
npm run build
```

构建完成后，产物将生成在 `dist` 目录下。

### 4. 在 Chrome 中加载扩展

1.  打开 Chrome 浏览器，在地址栏输入并访问 `chrome://extensions/`。
2.  开启右上角的 **"开发者模式" (Developer mode)** 开关。
3.  点击左上角的 **"加载已解压的扩展程序" (Load unpacked)** 按钮。
4.  在文件选择弹窗中，选择本项目根目录下的 `dist` 文件夹。
5.  加载成功后，你应该能在浏览器工具栏看到插件图标。

## 📁 项目结构

```text
duplicate_tabs_killer/
├── src/
│   ├── background/      # Service Worker 后台脚本 (处理后台任务)
│   ├── popup/           # 点击扩展图标弹出的简易操作界面
│   ├── dashboard/       # 完整功能的仪表盘页面 (Tab 管理、归档中心)
│   ├── components/      # 公共 React 组件
│   ├── hooks/           # 自定义 React Hooks (useTabs, useArchives 等)
│   ├── utils/           # 工具函数 (Tab 分组逻辑, Chrome Storage 封装等)
│   ├── lib/             # 第三方库配置 (utils.ts 等)
│   └── assets/          # 静态资源文件
├── public/              # 公共静态文件 (favicon 等)
├── dist/                # 构建产出目录 (加载到 Chrome 的目录)
├── .gitignore           # Git 忽略配置
├── package.json         # 项目依赖与脚本配置
├── vite.config.ts       # Vite 构建配置
└── tailwind.config.js   # Tailwind CSS 配置
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进此项目！

1.  Fork 本仓库
2.  创建特性分支 (`git checkout -b feature/AmazingFeature`)
3.  提交改动 (`git commit -m 'Add some AmazingFeature'`)
4.  推送到分支 (`git push origin feature/AmazingFeature`)
5.  提交 Pull Request

## 📄 许可证

此项目仅供学习和交流使用。
