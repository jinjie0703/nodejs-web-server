import * as path from "path";
import { ControlServer } from "./server/ControlServer";
import { loadServerConfig } from "./config/ServerConfig";

// 默认的目标静态文件根目录路径
const defaultRootDir = path.resolve(__dirname, "../www");

// 服务器配置文件的绝对路径
const configPath = path.resolve(process.cwd(), "server.config.json");

// 加载并解析服务器配置
const loadedConfig = loadServerConfig(configPath);

// 将配置项按照端口号映射为 Map，方便后续根据端口快速查找对应站点的配置参数
const siteConfigByPort = new Map(
  loadedConfig.servers.map((server) => [
    server.listen,
    {
      rootDir: server.rootDir,
      indexFile: server.indexFile,
      errorPage: server.errorPage,
      spaFallback: server.spaFallback,
    },
  ]),
);

// 实例化控制台服务器并启动监听
const controlServer = new ControlServer(defaultRootDir, siteConfigByPort);
controlServer.listen(loadedConfig.controlPort);
