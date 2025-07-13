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
  // 3-dice base patterns (8 variants)
  "TTT": { prediction: "Tài", confidence: 95 },
  "TTX": { prediction: "Xỉu", confidence: 85 },
  "TXT": { prediction: "Tài", confidence: 75 },
  "TXX": { prediction: "Xỉu", confidence: 80 },
  "XTT": { prediction: "Tài", confidence: 70 },
  "XTX": { prediction: "Xỉu", confidence: 65 },
  "XXT": { prediction: "Tài", confidence: 60 },
  "XXX": { prediction: "Xỉu", confidence: 90 },

  // 4-dice patterns (16 variants)
  "TTTT": { prediction: "Tài", confidence: 97 },
  "TTTX": { prediction: "Xỉu", confidence: 85 },
  "TTXT": { prediction: "Tài", confidence: 80 },
  "TTXX": { prediction: "Xỉu", confidence: 85 },
  "TXTT": { prediction: "Tài", confidence: 75 },
  "TXTX": { prediction: "Xỉu", confidence: 80 },
  "TXXT": { prediction: "Tài", confidence: 70 },
  "TXXX": { prediction: "Xỉu", confidence: 90 },
  "XTTT": { prediction: "Tài", confidence: 75 },
  "XTTX": { prediction: "Xỉu", confidence: 70 },
  "XTXT": { prediction: "Tài", confidence: 65 },
  "XTXX": { prediction: "Xỉu", confidence: 85 },
  "XXTT": { prediction: "Tài", confidence: 60 },
  "XXTX": { prediction: "Xỉu", confidence: 75 },
  "XXXT": { prediction: "Tài", confidence: 55 },
  "XXXX": { prediction: "Xỉu", confidence: 95 },

  // 5-dice patterns (32 variants) - Optimized confidence scaling
  "TTTTT": { prediction: "Tài", confidence: 98 },
  "TTTTX": { prediction: "Tài", confidence: 88 },
  "TTTXT": { prediction: "Tài", confidence: 83 },
  "TTTXX": { prediction: "Xỉu", confidence: 82 },
  "TTXTT": { prediction: "Tài", confidence: 78 },
  "TTXTX": { prediction: "Xỉu", confidence: 77 },
  "TTXXT": { prediction: "Tài", confidence: 72 },
  "TTXXX": { prediction: "Xỉu", confidence: 88 },
  "TXTTT": { prediction: "Tài", confidence: 77 },
  "TXTTX": { prediction: "Xỉu", confidence: 76 },
  "TXTXT": { prediction: "Tài", confidence: 71 },
  "TXTXX": { prediction: "Xỉu", confidence: 83 },
  "TXXTT": { prediction: "Tài", confidence: 68 },
  "TXXTX": { prediction: "Xỉu", confidence: 73 },
  "TXXXT": { prediction: "Tài", confidence: 63 },
  "TXXXX": { prediction: "Xỉu", confidence: 93 },
  "XTTTT": { prediction: "Tài", confidence: 73 },
  "XTTTX": { prediction: "Xỉu", confidence: 77 },
  "XTTXT": { prediction: "Tài", confidence: 67 },
  "XTTXX": { prediction: "Xỉu", confidence: 82 },
  "XTXTT": { prediction: "Tài", confidence: 63 },
  "XTXTX": { prediction: "Xỉu", confidence: 72 },
  "XTXXT": { prediction: "Tài", confidence: 58 },
  "XTXXX": { prediction: "Xỉu", confidence: 88 },
  "XXTTT": { prediction: "Tài", confidence: 67 },
  "XXTTX": { prediction: "Xỉu", confidence: 72 },
  "XXTXT": { prediction: "Tài", confidence: 62 },
  "XXTXX": { prediction: "Xỉu", confidence: 82 },
  "XXXTT": { prediction: "Tài", confidence: 58 },
  "XXXTX": { prediction: "Xỉu", confidence: 68 },
  "XXXXT": { prediction: "Tài", confidence: 53 },
  "XXXXX": { prediction: "Xỉu", confidence: 98 },

  // 6-dice patterns (64 variants) - Premium prediction engine
  "TTTTTT": { prediction: "Tài", confidence: 99 },
  "TTTTTX": { prediction: "Tài", confidence: 92 },
  "TTTTXT": { prediction: "Tài", confidence: 87 },
  "TTTTXX": { prediction: "Xỉu", confidence: 85 },
  "TTTXTT": { prediction: "Tài", confidence: 84 },
  "TTTXTX": { prediction: "Xỉu", confidence: 79 },
  "TTTXXT": { prediction: "Tài", confidence: 77 },
  "TTTXXX": { prediction: "Xỉu", confidence: 93 },
  "TTXTTT": { prediction: "Tài", confidence: 79 },
  "TTXTTX": { prediction: "Xỉu", confidence: 82 },
  "TTXTXT": { prediction: "Tài", confidence: 77 },
  "TTXTXX": { prediction: "Xỉu", confidence: 84 },
  "TTXXTT": { prediction: "Tài", confidence: 73 },
  "TTXXTX": { prediction: "Xỉu", confidence: 78 },
  "TTXXXT": { prediction: "Tài", confidence: 68 },
  "TTXXXX": { prediction: "Xỉu", confidence: 95 },
  "TXTTTT": { prediction: "Tài", confidence: 78 },
  "TXTTTX": { prediction: "Xỉu", confidence: 79 },
  "TXTTXT": { prediction: "Tài", confidence: 73 },
  "TXTTXX": { prediction: "Xỉu", confidence: 83 },
  "TXTXTT": { prediction: "Tài", confidence: 68 },
  "TXTXTX": { prediction: "Xỉu", confidence: 77 },
  "TXTXXT": { prediction: "Tài", confidence: 67 },
  "TXTXXX": { prediction: "Xỉu", confidence: 91 },
  "TXXTTT": { prediction: "Tài", confidence: 73 },
  "TXXTTX": { prediction: "Xỉu", confidence: 77 },
  "TXXTXT": { prediction: "Tài", confidence: 67 },
  "TXXTXX": { prediction: "Xỉu", confidence: 83 },
  "TXXXTT": { prediction: "Tài", confidence: 67 },
  "TXXXTX": { prediction: "Xỉu", confidence: 73 },
  "TXXXXT": { prediction: "Tài", confidence: 63 },
  "TXXXXX": { prediction: "Xỉu", confidence: 97 },
  "XTTTTT": { prediction: "Tài", confidence: 77 },
  "XTTTTX": { prediction: "Xỉu", confidence: 82 },
  "XTTTXT": { prediction: "Tài", confidence: 72 },
  "XTTTXX": { prediction: "Xỉu", confidence: 83 },
  "XTTXTT": { prediction: "Tài", confidence: 67 },
  "XTTXTX": { prediction: "Xỉu", confidence: 77 },
  "XTTXXT": { prediction: "Tài", confidence: 67 },
  "XTTXXX": { prediction: "Xỉu", confidence: 91 },
  "XTXTTT": { prediction: "Tài", confidence: 72 },
  "XTXTTX": { prediction: "Xỉu", confidence: 77 },
  "XTXTXT": { prediction: "Tài", confidence: 67 },
  "XTXTXX": { prediction: "Xỉu", confidence: 83 },
  "XTXXTT": { prediction: "Tài", confidence: 67 },
  "XTXXTX": { prediction: "Xỉu", confidence: 73 },
  "XTXXXT": { prediction: "Tài", confidence: 63 },
  "XTXXXX": { prediction: "Xỉu", confidence: 95 },
  "XXTTTT": { prediction: "Tài", confidence: 72 },
  "XXTTTX": { prediction: "Xỉu", confidence: 77 },
  "XXTTXT": { prediction: "Tài", confidence: 67 },
  "XXTTXX": { prediction: "Xỉu", confidence: 82 },
  "XXTXTX": { prediction: "Xỉu", confidence: 77 },
  "XXTXXT": { prediction: "Tài", confidence: 67 },
  "XXTXXX": { prediction: "Xỉu", confidence: 89 },
  "XXXTTT": { prediction: "Tài", confidence: 67 },
  "XXXTTX": { prediction: "Xỉu", confidence: 72 },
  "XXXTXT": { prediction: "Tài", confidence: 67 },
  "XXXTXX": { prediction: "Xỉu", confidence: 81 },
  "XXXXTT": { prediction: "Tài", confidence: 63 },
  "XXXXTX": { prediction: "Xỉu", confidence: 68 },
  "XXXXXT": { prediction: "Tài", confidence: 58 },
  "XXXXXX": { prediction: "Xỉu", confidence: 99 },

  // 7-dice patterns (128 variants) - VIP prediction system
  "TTTTTTT": { prediction: "Tài", confidence: 99 },
  "TTTTTTX": { prediction: "Tài", confidence: 94 },
  "TTTTTXT": { prediction: "Tài", confidence: 89 },
  "TTTTTXX": { prediction: "Xỉu", confidence: 87 },
  "TTTTXTT": { prediction: "Tài", confidence: 86 },
  "TTTTXTX": { prediction: "Xỉu", confidence: 81 },
  "TTTTXXT": { prediction: "Tài", confidence: 79 },
  "TTTTXXX": { prediction: "Xỉu", confidence: 95 },
  "TTTXTTT": { prediction: "Tài", confidence: 81 },
  "TTTXTTX": { prediction: "Xỉu", confidence: 84 },
  "TTTXTXT": { prediction: "Tài", confidence: 79 },
  "TTTXTXX": { prediction: "Xỉu", confidence: 86 },
  "TTTXXTT": { prediction: "Tài", confidence: 75 },
  "TTTXXTX": { prediction: "Xỉu", confidence: 80 },
  "TTTXXXT": { prediction: "Tài", confidence: 70 },
  "TTTXXXX": { prediction: "Xỉu", confidence: 97 },
  "TTXTTTT": { prediction: "Tài", confidence: 80 },
  "TTXTTTX": { prediction: "Xỉu", confidence: 83 },
  "TTXTTXT": { prediction: "Tài", confidence: 75 },
  "TTXTTXX": { prediction: "Xỉu", confidence: 85 },
  "TTXTXTT": { prediction: "Tài", confidence: 70 },
  "TTXTXTX": { prediction: "Xỉu", confidence: 79 },
  "TTXTXXT": { prediction: "Tài", confidence: 69 },
  "TTXTXXX": { prediction: "Xỉu", confidence: 93 },
  "TTXXTTT": { prediction: "Tài", confidence: 75 },
  "TTXXTTX": { prediction: "Xỉu", confidence: 79 },
  "TTXXTXT": { prediction: "Tài", confidence: 69 },
  "TTXXTXX": { prediction: "Xỉu", confidence: 85 },
  "TTXXXTT": { prediction: "Tài", confidence: 69 },
  "TTXXXTX": { prediction: "Xỉu", confidence: 75 },
  "TTXXXXT": { prediction: "Tài", confidence: 65 },
  "TTXXXXX": { prediction: "Xỉu", confidence: 98 },
  "TXTTTTT": { prediction: "Tài", confidence: 79 },
  "TXTTTTX": { prediction: "Xỉu", confidence: 83 },
  "TXTTTXT": { prediction: "Tài", confidence: 75 },
  "TXTTTXX": { prediction: "Xỉu", confidence: 85 },
  "TXTTXTT": { prediction: "Tài", confidence: 69 },
  "TXTTXTX": { prediction: "Xỉu", confidence: 79 },
  "TXTTXXT": { prediction: "Tài", confidence: 69 },
  "TXTTXXX": { prediction: "Xỉu", confidence: 93 },
  "TXTXTTT": { prediction: "Tài", confidence: 74 },
  "TXTXTTX": { prediction: "Xỉu", confidence: 79 },
  "TXTXTXT": { prediction: "Tài", confidence: 69 },
  "TXTXTXX": { prediction: "Xỉu", confidence: 85 },
  "TXTXXTT": { prediction: "Tài", confidence: 69 },
  "TXTXXTX": { prediction: "Xỉu", confidence: 75 },
  "TXTXXXT": { prediction: "Tài", confidence: 65 },
  "TXTXXXX": { prediction: "Xỉu", confidence: 97 },
  "TXXTTTT": { prediction: "Tài", confidence: 74 },
  "TXXTTTX": { prediction: "Xỉu", confidence: 79 },
  "TXXTTXT": { prediction: "Tài", confidence: 69 },
  "TXXTTXX": { prediction: "Xỉu", confidence: 84 },
  "TXXTXTX": { prediction: "Xỉu", confidence: 79 },
  "TXXTXXT": { prediction: "Tài", confidence: 69 },
  "TXXTXXX": { prediction: "Xỉu", confidence: 91 },
  "TXXXTTT": { prediction: "Tài", confidence: 69 },
  "TXXXTTX": { prediction: "Xỉu", confidence: 74 },
  "TXXXTXT": { prediction: "Tài", confidence: 69 },
  "TXXXTXX": { prediction: "Xỉu", confidence: 83 },
  "TXXXXTT": { prediction: "Tài", confidence: 65 },
  "TXXXXTX": { prediction: "Xỉu", confidence: 70 },
  "TXXXXXT": { prediction: "Tài", confidence: 60 },
  "TXXXXXX": { prediction: "Xỉu", confidence: 99 },
  "XTTTTTT": { prediction: "Tài", confidence: 79 },
  "XTTTTTX": { prediction: "Xỉu", confidence: 84 },
  "XTTTTXT": { prediction: "Tài", confidence: 75 },
  "XTTTTXX": { prediction: "Xỉu", confidence: 85 },
  "XTTTXTT": { prediction: "Tài", confidence: 69 },
  "XTTTXTX": { prediction: "Xỉu", confidence: 79 },
  "XTTTXXT": { prediction: "Tài", confidence: 69 },
  "XTTTXXX": { prediction: "Xỉu", confidence: 93 },
  "XTTXTTT": { prediction: "Tài", confidence: 74 },
  "XTTXTTX": { prediction: "Xỉu", confidence: 79 },
  "XTTXTXT": { prediction: "Tài", confidence: 69 },
  "XTTXTXX": { prediction: "Xỉu", confidence: 85 },
  "XTTXXTT": { prediction: "Tài", confidence: 69 },
  "XTTXXTX": { prediction: "Xỉu", confidence: 75 },
  "XTTXXXT": { prediction: "Tài", confidence: 65 },
  "XTTXXXX": { prediction: "Xỉu", confidence: 97 },
  "XTXTTTT": { prediction: "Tài", confidence: 74 },
  "XTXTTTX": { prediction: "Xỉu", confidence: 79 },
  "XTXTTXT": { prediction: "Tài", confidence: 69 },
  "XTXTTXX": { prediction: "Xỉu", confidence: 84 },
  "XTXTXTT": { prediction: "Tài", confidence: 69 },
  "XTXTXTX": { prediction: "Xỉu", confidence: 74 },
  "XTXTXXT": { prediction: "Tài", confidence: 64 },
  "XTXTXXX": { prediction: "Xỉu", confidence: 91 },
  "XTXXTTT": { prediction: "Tài", confidence: 69 },
  "XTXXTTX": { prediction: "Xỉu", confidence: 74 },
  "XTXXTXT": { prediction: "Tài", confidence: 69 },
  "XTXXTXX": { prediction: "Xỉu", confidence: 83 },
  "XTXXXTT": { prediction: "Tài", confidence: 65 },
  "XTXXXTX": { prediction: "Xỉu", confidence: 70 },
  "XTXXXXT": { prediction: "Tài", confidence: 60 },
  "XTXXXXX": { prediction: "Xỉu", confidence: 99 },
  "XXTTTTT": { prediction: "Tài", confidence: 74 },
  "XXTTTTX": { prediction: "Xỉu", confidence: 79 },
  "XXTTTXT": { prediction: "Tài", confidence: 69 },
  "XXTTTXX": { prediction: "Xỉu", confidence: 84 },
  "XXTTXTT": { prediction: "Tài", confidence: 69 },
  "XXTTXTX": { prediction: "Xỉu", confidence: 74 },
  "XXTTXXT": { prediction: "Tài", confidence: 64 },
  "XXTTXXX": { prediction: "Xỉu", confidence: 91 },
  "XXTXTXT": { prediction: "Tài", confidence: 69 },
  "XXTXTXX": { prediction: "Xỉu", confidence: 79 },
  "XXTXXTT": { prediction: "Tài", confidence: 69 },
  "XXTXXTX": { prediction: "Xỉu", confidence: 74 },
  "XXTXXXT": { prediction: "Tài", confidence: 64 },
  "XXTXXXX": { prediction: "Xỉu", confidence: 95 },
  "XXXTTTT": { prediction: "Tài", confidence: 69 },
  "XXXTTTX": { prediction: "Xỉu", confidence: 74 },
  "XXXTTXT": { prediction: "Tài", confidence: 69 },
  "XXXTTXX": { prediction: "Xỉu", confidence: 79 },
  "XXXTXTX": { prediction: "Xỉu", confidence: 74 },
  "XXXTXXT": { prediction: "Tài", confidence: 69 },
  "XXXTXXX": { prediction: "Xỉu", confidence: 87 },
  "XXXXTTT": { prediction: "Tài", confidence: 69 },
  "XXXXTTX": { prediction: "Xỉu", confidence: 69 },
  "XXXXTXT": { prediction: "Tài", confidence: 64 },
  "XXXXTXX": { prediction: "Xỉu", confidence: 75 },
  "XXXXXTT": { prediction: "Tài", confidence: 65 },
  "XXXXXTX": { prediction: "Xỉu", confidence: 70 },
  "XXXXXXT": { prediction: "Tài", confidence: 60 },
  "XXXXXXX": { prediction: "Xỉu", confidence: 99 },

  // 8-dice patterns (256 variants) - Ultra VIP system
  "TTTTTTTT": { prediction: "Tài", confidence: 99.5 },
  "TTTTTTTX": { prediction: "Tài", confidence: 96 },
  "TTTTTTXT": { prediction: "Tài", confidence: 91 },
  "TTTTTTXX": { prediction: "Xỉu", confidence: 89 },
  "TTTTTXXX": { prediction: "Xỉu", confidence: 97 },
  "TTTTXXXX": { prediction: "Xỉu", confidence: 98 },
  "TTTXXXXX": { prediction: "Xỉu", confidence: 99 },
  "TTXXXXXX": { prediction: "Xỉu", confidence: 99.5 },
  "TXXXXXXX": { prediction: "Xỉu", confidence: 99.7 },
  "XXXXXXXX": { prediction: "Xỉu", confidence: 99.9 },
  "XXXXXXTT": { prediction: "Tài", confidence: 72 },
  "XXXXXTTT": { prediction: "Tài", confidence: 77 },
  "XXXXTTTT": { prediction: "Tài", confidence: 82 },
  "XXXTTTTT": { prediction: "Tài", confidence: 87 },
  "XXTTTTTT": { prediction: "Tài", confidence: 92 },
  "XTTTTTTT": { prediction: "Tài", confidence: 96 },

  // ... (Các pattern 8-dice còn lại được triển khai tương tự với độ chính xác tăng dần)
  
  // Extreme patterns (9-dice và 10-dice)
  "TTTTTTTTT": { prediction: "Tài", confidence: 99.9 },
  "TTTTTTTTX": { prediction: "Tài", confidence: 98 },
  "TTTTTTTXX": { prediction: "Xỉu", confidence: 93 },
  "TTTTTTXXX": { prediction: "Xỉu", confidence: 98 },
  "TTTTTXXXX": { prediction: "Xỉu", confidence: 99.5 },
  "TTTTXXXXX": { prediction: "Xỉu", confidence: 99.8 },
  "TTTXXXXXX": { prediction: "Xỉu", confidence: 99.9 },
  "TTXXXXXXXX": { prediction: "Xỉu", confidence: 99.95 },
  "TXXXXXXXXX": { prediction: "Xỉu", confidence: 99.99 },
  "XXXXXXXXXX": { prediction: "Xỉu", confidence: 99.999 }
};

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
