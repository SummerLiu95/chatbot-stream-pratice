// server.ts
import express from "express";
import { v4 as uuidv4 } from "uuid";
import cors from "cors";

// 模拟一个“图片模型生成”函数（异步延时后返回 URL）
function simulateImageGeneration(prompt: string, width = 512, height = 512): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        url: `https://via.placeholder.com/${width}x${height}?text=${encodeURIComponent(prompt)}`,
        width,
        height,
      });
    }, 3000); // 假设图片生成需要 3 秒
  });
}

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/chat-stream", async (req, res) => {
  const { prompt } = req.body as { prompt: string };
  const sessionId = uuidv4();

  // 设置头：chunked 传输、内容类型 text/plain 或 application/x-ndjson
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  // HTTP/1.1 下会自动使用 Transfer-Encoding: chunked
  // 如果你用 HTTP/2 则 chunked 不适用，但多数浏览器/环境兼容 HTTP/1.1
  res.write(""); // 先发送部分响应头，确保浏览器开始接收

  // 简化：模拟文字分片生成
  let seq = 0;
  function sendChunk(obj: any) {
    seq += 1;
    const line = JSON.stringify({
      sessionId,
      sequence: seq,
      ...obj,
    });
    res.write(line + "\n");
  }

  try {
    // 文字生成开始
    sendChunk({ type: "text", content: "你好，欢迎使用。" , metadata: {}});
    await new Promise((r) => setTimeout(r, 500));
    sendChunk({ type: "text", content: "我正在为你生成图片提示，占位即将出现…" , metadata: {}});
    await new Promise((r) => setTimeout(r, 500));

    // 图片占位
    const placeholderId = "img-0";
    sendChunk({ type: "image_hint", content: null, metadata: { placeholderId, hint: "图片正在生成…" } });

    // 同时启动图片生成任务（异步）
    const imagePromise = simulateImageGeneration(prompt, 512, 512);

    // 继续文字
    await new Promise((r) => setTimeout(r, 500));
    sendChunk({ type: "text", content: "文字继续生成中…再稍等一下。" , metadata: {} });

    // 等待图片生成完成
    const imageResult = await imagePromise;
    sendChunk({ type: "image_ready", content: { placeholderId, url: imageResult.url }, metadata: { width: imageResult.width, height: imageResult.height } });

    // 最终完成
    sendChunk({ type: "done", content: null, metadata: { durationMs: 3500 } });
  } catch (err) {
    sendChunk({ type: "error", content: { message: (err as Error).message, code: "SERVER_ERROR" }, metadata: {} });
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Chat-stream API listening on port ${PORT}`);
});
