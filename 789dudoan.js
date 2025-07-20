const Fastify = require("fastify");
const cors = require("@fastify/cors");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;
const HEARTBEAT_INTERVAL = 800;
const MAX_RECONNECT_ATTEMPTS = 10;
const HISTORY_UPDATE_INTERVAL = 30000; // 30 giây

const fastify = Fastify({
  logger: true,
  bodyLimit: 1048576 * 10
});

const gameData = {
  sessions: [],
  currentSession: null,
  pendingSession: null,
  lastResults: [],
  lastUpdate: Date.now(),
  maxSessions: 100,
  isConnected: false,
  lastHistoryUpdate: 0
};

const predictionMap = {
  "TTT": { "prediction": "Tài", "confidence": 78 },
  "TTX": { "prediction": "Xỉu", "confidence": 89 },
  "TXT": { "prediction": "Tài", "confidence": 65 },
  "TXX": { "prediction": "Xỉu", "confidence": 92 },
  "XTT": { "prediction": "Tài", "confidence": 71 },
  "XTX": { "prediction": "Xỉu", "confidence": 83 },
  "XXT": { "prediction": "Tài", "confidence": 67 },
  "XXX": { "prediction": "Xỉu", "confidence": 96 },

  // Các cầu 4 ký tự
  "TTTT": { "prediction": "Tài", "confidence": 82 },
  "TTTX": { "prediction": "Xỉu", "confidence": 73 },
  "TTXT": { "prediction": "Tài", "confidence": 68 },
  "TTXX": { "prediction": "Xỉu", "confidence": 91 },
  "TXTT": { "prediction": "Tài", "confidence": 77 },
  "TXTX": { "prediction": "Xỉu", "confidence": 84 },
  "TXXT": { "prediction": "Tài", "confidence": 59 },
  "TXXX": { "prediction": "Xỉu", "confidence": 94 },
  "XTTT": { "prediction": "Tài", "confidence": 75 },
  "XTTX": { "prediction": "Xỉu", "confidence": 81 },
  "XTXT": { "prediction": "Tài", "confidence": 66 },
  "XTXX": { "prediction": "Xỉu", "confidence": 88 },
  "XXTT": { "prediction": "Tài", "confidence": 70 },
  "XXTX": { "prediction": "Xỉu", "confidence": 85 },
  "XXXT": { "prediction": "Tài", "confidence": 63 },
  "XXXX": { "prediction": "Xỉu", "confidence": 97 },

  // Các cầu 5 ký tự
  "TTTTT": { "prediction": "Tài", "confidence": 80 },
  "TTTTX": { "prediction": "Xỉu", "confidence": 72 },
  "TTTXT": { "prediction": "Tài", "confidence": 69 },
  "TTTXX": { "prediction": "Xỉu", "confidence": 90 },
  "TTXTT": { "prediction": "Tài", "confidence": 76 },
  "TTXTX": { "prediction": "Xỉu", "confidence": 83 },
  "TTXXT": { "prediction": "Tài", "confidence": 64 },
  "TTXXX": { "prediction": "Xỉu", "confidence": 93 },
  "TXTTT": { "prediction": "Tài", "confidence": 74 },
  "TXTTX": { "prediction": "Xỉu", "confidence": 79 },
  "TXTXT": { "prediction": "Tài", "confidence": 62 },
  "TXTXX": { "prediction": "Xỉu", "confidence": 87 },
  "TXXTT": { "prediction": "Tài", "confidence": 71 },
  "TXXTX": { "prediction": "Xỉu", "confidence": 82 },
  "TXXXT": { "prediction": "Tài", "confidence": 60 },
  "TXXXX": { "prediction": "Xỉu", "confidence": 95 },
  "XTTTT": { "prediction": "Tài", "confidence": 73 },
  "XTTTX": { "prediction": "Xỉu", "confidence": 78 },
  "XTTXT": { "prediction": "Tài", "confidence": 67 },
  "XTTXX": { "prediction": "Xỉu", "confidence": 86 },
  "XTXTT": { "prediction": "Tài", "confidence": 61 },
  "XTXTX": { "prediction": "Xỉu", "confidence": 80 },
  "XTXXT": { "prediction": "Tài", "confidence": 58 },
  "XTXXX": { "prediction": "Xỉu", "confidence": 96 },
  "XXTTT": { "prediction": "Tài", "confidence": 70 },
  "XXTTX": { "prediction": "Xỉu", "confidence": 81 },
  "XXTXT": { "prediction": "Tài", "confidence": 65 },
  "XXTXX": { "prediction": "Xỉu", "confidence": 84 },
  "XXXTT": { "prediction": "Tài", "confidence": 57 },
  "XXXTX": { "prediction": "Xỉu", "confidence": 89 },
  "XXXXT": { "prediction": "Tài", "confidence": 55 },
  "XXXXX": { "prediction": "Xỉu", "confidence": 99 },

  // Các cầu 6 ký tự
  "TTTTTT": { "prediction": "Tài", "confidence": 83 },
  "TTTTTX": { "prediction": "Xỉu", "confidence": 71 },
  "TTTTXT": { "prediction": "Tài", "confidence": 68 },
  "TTTTXX": { "prediction": "Xỉu", "confidence": 92 },
  "TTTXTT": { "prediction": "Tài", "confidence": 75 },
  "TTTXTX": { "prediction": "Xỉu", "confidence": 79 },
  "TTTXXT": { "prediction": "Tài", "confidence": 63 },
  "TTTXXX": { "prediction": "Xỉu", "confidence": 94 },
  "TTXTTT": { "prediction": "Tài", "confidence": 72 },
  "TTXTTX": { "prediction": "Xỉu", "confidence": 77 },
  "TTXTXT": { "prediction": "Tài", "confidence": 66 },
  "TTXTXX": { "prediction": "Xỉu", "confidence": 85 },
  "TTXXTT": { "prediction": "Tài", "confidence": 69 },
  "TTXXTX": { "prediction": "Xỉu", "confidence": 83 },
  "TTXXXT": { "prediction": "Tài", "confidence": 59 },
  "TTXXXX": { "prediction": "Xỉu", "confidence": 97 },
  "TXTTTT": { "prediction": "Tài", "confidence": 74 },
  "TXTTTX": { "prediction": "Xỉu", "confidence": 76 },
  "TXTTXT": { "prediction": "Tài", "confidence": 64 },
  "TXTTXX": { "prediction": "Xỉu", "confidence": 88 },
  "TXTXTT": { "prediction": "Tài", "confidence": 60 },
  "TXTXTX": { "prediction": "Xỉu", "confidence": 82 },
  "TXTXXT": { "prediction": "Tài", "confidence": 56 },
  "TXTXXX": { "prediction": "Xỉu", "confidence": 93 },
  "TXXTTT": { "prediction": "Tài", "confidence": 70 },
  "TXXTTX": { "prediction": "Xỉu", "confidence": 80 },
  "TXXTXT": { "prediction": "Tài", "confidence": 62 },
  "TXXTXX": { "prediction": "Xỉu", "confidence": 87 },
  "TXXXTT": { "prediction": "Tài", "confidence": 54 },
  "TXXXTX": { "prediction": "Xỉu", "confidence": 90 },
  "TXXXXT": { "prediction": "Tài", "confidence": 51 },
  "TXXXXX": { "prediction": "Xỉu", "confidence": 98 },
  "XTTTTT": { "prediction": "Tài", "confidence": 73 },
  "XTTTTX": { "prediction": "Xỉu", "confidence": 78 },
  "XTTTXT": { "prediction": "Tài", "confidence": 65 },
  "XTTTXX": { "prediction": "Xỉu", "confidence": 86 },
  "XTTXTT": { "prediction": "Tài", "confidence": 61 },
  "XTTXTX": { "prediction": "Xỉu", "confidence": 81 },
  "XTTXXT": { "prediction": "Tài", "confidence": 57 },
  "XTTXXX": { "prediction": "Xỉu", "confidence": 95 },
  "XTXTTT": { "prediction": "Tài", "confidence": 67 },
  "XTXTTX": { "prediction": "Xỉu", "confidence": 84 },
  "XTXTXT": { "prediction": "Tài", "confidence": 58 },
  "XTXTXX": { "prediction": "Xỉu", "confidence": 89 },
  "XTXXTT": { "prediction": "Tài", "confidence": 53 },
  "XTXXTX": { "prediction": "Xỉu", "confidence": 91 },
  "XTXXXT": { "prediction": "Tài", "confidence": 50 },
  "XTXXXX": { "prediction": "Xỉu", "confidence": 99 },
  "XXTTTT": { "prediction": "Tài", "confidence": 72 },
  "XXTTTX": { "prediction": "Xỉu", "confidence": 79 },
  "XXTTXT": { "prediction": "Tài", "confidence": 63 },
  "XXTTXX": { "prediction": "Xỉu", "confidence": 85 },
  "XXTXTT": { "prediction": "Tài", "confidence": 59 },
  "XXTXTX": { "prediction": "Xỉu", "confidence": 83 },
  "XXTXXT": { "prediction": "Tài", "confidence": 55 },
  "XXTXXX": { "prediction": "Xỉu", "confidence": 94 },
  "XXXTTT": { "prediction": "Tài", "confidence": 52 },
  "XXXTTX": { "prediction": "Xỉu", "confidence": 92 },
  "XXXTXT": { "prediction": "Tài", "confidence": 49 },
  "XXXTXX": { "prediction": "Xỉu", "confidence": 96 },
  "XXXXTT": { "prediction": "Tài", "confidence": 48 },
  "XXXXTX": { "prediction": "Xỉu", "confidence": 97 },
  "XXXXXT": { "prediction": "Tài", "confidence": 45 },
  "XXXXXX": { "prediction": "Xỉu", "confidence": 100 }
}

