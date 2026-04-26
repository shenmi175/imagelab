import "dotenv/config";
import crypto from "node:crypto";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "@/lib/env";
import { getImageQueue } from "@/lib/queue";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function basicAuth(request: Request, response: Response, next: NextFunction) {
  if (!env.queueBoardPassword) {
    response.status(503).send("QUEUE_BOARD_PASSWORD is not configured.");
    return;
  }

  const header = request.headers.authorization;
  const [, encoded] = header?.match(/^Basic (.+)$/i) ?? [];
  const decoded = encoded ? Buffer.from(encoded, "base64").toString("utf8") : "";
  const separator = decoded.indexOf(":");
  const username = separator >= 0 ? decoded.slice(0, separator) : "";
  const password = separator >= 0 ? decoded.slice(separator + 1) : "";

  if (safeEqual(username, env.queueBoardUsername) && safeEqual(password, env.queueBoardPassword)) {
    next();
    return;
  }

  response.setHeader("WWW-Authenticate", 'Basic realm="Image Queue Board"');
  response.status(401).send("Authentication required.");
}

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(env.queueBoardBasePath);

createBullBoard({
  queues: [new BullMQAdapter(getImageQueue())],
  serverAdapter
});

const app = express();
app.get("/health", (_request, response) => response.json({ ok: true }));
app.use(env.queueBoardBasePath, basicAuth, serverAdapter.getRouter());

app.listen(env.queueBoardPort, () => {
  console.log(`Bull Board listening on http://0.0.0.0:${env.queueBoardPort}${env.queueBoardBasePath}`);
});
