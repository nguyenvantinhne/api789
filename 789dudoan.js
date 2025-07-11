const Fastify = require("fastify");
const WebSocket = require("ws");

const fastify = Fastify({ 
  logger: false,
  bodyLimit: 1048576 * 10
});

const PORT = process.env.PORT || 3002;
const WS_URL = "wss://websocket.atpman.net/websocket";
const HEARTBEAT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

const WS_HEADERS = {
  "Host": "websocket.atpman.net",
  "Origin": "https://play.789club.sx",
  "User-Agent": "Mozilla/5.0",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "vi-VN,vi;q=0.9",
  "Pragma": "no-cache",
  "Cache-Control": "no-cache"
};

// Biến lưu trữ dữ liệu
let gameData = {
  sessions: [],
  currentSession: null,
  pendingSession: null,
  lastUpdate: Date.now(),
  currentConfidence: Math.floor(Math.random() * (97 - 51 + 1)) + 51,
  isConnected: false,
  lastMessageTime: Date.now(),
  latency: 0
};

// Bản đồ dự đoán
const duDoanMap = {
  // ... (giữ nguyên bản đồ dự đoán như trước)
};

function duDoanTuTT(pattern) {
  for (let len = Math.min(pattern.length, 7); len >= 1; len--) {
    const key = pattern.substring(0, len);
    if (duDoanMap[key]) return duDoanMap[key];
  }
  return pattern[0] === "T" ? "Tài" : "Xỉu";
}

function ketQuaTX(d1, d2, d3) {
  return (d1 + d2 + d3) >= 11 ? "T" : "X";
}

let wsConnection = null;
let heartbeatTimer = null;
let reconnectAttempts = 0;
let latencyCheckTimer = null;

function connectWebSocket() {
  if (wsConnection) {
    wsConnection.removeAllListeners();
    if (wsConnection.readyState !== WebSocket.CLOSED) {
      wsConnection.close();
    }
  }

  clearInterval(heartbeatTimer);
  clearInterval(latencyCheckTimer);

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    setTimeout(() => {
      reconnectAttempts = 0;
      connectWebSocket();
    }, 60000);
    return;
  }

  reconnectAttempts++;
  console.log(`Đang kết nối... (lần thử ${reconnectAttempts})`);

  wsConnection = new WebSocket(WS_URL, {
    headers: WS_HEADERS,
    perMessageDeflate: false
  });

  latencyCheckTimer = setInterval(() => {
    if (wsConnection.readyState === WebSocket.OPEN) {
      const pingTime = Date.now();
      wsConnection.send(JSON.stringify([6, "MiniGame", "taixiuUnbalancedPlugin", { 
        cmd: 2001, 
        ping: pingTime 
      }]));
    }
  }, 5000);

  wsConnection.on('open', () => {
    reconnectAttempts = 0;
    gameData.isConnected = true;
    gameData.lastMessageTime = Date.now();
    console.log("✅ Kết nối thành công");
    
    const authData = [
      1,
      "MiniGame",
      "dfghhhgffgggg",
      "tinhbip",
      {
        info: "{\"ipAddress\":\"2402:9d80:36a:1716:13d7:a37a:60e2:2c64\",\"userId\":\"f68cd413-44d4-4bf5-96eb-23da9a317f17\",\"username\":\"S8_dfghhhgffgggg\",\"timestamp\":1752167805248,\"refreshToken\":\"498e236e749f4afdb8517d1cd23a419b.0ab31b9e397f4cf0b9c23b3d6a7596b6\"}",
        signature: "52830A25058B665F9A929FD75A80E6893BCD7DDB2BA3276B132BC863453AA09AE60B66FBE4B25F3892B27492391BF08F30D2DDD84B140F0007F1630BC6727A45543749ED892B94D78FEC9683FCF9A15F4EF582D8E4D9F7DD85AFD3BAE566A7B886F7DC380DA10EF5527C38BEE9E4F06C95B9612105CC1B2545C2A13644A29F1F"
      }
    ];
    
    wsConnection.send(JSON.stringify(authData));
    
    setTimeout(() => {
      if (wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify([6, "MiniGame", "taixiuUnbalancedPlugin", { cmd: 1001 }]));
      }
    }, 1000);
    
    heartbeatTimer = setInterval(() => {
      if (wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify([6, "MiniGame", "taixiuUnbalancedPlugin", { cmd: 2000 }]));
      }
    }, HEARTBEAT_INTERVAL);
  });

  wsConnection.on('message', (data) => {
    try {
      gameData.lastMessageTime = Date.now();
      const json = JSON.parse(data);
      
      if (Array.isArray(json) && json[3]?.res?.cmd === 2001 && json[3]?.res?.ping) {
        gameData.latency = Date.now() - json[3].res.ping;
        return;
      }
      
      // Xử lý kết quả realtime - FIXED: Đồng bộ phiên chuẩn
      if (Array.isArray(json) && json[3]?.res?.d1 !== undefined) {
        const res = json[3].res;
        
        // Nếu là phiên mới hoặc chưa có phiên nào
        if (!gameData.currentSession || res.sid > gameData.currentSession) {
          // Đẩy phiên hiện tại vào lịch sử nếu tồn tại
          if (gameData.pendingSession) {
            gameData.sessions.unshift({
              sid: gameData.pendingSession.sid,
              d1: gameData.pendingSession.d1,
              d2: gameData.pendingSession.d2,
              d3: gameData.pendingSession.d3,
              result: ketQuaTX(gameData.pendingSession.d1, gameData.pendingSession.d2, gameData.pendingSession.d3),
              timestamp: gameData.pendingSession.timestamp
            });
            
            if (gameData.sessions.length > 50) {
              gameData.sessions.pop();
            }
          }
          
          // Cập nhật phiên mới
          gameData.currentSession = res.sid;
          gameData.currentConfidence = Math.floor(Math.random() * (97 - 51 + 1)) + 51;
        }
        
        // LUÔN cập nhật dữ liệu phiên hiện tại
        gameData.pendingSession = {
          sid: res.sid,
          d1: res.d1,
          d2: res.d2,
          d3: res.d3,
          timestamp: Date.now()
        };
        
        gameData.lastUpdate = Date.now();
        console.log(`🎲 Phiên ${res.sid}: ${res.d1},${res.d2},${res.d3} → ${ketQuaTX(res.d1, res.d2, res.d3)}`);
      }
      // Xử lý lịch sử
      else if (Array.isArray(json) && json[1]?.htr) {
        gameData.sessions = json[1].htr
          .filter(x => x.d1 !== undefined)
          .map(x => ({
            sid: x.sid,
            d1: x.d1,
            d2: x.d2,
            d3: x.d3,
            result: ketQuaTX(x.d1, x.d2, x.d3),
            timestamp: Date.now()
          }))
          .sort((a, b) => b.sid - a.sid)
          .slice(0, 50);
          
        if (gameData.sessions.length > 0) {
          gameData.currentSession = gameData.sessions[0].sid;
        }
        console.log(`📚 Đã tải ${gameData.sessions.length} phiên lịch sử`);
      }
    } catch (error) {
      console.error("❌ Lỗi xử lý dữ liệu:", error.message);
    }
  });

  wsConnection.on('close', () => {
    gameData.isConnected = false;
    console.log("🔌 Mất kết nối, đang thử kết nối lại...");
    setTimeout(connectWebSocket, 5000);
  });

  wsConnection.on('error', (err) => {
    gameData.isConnected = false;
    console.error("❌ Lỗi kết nối:", err.message);
  });
}

