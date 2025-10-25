import axios from "axios";
import { config } from "dotenv";
import { withPaymentInterceptor, decodeXPaymentResponse, createSigner, type Hex } from "x402-axios";
import * as readline from "readline";
config();

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

// ---------- 主函数 ----------
async function main(
  baseURL: string,
  endpointPath: string,
  privateKey: Hex | string,
  chain: string
): Promise<void> {
  const signer = await createSigner(chain, privateKey);

  const api = withPaymentInterceptor(
    axios.create({
      baseURL,
    }),
    signer
  );

  const response = await api.get(endpointPath);
  console.log("✅ response.data:", response.data);

  try {
    const paymentResponse = decodeXPaymentResponse(
      response.headers["x-payment-response"]
    );
    console.log("💰 paymentResponse:", paymentResponse);
  } catch {
    console.log("⚠️ 没有检测到 x-payment-response 或解析失败。");
  }
}

// ---------- 并发循环执行（不等待响应） ----------
let totalCount = 0;
let successCount = 0;

function runMainConcurrently(
  baseURL: string,
  endpointPath: string,
  privateKey: Hex | string,
  intervalMs: number,
  chain: string
): void {
  console.log(`🚀 开始并发执行，每 ${intervalMs}ms 触发一次 (Ctrl+C 退出)`);

  createSigner(chain, privateKey).then((signer) => {
    const api = withPaymentInterceptor(
      axios.create({ baseURL }),
      signer
    );

    setInterval(() => {
      totalCount++;
      console.log(`[${totalCount}] 触发请求`);

      api
        .get(endpointPath)
        .then((response) => {
          successCount++;
          console.log(`✅ [${totalCount}] 成功 (${successCount}/${totalCount})`);
        })
        .catch((err) => {
          console.error(`❌ [${totalCount}] 失败 (${successCount}/${totalCount})`);
          console.error("错误:", err.message);
        });
    }, intervalMs);
  });
}

// ---------- 菜单循环 ----------
async function init() {
  const privateKey = await ask("请输入 privateKey钱包私钥（16进制字符串）：");
  const baseURL = await ask("请输入 baseURL（例如：https://api.ping.observer）：");
  const endpointPath = await ask("请输入 endpointPath（例如：/mint-v2）：");
  const chain = await ask("请输入 链路 base 或者 solana：");

  console.log("\n✅ 输入完成：");
  console.log("privateKey:", privateKey);
  console.log("baseURL:", baseURL);
  console.log("endpointPath:", endpointPath);
  console.log("chain:", chain);

  while (true) {
    const mode = await ask(
      "\n请选择执行模式：\n1. 执行一次 main()\n2. 每1秒并发触发（不等待响应）\n3. 退出程序\n请输入选项（1 / 2 / 3）："
    );

    if (mode === "1") {
      await main(baseURL, endpointPath, privateKey, chain);
      console.log("\n✅ 执行完毕，返回主菜单。");
    } else if (mode === "2") {
      runMainConcurrently(baseURL, endpointPath, privateKey, 1000, chain); //1000等于1秒 2000等于2秒 mint一次
      break;
    } else if (mode === "3") {
      console.log("👋 程序已退出。");
      process.exit(0);
    } else {
      console.log("❌ 无效输入，请重新选择。");
    }
  }
}

init().catch(console.error);
