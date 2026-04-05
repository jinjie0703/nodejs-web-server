import { WebSocketClient } from "./ws.js";

const { createApp, ref, onMounted, nextTick, computed } = Vue;

const App = {
  setup() {
    // servers: 保存当前处于运行或激活状态的服务器映射数组, 内容为 { port, isRunning } 结构
    const servers = ref([]);
    // port: 代表当前前端表单输入预设要操作的目标站点端口数值，默认是 18080
    const port = ref(18080);
    // sysLogs: 存放系统级或服务端基础事件记录日志的数组
    const sysLogs = ref([]);
    // accessLogs: 存放访问网站接口（HTTP 请求）详细日志的数组
    const accessLogs = ref([]);
    // responseLogs: 存放纯响应相关精简记录日志的数组
    const responseLogs = ref([]);
    // wsError: 表示与控制台 WS 后端链接的报错或警告状态文本
    const wsError = ref("");
    // sysLogBox: 用于获取 DOM 元素的 Vue Refs 指针，方便操作其滚动条
    const sysLogBox = ref(null);

    let wsClient = null;

    /**
     * 将一条系统事件消息格式化后追加到界面日志展示框内，并利用 DOM 处理保持滚动到底部
     * @param {string} msg 字符串日志文本
     */
    const appendSysLog = (msg) => {
      // 获取带本地时区特征的时间戳字符串
      const time = new Date().toLocaleTimeString();
      sysLogs.value.push({ time, msg });
      // 在 Vue 下一渲染周期完成并更新真实的 HTML 节点后触发
      nextTick(() => {
        if (sysLogBox.value) {
          // 将容器元素内的滚轴定位拉到该最底部高度（scrollHeight）
          sysLogBox.value.scrollTop = sysLogBox.value.scrollHeight;
        }
      });
    };

    /**
     * 处理由服务端发来的站点资源的访问（Access）并转换为显示记录日志
     * @param {Object} log 包含路由、协议、响应码的访问流统计数据
     */
    const appendAccessLog = (log) => {
      // Unshift to put newest at the top -> 用 unshift 插到数组索引的头部(Index=0) 让最近的请求在列表的最上面位置展现
      accessLogs.value.unshift({
        time: new Date(log.time).toLocaleTimeString(),
        ip: log.ip,
        method: log.method,
        url: log.url,
        version: log.version,
        statusCode: log.statusCode,
        response: {
          contentType: log.response?.contentType || "unknown",
          contentLength: Number(log.response?.contentLength || 0),
        },
      });
      // keep max 100 logs -> 为保障内存开销不大，仅在界面内维系保留最多的前 100 笔新记录记录
      if (accessLogs.value.length > 100) {
        accessLogs.value.pop();
      }

      // 同上逻辑为响应历史栏目也单独补充一组
      responseLogs.value.unshift({
        time: new Date(log.time).toLocaleTimeString(),
        method: log.method,
        url: log.url,
        version: log.version,
        statusCode: log.statusCode,
        contentType: log.response?.contentType || "unknown",
        contentLength: Number(log.response?.contentLength || 0),
      });
      if (responseLogs.value.length > 100) {
        responseLogs.value.pop();
      }
    };

    /**
     * 返回供 Tailwind 等框架使用的不同 CSS 颜色类别组合，基于请求代码进行色彩分发提示
     * @param {number} code HTTP 类型的各类响应状态代码 (如 200,404,500)
     */
    const getStatusClass = (code) => {
      if (code >= 200 && code < 300)
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      if (code >= 300 && code < 400)
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      if (code === 404 || code === 403)
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      if (code >= 500) return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    };

    /**
     * 作为中心的分发处理枢纽对 Socket 服务器端报文结构按类别解包与响应分发
     * @param {Object} data 收到的 JSON 反序列化解析完的数据包
     */
    const handleMessage = (data) => {
      if (data.type === "initStatus") {
        // 将初始化或者刚连接时后台的当前站站服务运行的状态全部同步给面板
        servers.value = data.servers.map((s) => ({
          port: s.port,
          isRunning: s.isRunning,
        }));
      } else if (data.type === "status") {
        // 单个网站服务状态发生调整改变时处理
        if (data.action === "started") {
          const existing = servers.value.find((s) => s.port === data.port);
          if (existing) existing.isRunning = true;
          // 若原列表内不存在这项记录就当做新建加入展示列表里
          else servers.value.push({ port: data.port, isRunning: true });
        } else if (data.action === "stopped") {
          // 在服务处于停止完成并被停用后彻底将其踢出展示队列内
          servers.value = servers.value.filter((s) => s.port !== data.port);
        }
      } else if (data.type === "log") {
        // 系统报错以及信息层面的广播
        appendSysLog(data.message);
      } else if (data.type === "access") {
        // 日常网站来访流量审计数据分析抛入处理
        appendAccessLog(data.log);
      }
    };

    // 组件完成挂载渲染生命周期时便着手创建 Websocket 连接链路服务
    onMounted(() => {
      // 校验网页使用的通讯协定从而自适应确定采用 WSS（加密的）或者是清文 WS
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${location.host}`;

      // 使用自定义客户端去进行实例组装
      wsClient = new WebSocketClient(wsUrl, {
        onOpen: () => {
          wsError.value = "";
          appendSysLog("控制面板已连接上 WebSocket。");
        },
        onMessage: handleMessage,
        onClose: () => {
          wsError.value = "已脱离服务器连接。正在努力尝试重连环节...";
          appendSysLog("WebSocket 通讯连接断开。");
          // 前方掉线就安全稳妥起见假设所有的下挂服点已经是不明确运行状了（展示全断）
          servers.value.forEach((s) => (s.isRunning = false));
        },
        onError: (err) => {
          wsError.value = "捕捉到了 WebSocket 通讯出现的底层异常。";
        },
      });

      // 发起初始链接尝试连接后台服务
      wsClient.connect();
    });

    /**
     * 判断并根据现有队列记录反馈目前正指着的面板内输入端口是否刚好处于正在运转状态中
     */
    const isCurrentPortRunning = computed(() => {
      return servers.value.some((s) => s.port === port.value && s.isRunning);
    });

    /**
     * 点击开启触发提交信号命令给后台的请求
     */
    const startServer = () => {
      if (wsClient && !isCurrentPortRunning.value) {
        wsClient.send({ action: "start", port: port.value });
      }
    };

    /**
     * 点击下线按钮停止一个在控下的工作端口 Web 服务
     * @param {number} targetPort 准备关闭其运行环境的服务关联数值端口号
     */
    const stopServer = (targetPort) => {
      if (wsClient) {
        wsClient.send({ action: "stop", port: targetPort });
      }
    };

    // 输出所需要的各项数据与暴露的内部操作操作句柄方便模版引用使用
    return {
      servers,
      port,
      sysLogs,
      accessLogs,
      responseLogs,
      wsError,
      sysLogBox,
      isCurrentPortRunning,
      startServer,
      stopServer,
      getStatusClass,
    };
  },
};

// 完成后以 "#app" 号 DOM 作为起点装载 Vue 组件本体
createApp(App).mount("#app");
