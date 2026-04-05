/**
 * 用于前端 WebSocket 连接与通讯的简单封装客户端
 * 提供了自动重连和数据解析能力
 */
export class WebSocketClient {
  /**
   * 构造函数
   * @param {string} url WebSocket 服务器地址
   * @param {Object} handlers 事件回调函数对象（如 onOpen, onMessage, onClose, onError）
   */
  constructor(url, handlers = {}) {
    // 记录连接的地址
    this.url = url;
    // 原生 WebSocket 实例句柄
    this.ws = null;
    // 外部传入的一系列回调处理函数集合
    this.handlers = handlers;
    // 当前尝试重新连接的次数计数器
    this.reconnectAttempts = 0;
  }

  /**
   * 发起连接及注册底层通信事件
   */
  connect() {
    this.ws = new WebSocket(this.url);

    // 建立连接成功时的事件
    this.ws.onopen = () => {
      // 成功连接后清零重连尝试次数
      this.reconnectAttempts = 0;
      if (this.handlers.onOpen) this.handlers.onOpen();
    };

    // 接收到服务端消息时的事件
    this.ws.onmessage = (event) => {
      try {
        // 尝试把传送进来的文本结构解析为 JSON
        const data = JSON.parse(event.data);
        if (this.handlers.onMessage) this.handlers.onMessage(data);
      } catch (e) {
        console.error("无法解析 WebSocket 的消息内容", e);
      }
    };

    // 连接遭到关闭或主动断开时的事件
    this.ws.onclose = () => {
      if (this.handlers.onClose) this.handlers.onClose();
      // 一旦断开，则执行计划定时任务尝试重连
      this.scheduleReconnect();
    };

    // 发生通信异常（含网络错）的事件
    this.ws.onerror = (error) => {
      if (this.handlers.onError) this.handlers.onError(error);
    };
  }

  /**
   * 调度并在指数级退避延迟后进行重新连接操作
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    // 使用简单的指数退避算法（Exponential Backoff）控制时间，避免服务端过载。最高延迟上限设为 10 秒
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    setTimeout(() => {
      console.log(`正在尝试重新连接... (第 ${this.reconnectAttempts} 次)`);
      this.connect();
    }, delay);
  }

  /**
   * 向服务端发送序列化的数据
   * @param {Object} data 可 JSON 序列化的数据对象
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("WebSocket 尚未开启连接，无法发送数据。");
    }
  }
}
