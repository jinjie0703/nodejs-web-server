# 🌐 轻量级 HTTP Web 服务器 (计算机网络课程设计)

本项目为**计算机网络课程设计**作品，基于 TypeScript 和 Node.js 底层网络模块从零构建的一个轻量级、高性能 HTTP Web 服务器。同时在内部集成了一个基于 WebSocket 协议的控制端服务器，用于进行服务器状态的监控与管理。

## ✨ 特性 (Features)

- **纯手工 HTTP 协议解析**：通过自定义 `HttpParser` 与 `HttpResponse` 模块，从底层的 TCP 流/数据包中完整解析与封装 HTTP 报文。
- **静态资源托管**：支持解析并路由文件目录（如 `www/` 和 `public/`），自动通过 `MimeTypes` 模块匹配 Content-Type 进行响应。
- **自定义错误与状态页面**：内部实现 404 等常见 HTTP 状态的正确处理与页面返回。
- **WebSocket 实时管理 (Control Server)**：基于 `ws` 模块提供双工通信控制，通过前端直观查看/更改服务器运行状态。
- **配置文件热集成**：通过 `server.config.json` 快速调整服务器配置，如监听端口、根目录等。
- **一键打包部署**：使用 `pkg` 将应用程序连同静态资产打包为了独立可执行文件应用 (.exe)，摆脱 Node 环境依赖。

## 🛠️ 技术栈 (Tech Stack)

- **核心语言**：TypeScript, Node.js (`net` 模块)
- **协议支持**：HTTP/1.1, WebSocket (`ws`)
- **开发与构建工具**：`ts-node`, `nodemon`, `typescript`, `pkg`
- **前端页面**：HTML5, CSS3, 原生 JavaScript / Vue.js (用于控制面板端)

## 📂 项目结构 (Structure)

```text
├── package.json
├── server.config.json      # Web服务器及控制端配置文件
├── tsconfig.json           # TS 编译配置
├── src/                    # 服务端 TypeScript 源码目录
│   ├── index.ts            # 服务主入口
│   ├── config/             # 配置读取与初始化
│   ├── http/               # HTTP请求解析 (HttpParser)、响应封装 (HttpResponse)
│   ├── server/             # 核心服务 (WebServer 及 ControlServer)
│   └── utils/              # 工具类 (MimeTypes 字典解析等)
├── public/                 # Web 控制台/首页静态资源目录 (CSS/JS)
├── www/                    # 被托管暴露给客户端的 web 文档根目录
│   ├── 404.html            # 自定义404页
│   └── ...                 # 测试资源(images, test1, test2)
└── ...
```

## 🚀 快速开始 (Getting Started)

### 1. 安装依赖

请确保你的电脑上已经安装了 Node.js （推荐 Node.js 18+）。

```bash
npm install
```

### 2. 本地开发运行

使用 `nodemon` 监听文件修改并热重启：

```bash
npm run dev
```

直接使用 `ts-node` 运行：

```bash
npm start
```

### 3. 构建独立可执行文件 (Build)

为了脱离 Node.js 环境独立运行，项目支持一键打包为可执行文件（如 Windows 的 `.exe`）。运行以下命令：

```bash
npm run build
```

**构建与打包过程说明**：

1. **编译阶段 (`tsc`)**：首先，TypeScript 编译器会将 `src/` 目录下的 `.ts` 源代码编译为直接可执行的 JavaScript 代码，这些中间构建产物会存放在自动生成的 **`dist/`** 目录中。
2. **打包阶段 (`pkg`)**：紧接着，`pkg` 打包工具会读取 `dist/` 目录中的 JS 产物，连同 Node.js 运行时环境以及项目中配置的静态资源目录（如 `public/` 和 `www/` 等），一起压缩合并。

**最终运行产出**：
整个流程执行完毕后，最终打包好的独立可执行程序（例如 `my-http-server.exe`）将会输出并存放在自动生成的 **`build/`** 目录下。
您只需进入 `build/` 目录，双击该程序即可在任何机器上启动服务器。

## 📜 执照 (License)

[ISC License](LICENSE)
