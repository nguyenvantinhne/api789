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
const MAX_SESSIONS = 100;

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
  currentSession: null,
  nextSession: null,
  pendingResult: null,
  lastUpdate: Date.now(),
  currentConfidence: Math.floor(Math.random() * (97 - 51 + 1)) + 51,
  isConnected: false,
  lastMessageTime: Date.now(),
  latency: 0,
  isLive: false
};

// Bản đồ dự đoán
const duDoanMap = {
  "TXT": "Xỉu", 
  "TTXX": "Tài", 
  "XXTXX": "Tài", 
  "TTX": "Xỉu", 
  "XTT": "Tài",
  "TXX": "Tài", 
  "XTX": "Xỉu", 
  "TXTX": "Tài", 
  "XTXX": "Tài", 
  "XXTX": "Tài",
  "TXTT": "Xỉu", 
  "TTT": "Tài", 
  "XXX": "Tài", 
  "TXXT": "Tài", 
  "XTXT": "Xỉu",
  "TXXT": "Tài", 
  "XXTT": "Tài", 
  "TTXX": "Xỉu", 
  "XTTX": "Tài", 
  "XTXTX": "Tài",
  "TTXXX": "Tài", 
  "XTTXT": "Tài", 
  "XXTXT": "Xỉu", 
  "TXTTX": "Tài", 
  "XTXXT": "Tài",
  "TTTXX": "Xỉu", 
  "XXTTT": "Tài", 
  "XTXTT": "Tài", 
  "TXTXT": "Tài", 
  "TTXTX": "Xỉu",
  "TXTTT": "Xỉu", 
  "XXTXTX": "Tài", 
  "XTXXTX": "Tài", 
  "TXTTTX": "Tài", 
  "TTTTXX": "Xỉu",
  "XTXTTX": "Tài", 
  "XTXXTT": "Tài", 
  "TXXTXX": "Tài", 
  "XXTXXT": "Tài", 
  "TXTTXX": "Xỉu",
  "TTTXTX": "Xỉu", 
  "TTXTTT": "Tài", 
  "TXXTTX": "Tài", 
  "XXTTTX": "Tài", 
  "XTTTTX": "Xỉu",
  "TXTXTT": "Tài", 
  "TXTXTX": "Tài", 
  "TTTTX": "Tài", 
  "XXXTX": "Tài", 
  "TXTTTX": "Xỉu",
  "XTXXXT": "Tài", 
  "XXTTXX": "Tài", 
  "TTTXXT": "Xỉu", 
  "XXTXXX": "Tài", 
  "XTXTXT": "Tài",
  "TTXXTX": "Tài", 
  "TTXXT": "Tài", 
  "TXXTX": "Xỉu", 
  "XTXXX": "Tài", 
  "XTXTX": "Xỉu",
  "TTXT": "Xỉu", 
  "TTTXT": "Xỉu",
  "TTTT": "Tài",
  "TTTTT": "Tài",
  "TTTTTT": "Xỉu",
  "TTTTTTT": "Tài",
  "TTTTTTX": "Xỉu",
  "TTTTTX": "Xỉu",
  "TTTTTXT": "Xỉu",
  "TTTTTXX": "Tài",
  "TTTTXT": "Xỉu",
  "TTTTXTT": "Tài",
  "TTTTXTX": "Xỉu",
  "TTTTXXT": "Xỉu",
  "TTTTXXX": "Tài",
  "TTTX": "Xỉu",
  "TTTXTT": "Tài",
  "TTTXTTT": "Xỉu",
  "TTTXTTX": "Xỉu",
  "TTTXTXT": "Tài",
  "TTTXTXX": "Tài",
  "TTTXXTT": "Tài",
  "TTTXXTX": "Tài",
  "TTTXXX": "Xỉu",
  "TTTXXXT": "Tài",
  "TTTXXXX": "Xỉu",
  "TTXTT": "Xỉu",
  "TTXTTTT": "Xỉu",
  "TTXTTTX": "Xỉu",
  "TTXTTX": "Tài",
  "TTXTTXT": "Tài",
  "TTXTTXX": "Xỉu",
  "TTXTXT": "Xỉu",
  "TTXTXTT": "Tài",
  "TTXTXTX": "Tài",
  "TTXTXX": "Xỉu",
  "TTXTXXT": "Tài",
  "TTXTXXX": "Xỉu",
  "TTXXTT": "Tài",
  "TTXXTTT": "Xỉu",
  "TTXXTTX": "Tài",
  "TTXXTXT": "Tài",
  "TTXXTXX": "Xỉu",
  "TTXXXT": "Xỉu",
  "TTXXXTT": "Tài",
  "TTXXXTX": "Tài",
  "TTXXXX": "Xỉu",
  "TTXXXXT": "Tài",
  "TTXXXXX": "Xỉu",
  "TXTTTT": "Xỉu",
  "TXTTTTT": "Xỉu",
  "TXTTTTX": "Xỉu",
  "TXTTTXT": "Xỉu",
  "TXTTTXX": "Tài",
  "TXTTXT": "Tài",
  "TXTTXTT": "Tài",
  "TXTTXTX": "Tài",
  "TXTTXXT": "Tài",
  "TXTTXXX": "Tài",
  "TXTXTTT": "Tài",
  "TXTXTTX": "Tài",
  "TXTXTXT": "Xỉu",
  "TXTXTXX": "Tài",
  "TXTXX": "Tài",
  "TXTXXT": "Tài",
  "TXTXXTT": "Tài",
  "TXTXXTX": "Xỉu",
  "TXTXXX": "Xỉu",
  "TXTXXXT": "Xỉu",
  "TXTXXXX": "Xỉu",
  "TXXTT": "Tài",
  "TXXTTT": "Tài",
  "TXXTTTT": "Tài",
  "TXXTTTX": "Tài",
  "TXXTTXT": "Xỉu",
  "TXXTTXX": "Xỉu",
  "TXXTXT": "Tài",
  "TXXTXTT": "Tài",
  "TXXTXTX": "Tài",
  "TXXTXXT": "Tài",
  "TXXTXXX": "Xỉu",
  "TXXX": "Tài",
  "TXXXT": "Tài",
  "TXXXTT": "Xỉu",
  "TXXXTTT": "Tài",
  "TXXXTTX": "Xỉu",
  "TXXXTX": "Xỉu",
  "TXXXTXT": "Tài",
  "TXXXTXX": "Xỉu",
  "TXXXX": "Xỉu",
  "TXXXXT": "Tài",
  "TXXXXTT": "Xỉu",
  "TXXXXTX": "Xỉu",
  "TXXXXX": "Tài",
  "TXXXXXT": "Xỉu",
  "TXXXXXX": "Xỉu",
  "XTTT": "Xỉu",
  "XTTTT": "Xỉu",
  "XTTTTT": "Tài",
  "XTTTTTT": "Tài",
  "XTTTTTX": "Tài",
  "XTTTTXT": "Tài",
  "XTTTTXX": "Xỉu",
  "XTTTX": "Tài",
  "XTTTXT": "Xỉu",
  "XTTTXTT": "Tài",
  "XTTTXTX": "Xỉu",
  "XTTTXX": "Tài",
  "XTTTXXT": "Tài",
  "XTTTXXX": "Tài",
  "XTTXTT": "Tài",
  "XTTXTTT": "Tài",
  "XTTXTTX": "Tài",
  "XTTXTX": "Xỉu",
  "XTTXTXT": "Tài",
  "XTTXTXX": "Xỉu",
  "XTTXX": "Xỉu",
  "XTTXXT": "Xỉu",
  "XTTXXTT": "Tài",
  "XTTXXTX": "Xỉu",
  "XTTXXX": "Tài",
  "XTTXXXT": "Xỉu",
  "XTTXXXX": "Tài",
  "XTXTTT": "Tài",
  "XTXTTTT": "Tài",
  "XTXTTTX": "Xỉu",
  "XTXTTXT": "Xỉu",
  "XTXTTXX": "Tài",
  "XTXTXTT": "Tài",
  "XTXTXTX": "Xỉu",
  "XTXTXX": "Tài",
  "XTXTXXT": "Tài",
  "XTXTXXX": "Tài",
  "XTXXTTT": "Tài",
  "XTXXTTX": "Xỉu",
  "XTXXTXT": "Tài",
  "XTXXTXX": "Tài",
  "XTXXXTT": "Xỉu",
  "XTXXXTX": "Tài",
  "XTXXXX": "Xỉu",
  "XTXXXXT": "Tài",
  "XTXXXXX": "Tài",
  "XXT": "Xỉu",
  "XXTTTT": "Tài",
  "XXTTTTT": "Xỉu",
  "XXTTTTX": "Tài",
  "XXTTTXT": "Xỉu",
  "XXTTTXX": "Xỉu",
  "XXTTX": "Tài",
  "XXTTXT": "Xỉu",
  "XXTTXTT": "Xỉu",
  "XXTTXTX": "Tài",
  "XXTTXXT": "Xỉu",
  "XXTTXXX": "Tài",
  "XXTXTT": "Tài",
  "XXTXTTT": "Tài",
  "XXTXTTX": "Xỉu",
  "XXTXTXT": "Tài",
  "XXTXTXX": "Tài",
  "XXTXXTT": "Xỉu",
  "XXTXXTX": "Xỉu",
  "XXTXXXT": "Tài",
  "XXTXXXX": "Tài",
  "XXXT": "Tài",
  "XXXTT": "Xỉu",
  "XXXTTT": "Xỉu",
  "XXXTTTT": "Xỉu",
  "XXXTTTX": "Xỉu",
  "XXXTTX": "Tài",
  "XXXTTXT": "Xỉu",
  "XXXTTXX": "Xỉu",
  "XXXTXT": "Tài",
  "XXXTXTT": "Tài",
  "XXXTXTX": "Xỉu",
  "XXXTXX": "Tài",
  "XXXTXXT": "Xỉu",
  "XXXTXXX": "Tài",
  "XXXX": "Tài",
  "XXXXT": "Xỉu",
  "XXXXTT": "Xỉu",
  "XXXXTTT": "Tài",
  "XXXXTTX": "Tài",
  "XXXXTX": "Tài",
  "XXXXTXT": "Tài",
  "XXXXTXX": "Tài",
  "XXXXX": "Tài",
  "XXXXXT": "Xỉu",
  "XXXXXTT": "Tài",
  "XXXXXTX": "Tài",
  "XXXXXX": "Tài",
  "XXXXXXT": "Tài",
  "XXXXXXX": "Tài"
};

