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

// Cấu hình WebSocket headers
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
  currentSession: null,       // Phiên realtime từ WS (phien_truoc)
  nextSession: null,         // Phiên hiện tại (phien_hien_tai = phien_truoc + 1)
  pendingResult: null,       // Kết quả xúc xắc đang chờ
  lastUpdate: Date.now(),
  currentConfidence: Math.floor(Math.random() * (97 - 51 + 1)) + 51,
  isConnected: false,
  lastMessageTime: Date.now(),
  latency: 0
};

// Bản đồ dự đoán
const duDoanMap = {
  "TTTTTT": "Xỉu", "TTTTTX": "Xỉu", "TTTTXT": "Xỉu", "TTTTXX": "Tài",
  "TTTXTT": "Xỉu", "TTTXTX": "Tài", "TTTXXT": "Tài", "TTTXXX": "Xỉu",
  "TTXTTT": "Xỉu", "TTXTTX": "Tài", "TTXTXT": "Tài", "TTXTXX": "Xỉu",
  "TTXXTT": "Tài", "TTXXTX": "Xỉu", "TTXXXT": "Xỉu", "TTXXXX": "Tài",
  "TXTTTT": "Xỉu", "TXTTTX": "Tài", "TXTTXT": "Tài", "TXTTXX": "Xỉu",
  "TXTXTT": "Tài", "TXTXTX": "Xỉu", "TXTXXT": "Xỉu", "TXTXXX": "Tài",
  "TXXTTT": "Tài", "TXXTTX": "Xỉu", "TXXTXT": "Xỉu", "TXXTXX": "Tài",
  "TXXXTT": "Xỉu", "TXXXTX": "Tài", "TXXXXT": "Tài", "TXXXXX": "Xỉu",
  "XTTTTT": "Tài", "XTTTTX": "Xỉu", "XTTTXT": "Xỉu", "XTTTXX": "Tài",
  "XTTXTT": "Xỉu", "XTTXTX": "Tài", "XTTXXT": "Tài", "XTTXXX": "Xỉu",
  "XTXTTT": "Xỉu", "XTXTTX": "Tài", "XTXTXT": "Tài", "XTXTXX": "Xỉu",
  "XTXXTT": "Tài", "XTXXTX": "Xỉu", "XTXXXT": "Xỉu", "XTXXXX": "Tài",
  "XXTTTT": "Xỉu", "XXTTTX": "Tài", "XXTTXT": "Tài", "XXTTXX": "Xỉu",
  "XXTXTT": "Tài", "XXTXTX": "Xỉu", "XXTXXT": "Xỉu", "XXTXXX": "Tài",
  "XXXTTT": "Tài", "XXXTTX": "Xỉu", "XXXTXT": "Xỉu", "XXXTXX": "Tài",
  "XXXXTT": "Xỉu", "XXXXTX": "Tài", "XXXXXT": "Tài", "XXXXXX": "Xỉu",
  // Các mẫu ngắn hơn
  "TTTTT": "Xỉu", "TTTTX": "Xỉu", "TTTXT": "Xỉu", "TTTXX": "Tài",
  "TTXTT": "Xỉu", "TTXTX": "Tài", "TTXXT": "Tài", "TTXXX": "Xỉu",
  "TXTTT": "Xỉu", "TXTTX": "Tài", "TXTXT": "Tài", "TXTXX": "Xỉu",
  "TXXTT": "Tài", "TXXTX": "Xỉu", "TXXXT": "Xỉu", "TXXXX": "Tài",
  "XTTTT": "Xỉu", "XTTTX": "Tài", "XTTXT": "Tài", "XTTXX": "Xỉu",
  "XTXTT": "Tài", "XTXTX": "Xỉu", "XTXXT": "Xỉu", "XTXXX": "Tài",
  "XXTTT": "Tài", "XXTTX": "Xỉu", "XXTXT": "Xỉu", "XXTXX": "Tài",
  "XXXTT": "Xỉu", "XXXTX": "Tài", "XXXXT": "Tài", "XXXXX": "Xỉu",
  // Các mẫu ngắn hơn nữa
  "TTTT": "Xỉu", "TTTX": "Xỉu", "TTXT": "Xỉu", "TTXX": "Tài",
  "TXTT": "Xỉu", "TXTX": "Tài", "TXXT": "Tài", "TXXX": "Xỉu",
  "XTTT": "Xỉu", "XTTX": "Tài", "XTXT": "Tài", "XTXX": "Xỉu",
  "XXTT": "Tài", "XXTX": "Xỉu", "XXXT": "Xỉu", "XXXX": "Tài",
  // Các mẫu ngắn nhất
  "TTT": "Xỉu", "TTX": "Xỉu", "TXT": "Tài", "TXX": "Tài",
  "XTT": "Xỉu", "XTX": "Tài", "XXT": "Xỉu", "XXX": "Tài",
  "TT": "Xỉu", "TX": "Tài", "XT": "Tài", "XX": "Xỉu",
  "T": "Tài", "X": "Xỉu"
};

