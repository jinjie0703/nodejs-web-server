import * as fs from "fs";
import * as path from "path";

/**
 * 站点服务器配置接口
 * 用于定义单个站点的配置要求
 */
export interface SiteServerConfig {
  // 监听的端口号
  listen: number;
  // 站点的根目录
  root: string;
  // 默认的首页文件名，可选
  index?: string;
  // 错误页面（404等）的文件名，可选
  errorPage?: string;
  // 是否开启 SPA 单页应用路由回退（将所有未知路由重定向到 index），可选
  spaFallback?: boolean;
}

/**
 * 已加载的站点服务器配置接口
 * 这是经过解析和默认值处理后的最终配置结构
 */
export interface LoadedSiteServerConfig {
  // 监听的端口号
  listen: number;
  // 解析后的站点根目录绝对路径
  rootDir: string;
  // 默认首页文件名（已设默认值）
  indexFile: string;
  // 错误页面文件名（已设默认值）
  errorPage: string;
  // 是否开启 SPA 单页应用路由回退模式
  spaFallback: boolean;
}

/**
 * 整体已加载的服务器配置接口
 * 包含控制层配置和所有的站点服务器配置
 */
export interface LoadedServerConfig {
  // 控制服务器监听的端口号
  controlPort: number;
  // 所有的站点服务器配置列表
  servers: LoadedSiteServerConfig[];
}

/**
 * 原始服务器配置接口
 * 用于映射从 JSON 文件中直接读取出的数据结构
 */
interface RawServerConfig {
  // 控制层配置，可选
  control?: {
    // 控制服务器端口，可选
    port?: number;
  };
  // 站点服务器配置列表，可选
  servers?: SiteServerConfig[];
}

/**
 * 标准化相对文件路径
 * 去除路径开头多余的斜杠或反斜杠，并处理缺省情况
 *
 * @param filePath 传入的文件路径
 * @param fallback 当传入路径不存在时的默认后备路径
 * @returns 标准化后的文件路径
 */
function normalizeRelativeFilePath(
  filePath: string | undefined,
  fallback: string,
) {
  // 如果没有提供 filePath，则使用后备路径
  const value = filePath || fallback;
  // 移除字符串开头的一至多个正斜杠或者反斜杠
  return value.replace(/^[\\/]+/, "");
}

/**
 * 从指定路径读取并解析服务器配置
 * 尝试将原始的 JSON 映射为规范化的 LoadedServerConfig 对象
 *
 * @param configPath 配置文件的绝对或相对路径
 * @returns 经过处理和默认值补全的完整服务器配置对象
 */
export function loadServerConfig(configPath: string): LoadedServerConfig {
  // 以 UTF-8 编码同步读取配置文件内容
  const rawText = fs.readFileSync(configPath, "utf8");
  // 将读取到的 JSON 字符串解析为原始配置对象
  const raw = JSON.parse(rawText) as RawServerConfig;
  // 获取配置文件所在的目录路径，用作计算其他路径的基础参考目录
  const baseDir = path.dirname(configPath);

  // 获取控制端端口，如果未指定或类型不正确，则默认使用 3000 端口
  const controlPort =
    typeof raw.control?.port === "number" ? raw.control.port : 3000;

  // 解析并映射站点服务器配置列表
  const servers = Array.isArray(raw.servers)
    ? raw.servers
        // 过滤掉无效项或未设定监听端口的项
        .filter((item) => item && typeof item.listen === "number")
        .map((item) => ({
          // 监听端口
          listen: item.listen,
          // 根据配置文件所在目录解析出站点根目录的绝对路径
          rootDir: path.resolve(baseDir, item.root),
          // 标准化首页文件名，如果没有指定则默认为 "index.html"
          indexFile: normalizeRelativeFilePath(item.index, "index.html"),
          // 标准化错误页文件名，如果没有指定则默认为 "404.html"
          errorPage: normalizeRelativeFilePath(item.errorPage, "404.html"),
          // 判断并设定 SPA 回退开关，仅当明确设为 true 时才开启
          spaFallback: item.spaFallback === true,
        }))
    : [];

  return { controlPort, servers };
}
