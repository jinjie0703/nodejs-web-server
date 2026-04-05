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
const path = __importStar(require("path"));
const ControlServer_1 = require("./server/ControlServer");
const ServerConfig_1 = require("./config/ServerConfig");
// 默认的目标静态文件根目录路径
const defaultRootDir = path.resolve(__dirname, "../www");
// 服务器配置文件的绝对路径
const configPath = path.resolve(process.cwd(), "server.config.json");
// 加载并解析服务器配置
const loadedConfig = (0, ServerConfig_1.loadServerConfig)(configPath);
// 将配置项按照端口号映射为 Map，方便后续根据端口快速查找对应站点的配置参数
const siteConfigByPort = new Map(loadedConfig.servers.map((server) => [
    server.listen,
    {
        rootDir: server.rootDir,
        indexFile: server.indexFile,
        errorPage: server.errorPage,
        spaFallback: server.spaFallback,
    },
]));
// 实例化控制台服务器并启动监听
const controlServer = new ControlServer_1.ControlServer(defaultRootDir, siteConfigByPort);
controlServer.listen(loadedConfig.controlPort);
