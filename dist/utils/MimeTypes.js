"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContentType = getContentType;
/**
 * 根据文件路径或文件名获取对应的 MIME 类型，用于 http 响应的 Content-Type 头部
 *
 * @param filePath 文件路径或文件名
 * @returns 该文件对应的 Content-Type 类型字符串
 */
function getContentType(filePath) {
    // 提取文件扩展名并转为小写
    const ext = filePath.split(".").pop()?.toLowerCase();
    // 常见扩展名与 MIME 类型的映射字典
    const mimeTypes = {
        html: "text/html",
        css: "text/css",
        js: "application/javascript",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        json: "application/json",
        txt: "text/plain",
    };
    // 返回对应的类型，如果未匹配到则返回二进制流类型 'application/octet-stream'
    return mimeTypes[ext || ""] || "application/octet-stream";
}
