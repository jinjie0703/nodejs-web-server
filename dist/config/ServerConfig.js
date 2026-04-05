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
exports.loadServerConfig = loadServerConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * 标准化相对文件路径
 * 去除路径开头多余的斜杠或反斜杠，并处理缺省情况
 *
 * @param filePath 传入的文件路径
 * @param fallback 当传入路径不存在时的默认后备路径
 * @returns 标准化后的文件路径
 */
function normalizeRelativeFilePath(filePath, fallback) {
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
function loadServerConfig(configPath) {
    // 以 UTF-8 编码同步读取配置文件内容
    const rawText = fs.readFileSync(configPath, "utf8");
    // 将读取到的 JSON 字符串解析为原始配置对象
    const raw = JSON.parse(rawText);
    // 获取配置文件所在的目录路径，用作计算其他路径的基础参考目录
    const baseDir = path.dirname(configPath);
    // 获取控制端端口，如果未指定或类型不正确，则默认使用 3000 端口
    const controlPort = typeof raw.control?.port === "number" ? raw.control.port : 3000;
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
