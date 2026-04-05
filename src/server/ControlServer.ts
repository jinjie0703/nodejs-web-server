import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { WebSocketServer } from "ws";
import { WebServer } from "./WebServer";
import { getContentType } from "../utils/MimeTypes";

/**
 * 端口对应的站点配置接口
 */
interface PortSiteConfig {
  rootDir: string;
  indexFile?: string;
  errorPage?: string;
  spaFallback?: boolean;
}

/**
 * 控制台主服务器类
 * 负责提供控制面板 UI (HTTP 接口) 以及与前端 UI 通信的 WebSocket 服务
 */
export class ControlServer {
  // 基于 Node.js 内置 http 模块创建的控制台基础服务
  private controlServer: http.Server;
  // 用于前端 Dashboard 进行实时通信通信的 WS 服务器
  private wss: WebSocketServer;
  // Manage multiple servers mapping by port -> 按端口号映射管理的多个目标站点服务实例
  private targetServers: Map<number, WebServer> = new Map();
  // 默认目标的静态资源根目录
  private targetRootDir: string;
  // 各个端口独立的配置信息
  private siteConfigByPort: Map<number, PortSiteConfig>;

  constructor(
    targetRootDir: string,
    siteConfigByPort: Map<number, PortSiteConfig> = new Map(),
  ) {
    this.targetRootDir = targetRootDir;
    this.siteConfigByPort = siteConfigByPort;
    this.wss = new WebSocketServer({ noServer: true });

    // A simple static file server for the public/ directory -> 为 public/ 目录（控制台静态资源）提供访问的小型 HTTP 服务
    this.controlServer = http.createServer((req, res) => {
      // 如果不是 GET 请求，则直接拒绝并返回 405
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end("方法不允许");
        return;
      }

      // 获取需要读取的文件相对路径，默认首页为 index.html
      let relativePath = req.url === "/" ? "index.html" : req.url || "";
      relativePath = relativePath.split("?")[0].replace(/^\/+/, "");
      // 绝对路径计算
      const absolutePath = path.join(__dirname, "../../public", relativePath);

      // 读取文件并返回给客户端
      fs.readFile(absolutePath, (err, data) => {
        if (err) {
          if (err.code === "ENOENT") {
            res.writeHead(404);
            res.end("未找到文件");
          } else {
            res.writeHead(500);
            res.end("服务器内部错误");
          }
          return;
        }
        res.writeHead(200, { "Content-Type": getContentType(absolutePath) });
        res.end(data);
      });
    });

    // 拦截 HTTP Upgrade 事件来处理 WebSocket 的握手升级
    this.controlServer.on("upgrade", (request, socket, head) => {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit("connection", ws, request);
      });
    });

    // 初始化 WebSocket 消息和连接监听
    this.setupWebSocket();
  }

  /**
   * 装载和绑定 WebSocket 连接的核心处理逻辑
   */
  private setupWebSocket() {
    this.wss.on("connection", (ws) => {
      // Send current server list status to a newly connected client -> 将当前各目标站点的运行状态发送给新连接的客户端
      const serversStatus = Array.from(this.targetServers.values()).map(
        (s) => ({ port: s.port, isRunning: s.isRunning() }),
      );
      ws.send(
        JSON.stringify({
          type: "initStatus",
          servers: serversStatus,
        }),
      );

      // 处理客户端传来的控制指令
      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());
          const port = data.port || 8080;

          if (data.action === "start") {
            // 如目标站点未被实例化，则取出对应的配置或使用默认值进行初始化
            if (!this.targetServers.has(port)) {
              const siteConfig = this.siteConfigByPort.get(port);
              const newServer = new WebServer(
                siteConfig?.rootDir || this.targetRootDir,
                {
                  indexFile: siteConfig?.indexFile,
                  errorPage: siteConfig?.errorPage,
                  spaFallback: siteConfig?.spaFallback,
                },
              );
              // 绑定站点自身引发的各类事件，转发给 Dashboard
              this.setupTargetServerListeners(newServer);
              this.targetServers.set(port, newServer);
            }

            const server = this.targetServers.get(port)!;

            try {
              // 最终执行启动方法
              if (!server.isRunning()) {
                await server.start(port);
              }
              // 向全体控制端广播启动成功的状态更新
              this.broadcast({
                type: "status",
                action: "started",
                port: port,
              });
            } catch (err: any) {
              // 启动失败抛出日志告知前端
              ws.send(
                JSON.stringify({
                  type: "log",
                  message: `[端口 ${port}] 启动出错: ${err.message}`,
                }),
              );
            }
          } else if (data.action === "stop") {
            // 处理停止动作
            const server = this.targetServers.get(port);
            if (server) {
              try {
                await server.stop();
                this.targetServers.delete(port); // cleanly remove -> 干净地移除对象映射
                // 广播彻底停止的状态
                this.broadcast({
                  type: "status",
                  action: "stopped",
                  port: port,
                });
              } catch (err: any) {
                ws.send(
                  JSON.stringify({
                    type: "log",
                    message: `[端口 ${port}] 停止出错: ${err.message}`,
                  }),
                );
              }
            }
          }
        } catch (e) {
          console.error("WebSocket 解析错误:", e);
        }
      });
    });
  }

  /**
   * 为单独开启的一个站点服务设置相应的监听以便推送事件和统计访问日志
   * @param server 目标网站 HTTP 解析器实例
   */
  private setupTargetServerListeners(server: WebServer) {
    // 监听日志并广播给前端面板
    server.on("log", (message) => {
      console.log(`[目标网站] ${message}`);
      this.broadcast({ type: "log", message });
    });

    // 监听访问动作事件，统计相关情况发往前端面板
    server.on("access", (accessLog) => {
      this.broadcast({ type: "access", log: accessLog });
    });
  }

  /**
   * 广播信息给当前所有的 WebSocket 客户端
   * @param data 要广播的 JSON 数据对象
   */
  private broadcast(data: any) {
    this.wss.clients.forEach((client) => {
      // WebSocket.OPEN -> 判断状态必须为开启(已连接)
      if (client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
  }

  /**
   * 启动控制台主服务器监听功能
   * @param port 设置服务器占用的端口号
   */
  public listen(port: number) {
    // Bind to '0.0.0.0' for external access when deployed to server -> 绑定到 0.0.0.0 允许外部网卡以及服务器宿主进行访问
    this.controlServer.listen(port, "0.0.0.0", () => {
      console.log(`[系统] 控制面板已启动，可外部访问 http://0.0.0.0:${port}`);
    });
  }
}