// API Endpoint - FIXED: Định dạng chuẩn cho Robot Web
fastify.get("/api/789club", async (request, reply) => {
  try {
    // Tổng hợp dữ liệu
    const allResults = [
      ...(gameData.pendingSession ? [{
        ...gameData.pendingSession,
        result: ketQuaTX(gameData.pendingSession.d1, gameData.pendingSession.d2, gameData.pendingSession.d3)
      }] : []),
      ...gameData.sessions
    ];

    if (allResults.length < 1) {
      return reply.status(200).send({
        status: "waiting",
        message: "Đang chờ dữ liệu phiên...",
        is_connected: gameData.isConnected,
        latency: gameData.latency
      });
    }

    const phienHienTai = allResults[0];
    const phienTruoc = allResults[1] || phienHienTai; // Fallback nếu không có phiên trước
    
    // Tạo chuỗi lịch sử cho phân tích
    const lichSuTX = allResults.map(p => p.result).join("");
    const pattern = lichSuTX.substring(0, 6);

    // Định dạng response chuẩn
    const responseData = {
      status: "success",
      data: {
        phien: {
          hien_tai: phienHienTai.sid,
          truoc: phienTruoc.sid
        },
        xuc_xac: [phienHienTai.d1, phienHienTai.d2, phienHienTai.d3],
        ket_qua: phienHienTai.result,
        du_doan: duDoanTuTT(pattern),
        do_tin_cay: gameData.currentConfidence,
        thong_tin: {
          cau: lichSuTX.substring(0, 15),
          thuat_toan: pattern,
          update_time: gameData.lastUpdate,
          server_time: Date.now(),
          is_live: !!gameData.pendingSession,
          is_connected: gameData.isConnected,
          latency: gameData.latency
        }
      }
    };

    return reply.send(responseData);
  } catch (err) {
    console.error("Lỗi API:", err);
    return reply.status(500).send({
      status: "error",
      message: "Lỗi hệ thống",
      error: err.message
    });
  }
});

// Khởi động
connectWebSocket();

// Kiểm tra kết nối định kỳ
setInterval(() => {
  if (gameData.isConnected && (Date.now() - gameData.lastMessageTime) > 15000) {
    console.warn("⚠️ Không nhận được dữ liệu trong 15 giây, đóng kết nối...");
    wsConnection.close();
  }
}, 5000);

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error("Lỗi khởi động server:", err);
    process.exit(1);
  }
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
});

process.on("SIGINT", () => {
  console.log("🛑 Đang tắt server...");
  if (wsConnection) wsConnection.close();
  clearInterval(heartbeatTimer);
  clearInterval(latencyCheckTimer);
  fastify.close(() => process.exit(0));
});
