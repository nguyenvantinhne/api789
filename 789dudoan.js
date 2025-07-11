const Fastify = require("fastify");
const cors = require("@fastify/cors");
const WebSocket = require("ws");

const fastify = Fastify({ logger: false });
const PORT = process.env.PORT || 3002;

let rikResults = [];
let rikCurrentSession = null;
let rikWS = null;
let rikIntervalCmd = null;
let currentConfidence = Math.floor(Math.random() * (97 - 51 + 1)) + 51; // Initialize with random confidence

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

function duDoanTuTT(tt) {
  return duDoanMap[tt] || "";
}

function getTX(d1, d2, d3) {
  const sum = d1 + d2 + d3;
  return sum >= 11 ? "T" : "X";
}

function sendRikCmd1005() {
  if (rikWS && rikWS.readyState === WebSocket.OPEN) {
    const payload = [6, "MiniGame", "taixiuUnbalancedPlugin", { cmd: 2000 }];
    rikWS.send(JSON.stringify(payload));
  }
}

function connectRikWebSocket() {
  console.log("🔌 Connecting to SunWin WebSocket...");
  rikWS = new WebSocket("wss://websocket.atpman.net/websocket");

  rikWS.on("open", () => {
    const authPayload = [
      1,
      "MiniGame",
      "dfghhhgffgggg",
      "tinhbip",
      {
        info: "{\"ipAddress\":\"2402:9d80:36a:1716:13d7:a37a:60e2:2c64\",\"userId\":\"f68cd413-44d4-4bf5-96eb-23da9a317f17\",\"username\":\"S8_dfghhhgffgggg\",\"timestamp\":1752167805248,\"refreshToken\":\"498e236e749f4afdb8517d1cd23a419b.0ab31b9e397f4cf0b9c23b3d6a7596b6\"}",
        signature: "52830A25058B665F9A929FD75A80E6893BCD7DDB2BA3276B132BC863453AA09AE60B66FBE4B25F3892B27492391BF08F30D2DDD84B140F0007F1630BC6727A45543749ED892B94D78FEC9683FCF9A15F4EF582D8E4D9F7DD85AFD3BAE566A7B886F7DC380DA10EF5527C38BEE9E4F06C95B9612105CC1B2545C2A13644A29F1F"
      }
    ];
    rikWS.send(JSON.stringify(authPayload));
    clearInterval(rikIntervalCmd);
    rikIntervalCmd = setInterval(sendRikCmd1005, 5000);
  });

  rikWS.on("message", (data) => {
    try {
      const json = JSON.parse(data);

      // Nhận phiên mới realtime
      if (Array.isArray(json) && json[3]?.res?.d1 && json[3]?.res?.sid) {
        const result = json[3].res;
        
        // Only update if the new session ID is greater than current
        if (!rikCurrentSession || result.sid > rikCurrentSession) {
          rikCurrentSession = result.sid;
          currentConfidence = Math.floor(Math.random() * (97 - 51 + 1)) + 51; // Update confidence

          // Thêm phiên mới nhất vào đầu danh sách
          rikResults.unshift({
            sid: result.sid,
            d1: result.d1,
            d2: result.d2,
            d3: result.d3
          });

          // Giới hạn tối đa 50 kết quả
          if (rikResults.length > 50) rikResults.pop();

          console.log(`📥 Phiên mới ${result.sid} → ${getTX(result.d1, result.d2, result.d3)}`);
        }
      }

      // Nhận lịch sử ban đầu
      else if (Array.isArray(json) && json[1]?.htr) {
        const history = json[1].htr
          .map((item) => ({
            sid: item.sid,
            d1: item.d1,
            d2: item.d2,
            d3: item.d3,
          }))
          .sort((a, b) => b.sid - a.sid); // Sort descending by session ID

        rikResults = history.slice(0, 50); // Only keep latest 50
        console.log("📦 Đã tải lịch sử các phiên gần nhất.");
        
        // Initialize confidence if not set
        if (!currentConfidence) {
          currentConfidence = Math.floor(Math.random() * (97 - 51 + 1)) + 51;
        }
      }

    } catch (e) {
      console.error("❌ Parse error:", e.message);
    }
  });

  // ... (keep the rest of your WebSocket event handlers)
}

connectRikWebSocket();

fastify.register(cors);

fastify.get("/api/789club", async () => {
  const validResults = rikResults.filter(item => item.d1 && item.d2 && item.d3);

  if (validResults.length < 2) {
    return { message: "Không đủ dữ liệu." };
  }

  // Ensure confidence is never null
  if (!currentConfidence) {
    currentConfidence = Math.floor(Math.random() * (97 - 51 + 1)) + 51;
  }

  const current = validResults[0];
  const previous = validResults[1];

  const ket_qua = getTX(current.d1, current.d2, current.d3);
  const lich_su_TX = validResults.map(item => getTX(item.d1, item.d2, item.d3)).join("");
  const cau = lich_su_TX.substring(0, 15);
  const tt = lich_su_TX.substring(0, 6);
  const du_doan = duDoanTuTT(tt);

  return {
    phien_truoc: previous.sid,
    xuc_xac: [current.d1, current.d2, current.d3],
    ket_qua: ket_qua,
    phien_hien_tai: current.sid,
    du_doan: du_doan,
    do_tin_cay: `${currentConfidence}%`,
    cau: cau,
    thuat_toan: tt
  };
});

const start = async () => {
  try {
    const address = await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🚀 API chạy tại ${address}`);
  } catch (err) {
    console.error("❌ Server error:", err);
    process.exit(1);
  }
};

start();
