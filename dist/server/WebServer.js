"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebServer = void 0;
const net = __importStar(require("net"));
const fsPromises = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const events_1 = require("events");
const HttpParser_1 = require("../http/HttpParser");
const HttpResponse_1 = require("../http/HttpResponse");
const MimeTypes_1 = require("../utils/MimeTypes");
/**
 * 自定义的内嵌 Socket HTTP Web 服务类
 * 用于搭建站点本体的 HTTP 解析及文件托管机制
 */
class WebServer extends events_1.EventEmitter {
    // NodeJS 底层 net 引用句柄
    server = null;
    // 暴露的本站点绑定的端口号
    port = 8080;
    // 核心资源目录根路径（不可越界访问其上级路径）
    rootDir;
    // 默认文档名
    indexFile;
    // 当发生 404 等未命中时展示的文件
    errorPage;
    // 开关 SPA 的特性
    spaFallback;
    constructor(rootDir, options = {}) {
        super();
        this.rootDir = rootDir;
        this.indexFile = options.indexFile || "index.html";
        this.errorPage = options.errorPage || "404.html";
        this.spaFallback = options.spaFallback === true;
    }
    /**
     * 启动该独立的 WebServer 服务监听功能
     *
     * @param port 给定监听的端口数值
     */
    start(port) {
        return new Promise((resolve, reject) => {
            // 避免重复启动检查
            if (this.server) {
                return reject(new Error("服务器已在运行中"));
            }
            this.port = port;
            // 利用传输层组件构建 TCP 侦听服务，并处理每个独立的连接
            this.server = net.createServer((socket) => this.handleConnection(socket));
            this.server.on("error", (err) => reject(err));
            // Bind to 0.0.0.0 so clients from external networks can access it -> 绑定全体网络接口以便被公网或内网其他机器探测
            this.server.listen(port, "0.0.0.0", () => {
                // 向外事件广播目前状态
                this.emit("log", `[端口 ${port}] 目标网站服务已成功启动.`);
                resolve();
            });
        });
    }
    /**
     * 关闭目前服务的套接字侦听行为，将其停用
     */
    stop() {
        return new Promise((resolve, reject) => {
            if (!this.server)
                return resolve();
            this.server.close((err) => {
                if (err)
                    return reject(err);
                this.server = null;
                this.emit("log", `端口为 ${this.port} 的网站服务已停止`);
                resolve();
            });
        });
    }
    /**
     * 查验该服务端套接字状态
     */
    isRunning() {
        return this.server !== null;
    }
    /**
     * HTTP 传输层核心处理机制
     * 读取 Socket 的流块，提取并解析成 HTTP 对像并分派路由
     * @param socket TCP 原始套接字
     */
    handleConnection(socket) {
        let buffer = "";
        socket.on("data", async (data) => {
            buffer += data.toString("utf8");
            // 将当前的积累缓存交给解析器转换
            const req = HttpParser_1.HttpParser.parseRequest(buffer, socket);
            if (!req)
                return; // Incomplete headers -> 不完整的请求头则暂时返回继续等待处理
            // 交予路由机制计算相应返回结果
            const response = await this.routeRequest(req.method, req.url, socket);
            // 上报触发网站资源访问事件，以便推送到大屏的日志栏目展示
            this.emit("access", {
                time: new Date().toISOString(),
                ip: req.clientIp,
                method: req.method,
                url: req.url,
                version: req.version,
                statusCode: response.statusCode,
                response: {
                    contentType: response.contentType,
                    contentLength: response.contentLength,
                },
            });
            // 处理结束后应断开当前 Socket 的响应通道以免空占池句柄（符合非 Keep-Alive 的简化 HTTP/1 规范）
            socket.end();
            socket.destroy();
        });
        // 基础 Socket 级别的意外处理，上报错误避免崩溃
        socket.on("error", (err) => {
            this.emit("log", `Socket 套接字出现错误: ${err.message}`);
        });
    }
    /**
     * 执行对静态资源的读取和路由转发处理操作。目前限制只执行 GET 命令
     * @param method HTTP 操作方法
     * @param url 请求的具体完整 URL 路径
     * @param socket 本次 TCP 套接字
     */
    async routeRequest(method, url, socket) {
        // 强制方法保护，拒绝除 GET 外的任何提交动作
        if (method !== "GET") {
            const html = `<html><body><h1>501 未实现</h1><p>并不支持该操作方法（Method）：${method} 。这里只能作为一个静态读文件服务存在。</p></body></html>`;
            HttpResponse_1.HttpResponse.sendHtml(socket, 501, "Not Implemented", html);
            return {
                statusCode: 501,
                contentType: "text/html",
                contentLength: Buffer.byteLength(html),
            };
        }
        // 摘取路径，剔除 Query 上面跟随的问号信息参数
        let relativePath = url.split("?")[0];
        if (relativePath === "/")
            relativePath = `/${this.indexFile}`;
        // 利用配置好的环境设定寻找磁盘内真正的存储目录
        const absolutePath = path.join(this.rootDir, relativePath);
        // 基于安全设计防卫跨目录漏洞访问，即防御路径穿越（Directory Traversal）攻击
        if (!absolutePath.startsWith(path.resolve(this.rootDir))) {
            const body = "403 禁止访问无权操作目录";
            HttpResponse_1.HttpResponse.send(socket, 403, "Forbidden", "text/plain", body);
            return {
                statusCode: 403,
                contentType: "text/plain",
                contentLength: Buffer.byteLength(body),
            };
        }
        try {
            // 执行文件检测操作探测状态
            const stats = await fsPromises.stat(absolutePath);
            if (stats.isFile()) {
                const content = await fsPromises.readFile(absolutePath);
                const contentType = (0, MimeTypes_1.getContentType)(absolutePath);
                HttpResponse_1.HttpResponse.send(socket, 200, "OK", contentType, content);
                return {
                    statusCode: 200,
                    contentType,
                    contentLength: content.length,
                };
            }
            throw new Error("不是一个文件目录结构");
        }
        catch {
            // 捕获可能出现文件不存在的问题。如有开启对应的单页面回调机制（SPA fallback）可以触发返回
            if (this.shouldUseSpaFallback(relativePath)) {
                return await this.sendSpaIndex(socket, url);
            }
            return await this.send404(socket, url);
        }
    }
    /**
     * 分析路径状况来判定这是是否可以用回退模式响应
     * @param requestPath 当前收到的请求相对 URL
     */
    shouldUseSpaFallback(requestPath) {
        if (!this.spaFallback)
            return false;
        const normalizedPath = requestPath.split("?")[0];
        if (normalizedPath === "/")
            return true;
        const hasFileExtension = path.basename(normalizedPath).includes(".");
        // 当该URL没有包含扩展名（如 /about），一般被认为前端历史路由
        return !hasFileExtension;
    }
    /**
     * 将所有的流量直接全部转发为默认的入口模板框架响应给前端浏览器（常用于 Vue 或 React）
     */
    async sendSpaIndex(socket, url) {
        try {
            const spaEntryPath = path.join(this.rootDir, this.indexFile);
            const content = await fsPromises.readFile(spaEntryPath);
            HttpResponse_1.HttpResponse.send(socket, 200, "OK", "text/html", content);
            return {
                statusCode: 200,
                contentType: "text/html",
                contentLength: content.length,
            };
        }
        catch {
            return await this.send404(socket, url);
        }
    }
    /**
     * 使用设定配置里面指定的页面提示未发现结果的问题，失败时采取保底预设页面输出机制
     */
    async send404(socket, url) {
        try {
            const notFoundPath = path.join(this.rootDir, this.errorPage);
            const content = await fsPromises.readFile(notFoundPath);
            HttpResponse_1.HttpResponse.send(socket, 404, "Not Found", "text/html", content);
            return {
                statusCode: 404,
                contentType: "text/html",
                contentLength: content.length,
            };
        }
        catch {
            // 找不到定制页面的时候就发送简单的字符备用提示内容
            const fallback = `<html><body><h1>404 Not Found</h1><p>无法访问或未发现有关 ${url} 的资源信息。</p></body></html>`;
            HttpResponse_1.HttpResponse.send(socket, 404, "Not Found", "text/html", fallback);
            return {
                statusCode: 404,
                contentType: "text/html",
                contentLength: Buffer.byteLength(fallback),
            };
        }
    }
}
exports.WebServer = WebServer;
