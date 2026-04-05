"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpResponse = void 0;
/**
 * HTTP 响应工具类
 * 用于构建和发送符合 HTTP 协议报文规范的响应内容
 */
class HttpResponse {
    /**
     * 发送完整的 HTTP 响应报文至 TCP 客户端
     *
     * @param socket TCP Socket 对象
     * @param statusCode HTTP 响应状态码，例如 200, 404
     * @param statusMessage 响应状态信息摘要，如 "OK", "Not Found"
     * @param contentType 响应体的 MIME 类型
     * @param body 响应的实体内容，支持 Buffer 二进制流或字符串
     */
    static send(socket, statusCode, statusMessage, contentType, body) {
        // 统一将响应体转换为 Buffer，即使传入的是字符串
        const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
        // 构造标准的 HTTP 响应协议头列表并拼接为字符串
        const headers = [
            `HTTP/1.1 ${statusCode} ${statusMessage}`,
            `Content-Type: ${contentType}`,
            `Content-Length: ${bodyBuffer.length}`,
            `Connection: close`, // 指定连接为短连接，一次响应后即关闭
            `Server: Node-Custom-Modular-Web-Server`, // 定义自定义服务器名称标识
            "",
            "", // 双换行标记头部数据的结束
        ].join("\r\n");
        try {
            // 在 Socket 尚未销毁或断开的前提下，将响应报头与响应体写入传输流
            if (!socket.destroyed) {
                socket.write(headers);
                socket.write(bodyBuffer);
            }
        }
        catch (e) {
            console.error("发送响应时发生错误: ", e);
        }
    }
    /**
     * 快速发送 HTML 文本类型响应的工具方法
     *
     * @param socket TCP Socket 对象
     * @param statusCode HTTP 响应状态码
     * @param statusMessage 响应状态信息摘要
     * @param html 待发送的 HTML 文本内容
     */
    static sendHtml(socket, statusCode, statusMessage, html) {
        this.send(socket, statusCode, statusMessage, "text/html", html);
    }
}
exports.HttpResponse = HttpResponse;