function duDoanTuTT(pattern) {
  for (let len = Math.min(pattern.length, 6); len >= 1; len--) {
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
      
      // Xử lý kết quả realtime
      if (Array.isArray(json) && json[3]?.res?.d1 !== undefined) {
        const res = json[3].res;
        
        // Cập nhật phiên realtime (phien_truoc)
        gameData.currentSession = res.sid;
        
        // Tạo phiên hiện tại (phien_hien_tai = phien_truoc + 1)
        gameData.nextSession = res.sid + 1;
        
        // Lưu kết quả đang chờ
        gameData.pendingResult = {
          d1: res.d1,
          d2: res.d2, 
          d3: res.d3,
          timestamp: Date.now()
        };
        
        // Đẩy kết quả cũ vào lịch sử nếu có
        if (gameData.pendingResult) {
          gameData.sessions.unshift({
            sid: gameData.currentSession - 1, // Phiên trước đó
            d1: gameData.pendingResult.d1,
            d2: gameData.pendingResult.d2,
            d3: gameData.pendingResult.d3,
            result: ketQuaTX(gameData.pendingResult.d1, gameData.pendingResult.d2, gameData.pendingResult.d3),
            timestamp: gameData.pendingResult.timestamp
          });
          
          if (gameData.sessions.length > 50) {
            gameData.sessions.pop();
          }
        }
        
        gameData.lastUpdate = Date.now();
        console.log(`🎲 Phiên ${gameData.currentSession} (realtime) → ${gameData.nextSession} (hiển thị) | ${res.d1},${res.d2},${res.d3} → ${ketQuaTX(res.d1, res.d2, res.d3)}`);
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
          gameData.nextSession = gameData.currentSession + 1;
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

// API Endpoint
fastify.get("/api/789club", async (request, reply) => {
  try {
    // Tổng hợp dữ liệu
    const allResults = [
      ...(gameData.pendingResult ? [{
        sid: gameData.currentSession, // Sử dụng phiên realtime
        d1: gameData.pendingResult.d1,
        d2: gameData.pendingResult.d2,
        d3: gameData.pendingResult.d3,
        result: ketQuaTX(gameData.pendingResult.d1, gameData.pendingResult.d2, gameData.pendingResult.d3),
        timestamp: gameData.pendingResult.timestamp
      }] : []),
      ...gameData.sessions
    ];

    if (allResults.length < 1) {
      return reply.status(200).send({
        status: "waiting",
        message: "Đang chờ dữ liệu phiên...",
        is_connected: gameData.isConnected
      });
    }

    const phienTruoc = allResults[0]; // Phiên realtime từ WS
    const phienHienTai = gameData.nextSession || phienTruoc.sid + 1; // Luôn là phien_truoc + 1
    
    // Tạo chuỗi lịch sử
    const lichSuTX = allResults.map(p => p.result).join("");
    const pattern = lichSuTX.substring(0, 6);

    return {
      status: "success",
      phien: {
        truoc: phienTruoc.sid,     // Phiên realtime từ WS (không thay đổi)
        hien_tai: phienHienTai     // Luôn là phien_truoc + 1
      },
      xuc_xac: [phienTruoc.d1, phienTruoc.d2, phienTruoc.d3],
      ket_qua: phienTruoc.result,
      du_doan: duDoanTuTT(pattern),
      do_tin_cay: `${gameData.currentConfidence}%`,
      thong_tin: {
        cau: lichSuTX.substring(0, 15),
        thuat_toan: pattern,
        update_time: gameData.lastUpdate,
        server_time: Date.now(),
        is_connected: gameData.isConnected,
        latency: gameData.latency
      }
    };
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
