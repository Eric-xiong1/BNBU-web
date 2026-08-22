import assert from "node:assert/strict";
import test from "node:test";

import {
  COURSE_JOIN_QR_ORIGIN,
  createAndroidInviteQrPayload,
  normalizeInviteCode,
} from "../app/course-invite.ts";

test("teacher QR payload uses the canonical Student Web HTTPS origin and preserves an opaque token", () => {
  const token = "InviteAbC_0123456789.secret-XyZ~";
  const payload = createAndroidInviteQrPayload(`  ${token}  `);

  assert.equal(normalizeInviteCode(token), token);
  assert.equal(
    payload,
    `${COURSE_JOIN_QR_ORIGIN}/join/${encodeURIComponent(token)}`,
  );
  assert.equal(new URL(payload).origin, "https://www.verityai.cn");
  assert.doesNotMatch(payload, /sports\.example\.com/);
});