function duDoanTuTT(pattern) {
  for (let len = Math.min(pattern.length, 6); len >= 1; len--) {
    const key = pattern.substring(0, len);
    if (duDoanMap[key]) return duDoanMap[key];
  }
  return pattern[0] === "T" ? "Tài" : "Xỉu";
}

function ketQuaTX(d1, d2, d3) {
  const tong = d1 + d2 + d3;
  return {
    result: tong >= 11 ? "T" : "X",
    tong: tong
  };
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
      
      if (Array.isArray(json) && json[3]?.res?.d1 !== undefined) {
        const res = json[3].res;
        const ketQua = ketQuaTX(res.d1, res.d2, res.d3);
        
        gameData.currentSession = res.sid;
        gameData.nextSession = res.sid + 1;
        
        gameData.pendingResult = {
          d1: res.d1,
          d2: res.d2, 
          d3: res.d3,
          result: ketQua.result,
          tong: ketQua.tong,
          timestamp: Date.now()
        };
        
        gameData.isLive = true;
        
        if (gameData.pendingResult) {
          gameData.sessions.unshift({
            sid: gameData.currentSession - 1,
            d1: gameData.pendingResult.d1,
            d2: gameData.pendingResult.d2,
            d3: gameData.pendingResult.d3,
            result: gameData.pendingResult.result,
            tong: gameData.pendingResult.tong,
            timestamp: gameData.pendingResult.timestamp
          });
          
          if (gameData.sessions.length > MAX_SESSIONS) {
            gameData.sessions.pop();
          }
        }
        
        gameData.lastUpdate = Date.now();
        console.log(`🎲 Phiên ${gameData.currentSession} (${res.d1},${res.d2},${res.d3}) → ${ketQua.result} ${ketQua.tong}`);
      }
      else if (Array.isArray(json) && json[1]?.htr) {
        gameData.sessions = json[1].htr
          .filter(x => x.d1 !== undefined)
          .map(x => {
            const ketQua = ketQuaTX(x.d1, x.d2, x.d3);
            return {
              sid: x.sid,
              d1: x.d1,
              d2: x.d2,
              d3: x.d3,
              result: ketQua.result,
              tong: ketQua.tong,
              timestamp: Date.now()
            };
          })
          .sort((a, b) => b.sid - a.sid)
          .slice(0, MAX_SESSIONS);
          
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
    gameData.isLive = false;
    console.log("🔌 Mất kết nối, đang thử kết nối lại...");
    setTimeout(connectWebSocket, 5000);
  });

  wsConnection.on('error', (err) => {
    gameData.isConnected = false;
    gameData.isLive = false;
    console.error("❌ Lỗi kết nối:", err.message);
  });
}

