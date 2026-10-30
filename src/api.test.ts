import { describe, expect, test } from "vitest";

import { failureMessage } from "./api.ts";
import { statusLabel } from "./constants.ts";

describe("failureMessage", () => {
  test("the backend's message wins", () => {
    expect(failureMessage(409, { error: "在庫が足りません" }, "Conflict")).toBe("在庫が足りません");
    expect(failureMessage(503, { error: "決済サービスにつながりません" }, "Service Unavailable"))
      .toBe("決済サービスにつながりません");
  });

  test("429 and 503 without a message get a friendly one", () => {
    expect(failureMessage(429, {}, "Too Many Requests")).toContain("しばらく待って");
    expect(failureMessage(503, {}, "Service Unavailable")).toContain("一時的に利用できません");
    expect(failureMessage(503, { error: "" }, "")).toContain("一時的に利用できません");
  });

  test("other statuses fall back to the status text or the code", () => {
    expect(failureMessage(418, {}, "I'm a teapot")).toBe("I'm a teapot");
    expect(failureMessage(418, {}, "")).toBe("エラーになりました（HTTP 418）");
  });
});

describe("statusLabel", () => {
  test("known statuses have Japanese labels, unknown ones are shown as is", () => {
    expect(statusLabel("pending")).toBe("支払い確認中");
    expect(statusLabel("paid")).toBe("支払済み");
    expect(statusLabel("shipped")).toBe("発送済み");
    expect(statusLabel("cancelled")).toBe("取り消し");
    expect(statusLabel("refunded")).toBe("refunded");
    expect(statusLabel("toString")).toBe("toString");
  });
});
