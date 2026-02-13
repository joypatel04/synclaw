import assert from "node:assert/strict";
import test from "node:test";
import { mapGatewayEventToIngestInput } from "./mapper.js";

test("maps streaming delta event", () => {
  const out = mapGatewayEventToIngestInput(
    {
      type: "chat.delta",
      sessionKey: "jarvis",
      runId: "run_1",
      messageId: "msg_1",
      delta: "Hello",
      status: "sending",
      role: "assistant",
    },
    "evt_fallback",
  );

  assert.ok(out);
  assert.equal(out?.sessionKey, "jarvis");
  assert.equal(out?.message?.externalMessageId, "msg_1");
  assert.equal(out?.message?.append, true);
  assert.equal(out?.message?.state, "sending");
});

test("returns null when session key missing", () => {
  const out = mapGatewayEventToIngestInput({ type: "chat.delta" }, "evt_x");
  assert.equal(out, null);
});