// API Endpoint với định dạng chuẩn cho bot
fastify.get("/api/789club", async (request, reply) => {
  try {
    const allResults = [
      ...(gameData.pendingResult ? [{
        sid: gameData.currentSession,
        d1: gameData.pendingResult.d1,
        d2: gameData.pendingResult.d2,
        d3: gameData.pendingResult.d3,
        result: gameData.pendingResult.result,
        tong: gameData.pendingResult.tong,
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

    const phienTruoc = allResults[0];
    const phienHienTai = gameData.nextSession || phienTruoc.sid + 1;
    const lichSuTX = allResults.map(p => p.result).join("");
    const pattern = lichSuTX.substring(0, 6);

    // Định dạng response chuẩn cho bot
    const response = {
      // Thông tin cơ bản
      status: "success",
      server_time: Date.now(),
      is_connected: gameData.isConnected,
      is_live: gameData.isLive,
      
      // Dữ liệu phiên
      phien_truoc: phienTruoc.sid,
      phien_hien_tai: phienHienTai,
      xuc_xac: [phienTruoc.d1, phienTruoc.d2, phienTruoc.d3],
      ket_qua: phienTruoc.result,
      tong: phienTruoc.tong,
      
      // Dự đoán
      du_doan: duDoanTuTT(pattern),
      do_tin_cay: `${gameData.currentConfidence}%`,
      
      // Lịch sử
      cau: lichSuTX.substring(0, 15),
      thuat_toan: pattern,
      total_sessions: gameData.sessions.length,
      
      // Định dạng đặc biệt cho bot
      bot_format: {
        phien_hien_tai: phienHienTai,
        du_doan: duDoanTuTT(pattern),
        do_tin_cay: gameData.currentConfidence,
        xucXac: `${phienTruoc.d1},${phienTruoc.d2},${phienTruoc.d3}`,
        ketQua: phienTruoc.result,
        tongDiem: phienTruoc.tong
      }
    };

    return reply.send(response);
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
