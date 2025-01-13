import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Session } from "./session.js";

console.log(Object.keys(process.env));

const sessions = new Map<string, Session>();

const app = new Hono();
app.use("/*", cors());

app.post("/offer", async (c) => {
  const { sdp, sessionId } = await c.req.json();
  console.log("Received offer for session", sessionId, sdp);

  const session = await Session.init(sessionId);
  sessions.set(sessionId, session);
  const answer = await session.handleOffer(sdp);
  console.log("Generated answer", answer);
  return c.text(answer);
});

serve({ fetch: app.fetch, port: 3000 });
console.log("Listening on port 3000");