function predictFromPattern(pattern) {
  for (let len = Math.min(pattern.length, 8); len >= 3; len--) {
    const key = pattern.substring(0, len);
    if (predictionMap[key]) {
      const roundedConfidence = Math.round(predictionMap[key].confidence / 10) * 10;
      return {
        prediction: predictionMap[key].prediction,
        confidence: Math.min(Math.max(roundedConfidence, 50), 97)
      };
    }
  }
  return {
    prediction: pattern[0] === "T" ? "Tài" : "Xỉu",
    confidence: 50
  };
}

function calculateResult(d1, d2, d3) {
  const sum = d1 + d2 + d3;
  return {
    result: sum >= 11 ? "T" : "X",
    sum: sum
  };
}

let wsConnection = null;
let heartbeatTimer = null;
let reconnectAttempts = 0;
let historyTimer = null;

function connectWebSocket() {
  if (wsConnection) {
    wsConnection.removeAllListeners();
    if (wsConnection.readyState !== WebSocket.CLOSED) {
      wsConnection.close();
    }
  }

  clearInterval(heartbeatTimer);
  clearInterval(historyTimer);

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    fastify.log.error(`Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
    return;
  }

  reconnectAttempts++;
  fastify.log.info(`Connecting to SunWin (attempt ${reconnectAttempts})...`);

  wsConnection = new WebSocket("wss://websocket.atpman.net/websocket");

  wsConnection.on('open', () => {
    reconnectAttempts = 0;
    gameData.isConnected = true;
    fastify.log.info("Connection established");
    
    const authData = [
      1,
      "MiniGame",
      "dfghhhgffgggg",
      "tinhbip",
      {
        info: "{\"ipAddress\":\"2001:ee0:514c:dbf0:155e:5c33:dfae:3ecf\",\"userId\":\"f68cd413-44d4-4bf5-96eb-23da9a317f17\",\"username\":\"S8_dfghhhgffgggg\",\"timestamp\":1752435193341,\"refreshToken\":\"498e236e749f4afdb8517d1cd23a419b.0ab31b9e397f4cf0b9c23b3d6a7596b6\"}",
        signature: "2CCB075DA9F40825F487AF718A22DEE57A3C69F2038F02BE71FFF64EB0D5ADC4572E91B05D62DF2A3F03D93E96324DBAEE15873B46F9869E8EA9CED430DFC8A017806F02A33A07FC6AF844BD11FFB0BCA0A4E6C8F39E4ECE7AE6A72EDB6223D8A97C0540FF76E2608BF41361CBD71148766FEE6A1CE4B70110ED6CF3C366EB0D"
      }
    ];
    
    wsConnection.send(JSON.stringify(authData));
    wsConnection.send(JSON.stringify([6, "MiniGame", "taixiuUnbalancedPlugin", { cmd: 1001 }]));
    
    heartbeatTimer = setInterval(() => {
      if (wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify([6, "MiniGame", "taixiuUnbalancedPlugin", { cmd: 2000 }]));
      }
    }, HEARTBEAT_INTERVAL);

    // Load history immediately and then every 30 seconds
    loadHistory();
    historyTimer = setInterval(loadHistory, HISTORY_UPDATE_INTERVAL);
  });

  function loadHistory() {
    if (wsConnection.readyState === WebSocket.OPEN) {
      const now = Date.now();
      if (now - gameData.lastHistoryUpdate > 25000) { // Chỉ tải nếu đã qua 25s từ lần cuối
        wsConnection.send(JSON.stringify([6, "MiniGame", "taixiuUnbalancedPlugin", { cmd: 1002, count: 100 }]));
        gameData.lastHistoryUpdate = now;
      }
    }
  }

  wsConnection.on('message', (data) => {
    try {
      const json = JSON.parse(data);

      if (Array.isArray(json) && json[3]?.res?.d1 !== undefined) {
        const res = json[3].res;
        const newSession = {
          sid: res.sid,
          d1: res.d1,
          d2: res.d2,
          d3: res.d3,
          timestamp: Date.now()
        };

        // Nếu là phiên mới hoặc chưa có phiên nào
        if (gameData.currentSession === null || res.sid > gameData.currentSession) {
          // Nếu có pending session, lưu vào lastResults
          if (gameData.pendingSession) {
            const result = calculateResult(gameData.pendingSession.d1, gameData.pendingSession.d2, gameData.pendingSession.d3);
            gameData.lastResults.unshift({
              ...gameData.pendingSession,
              result: result.result,
              sum: result.sum
            });
            
            if (gameData.lastResults.length > 20) {
              gameData.lastResults.pop();
            }
          }
          
          gameData.currentSession = res.sid;
          fastify.log.info(`New session detected: ${res.sid}`);
        }

        // Luôn cập nhật pending session với dữ liệu mới nhất
        gameData.pendingSession = newSession;
        gameData.lastUpdate = Date.now();
        fastify.log.info(`Updated session ${res.sid}: ${res.d1},${res.d2},${res.d3}`);
      }
      else if (Array.isArray(json) && json[1]?.htr) {
        gameData.sessions = json[1].htr
          .filter(x => x.d1 !== undefined)
          .map(x => {
            const result = calculateResult(x.d1, x.d2, x.d3);
            return {
              sid: x.sid,
              d1: x.d1,
              d2: x.d2,
              d3: x.d3,
              result: result.result,
              sum: result.sum,
              timestamp: Date.now()
            };
          })
          .sort((a, b) => b.sid - a.sid)
          .slice(0, gameData.maxSessions);
          
        if (gameData.sessions.length > 0) {
          gameData.currentSession = gameData.sessions[0].sid;
        }
        fastify.log.info(`Loaded ${gameData.sessions.length} historical sessions`);
      }
    } catch (error) {
      fastify.log.error("Data processing error:", error);
    }
  });

  wsConnection.on('close', () => {
    gameData.isConnected = false;
    fastify.log.warn("Connection lost, attempting to reconnect...");
    setTimeout(connectWebSocket, 5000);
  });

  wsConnection.on('error', (err) => {
    gameData.isConnected = false;
    fastify.log.error("Connection error:", err);
  });
}

fastify.register(cors, {
  origin: "*",
  methods: ["GET", "OPTIONS"]
});

fastify.get("/api/789club", async (request, reply) => {
  try {
    const allResults = [
      ...(gameData.pendingSession ? [{
        ...gameData.pendingSession,
        ...calculateResult(gameData.pendingSession.d1, gameData.pendingSession.d2, gameData.pendingSession.d3)
      }] : []),
      ...gameData.lastResults,
      ...gameData.sessions
    ].sort((a, b) => b.sid - a.sid);

    if (allResults.length === 0) {
      return reply.status(404).send({
        status: "error",
        message: "No session data available",
        is_connected: gameData.isConnected
      });
    }

    const last15Results = allResults.slice(0, 15);
    const pattern = last15Results.map(p => p.result).join("");

    const prediction = predictFromPattern(pattern);

    const response = {
      status: "success",
      session: allResults[0].sid,
      dice: [allResults[0].d1, allResults[0].d2, allResults[0].d3],
      result: allResults[0].result,
      sum: allResults[0].sum,
      next_session: allResults[0].sid + 1,
      prediction: prediction.prediction,
      confidence: `${prediction.confidence}%`,
      pattern: pattern,
      algorithm: pattern.substring(0, 6),
      last_update: gameData.lastUpdate,
      server_time: Date.now(),
      is_live: !!gameData.pendingSession,
      is_connected: gameData.isConnected,
      total_sessions: allResults.length
    };

    const robotResponse = {
      phien: response.next_session || response.session || "...",
      du_doan: response.prediction || "...",
      do_tin_cay: prediction.confidence || "...",
      data: response
    };

    return robotResponse;
  } catch (err) {
    fastify.log.error("API error:", err);
    return reply.status(500).send({
      status: "error",
      message: "System error"
    });
  }
});

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    fastify.log.error("Server startup error:", err);
    process.exit(1);
  }
  fastify.log.info(`Server running on port ${PORT}`);
  connectWebSocket();
});

process.on("SIGINT", () => {
  fastify.log.info("Shutting down server...");
  if (wsConnection) wsConnection.close();
  clearInterval(heartbeatTimer);
  clearInterval(historyTimer);
  fastify.close().then(() => {
    process.exit(0);
  });
});
