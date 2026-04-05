"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpParser = void 0;
/**
 * HTTP 请求解析器
 * 提供对原始流式数据的基本解析功能
 */
class HttpParser {
    /**
     * 将原始 TCP 数据流字符串解析为 HttpRequest 对象
     *
     * @param buffer 接收到的请求字符串数据
     * @param socket 当前的 TCP Socket 连接对象
     * @returns 解析后的 HTTP 请求对象，若请求头部未接收完整则返回 null
     */
    static parseRequest(buffer, socket) {
        // 查找 HTTP 头部结束标志位（连续的回车换行）
        const headersEnd = buffer.indexOf("\r\n\r\n");
        if (headersEnd === -1)
            return null; // headers incomplete - 请求头还未接收完整
        // 截取请求头数据
        const requestData = buffer.substring(0, headersEnd);
        // 截取请求体数据
        const bodyData = buffer.substring(headersEnd + 4);
        // 按行分割请求头数据
        const lines = requestData.split("\r\n");
        if (lines.length === 0)
            return null;
        // 解析请求行（第一行，包含：请求方法 URL 版本）
        const requestLineParts = lines[0].split(" ");
        if (requestLineParts.length < 3)
            return null;
        const method = requestLineParts[0];
        const url = requestLineParts[1];
        const version = requestLineParts[2];
        // 循环解析各个请求头部字段
        const headers = {};
        for (let i = 1; i < lines.length; i++) {
            const idx = lines[i].indexOf(":");
            if (idx !== -1) {
                // 提取键，并统一转换为小写形式
                const key = lines[i].substring(0, idx).trim().toLowerCase();
                // 提取对应的数值部分
                const val = lines[i].substring(idx + 1).trim();
                headers[key] = val;
            }
        }
        // 返回组装好的 HttpRequest 对象
        return {
            method,
            url,
            version,
            headers,
            body: bodyData,
            // 获取客户端的 IP 地址，如果获取不到则使用默认占位值
            clientIp: socket.remoteAddress || "Unknown IP",
        };
    }
}
exports.HttpParser = HttpParser;
