// /scripts/doc-email-freeze-test.mjs
// =============================================================================
// EMPIRICAL REGRESSION TEST — "crew email stopped working" (boss, 2026-10-19)
// =============================================================================
// Root cause: the /doc crew-email block was fire-and-forget nodemailer. After
// the task102 critical-writes-first reorder it sits at the very end of the
// flow with ZERO awaits after it — on Vercel the lambda freezes the moment
// the handler returns, and the SMTP upload (TLS + AUTH + DATA + docx
// attachment, seconds of round-trips to mail.ru) never completes. The DOCX
// still reached Telegram (sent earlier), the email copy silently vanished.
//
// This harness runs a RAW-TCP SMTP sink that answers with a simulated
// cross-continent latency (250ms per reply — Vercel → mail.ru), then runs two
// child scenarios against it:
//
//   old  — exactly the pre-fix behaviour: sendMail() fire-and-forget, the
//          "invocation" ends (process.exit) right after. The email must NOT
//          be delivered  → reproduces the bug.
//   new  — the post-fix behaviour: waitUntil() hands the send promise to the
//          (simulated) Vercel request-context bridge, which keeps the
//          "invocation" alive until the send settles. The email WITH the docx
//          attachment must be delivered → proves the fix.
//
// No external deps: the sink is a hand-rolled minimal SMTP server (EHLO with
// AUTH PLAIN advertised, no PIPELINING/STARTTLS — one round-trip per command,
// each delayed, so the lane is deterministically slow).
//
// Run:  node scripts/doc-email-freeze-test.mjs
// =============================================================================

import { spawn } from "node:child_process";
import net from "node:net";
import nodemailer from "nodemailer";
import { fileURLToPath } from "node:url";
import path from "node:path";

const STEP_DELAY_MS = 250;            // simulated per-reply SMTP latency
const OLD_FREEZE_AFTER_MS = 300;      // old flow: invocation ends almost immediately
const NEW_GRACE_MS = 2000;            // new flow: bounded grace await (in-prod parity)
const SINK_PORTS = { old: 12525, new: 12526 };

const isChild = process.argv[2] === "--child";
const childScenario = isChild ? process.argv[3] : null;

// ── Minimal SMTP sink (parent only) ──────────────────────────────────────────
function startSmtpSink(port) {
  const received = [];
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    let buf = "";
    let inData = false;
    let current = null;
    const later = (fn) => setTimeout(fn, STEP_DELAY_MS);
    // SMTP contract: the server greets FIRST, immediately on connect.
    try { socket.write("220 sink ESMTP ready\r\n"); } catch {}
    socket.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let idx;
      while ((idx = buf.indexOf("\r\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            received.push(current);
            current = null;
            later(() => socket.write("250 2.0.0 OK: queued as SINK123\r\n"));
          } else {
            // undo SMTP dot-stuffing for fidelity
            current += (line.startsWith("..") ? line.slice(1) : line) + "\n";
          }
          continue;
        }
        const cmd = line.toUpperCase();
        if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) {
          later(() => socket.write(
            "250-sink greets you\r\n250-SIZE 52428800\r\n250-AUTH PLAIN LOGIN\r\n250 SMTPUTF8\r\n"
          ));
        } else if (cmd.startsWith("AUTH")) {
          later(() => socket.write("235 2.7.0 Authentication successful\r\n"));
        } else if (cmd.startsWith("MAIL FROM")) {
          later(() => socket.write("250 2.1.0 Sender OK\r\n"));
        } else if (cmd.startsWith("RCPT TO")) {
          later(() => socket.write("250 2.1.5 Recipient OK\r\n"));
        } else if (cmd.startsWith("DATA")) {
          inData = true;
          current = "";
          later(() => socket.write("354 Start mail input; end with <CRLF>.<CRLF>\r\n"));
        } else if (cmd.startsWith("QUIT")) {
          later(() => { try { socket.write("221 2.0.0 Bye\r\n"); socket.end(); } catch {} });
        } else {
          later(() => socket.write("250 2.0.0 OK\r\n"));
        }
      }
    });
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
  });
  server.listen(port, "127.0.0.1");
  return {
    received,
    close: () => {
      for (const s of sockets) { try { s.destroy(); } catch {} }
      server.close();
    },
  };
}

// ── Shared send payload (mirrors the /doc email block) ───────────────────────
function buildTransporter(port) {
  return nodemailer.createTransport({
    host: "127.0.0.1",
    port,
    secure: false,
    auth: { user: "vip_bike@mail.ru", pass: "sink-accepts-anything" },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    tls: { rejectUnauthorized: false },
  });
}

const MAIL = {
  from: "vip_bike@mail.ru",
  to: "vip_bike@mail.ru",
  subject: "Договор аренды — TEST falcon_gt",
  text: "Договор аренды №2026/10-test\n\nДоговор сгенерирован в Telegram-боте.\nДокумент во вложении.",
  attachments: [{
    filename: "2026/10/test-contract.docx",
    content: Buffer.from("PK\x03\x04 fake-docx-bytes-for-sink-test ".repeat(400)),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }],
};

// ── Child scenarios ──────────────────────────────────────────────────────────
async function runChild(scenario) {
  const port = SINK_PORTS[scenario];
  const transporter = buildTransporter(port);

  if (scenario === "old") {
    // Pre-fix behaviour: pure fire-and-forget; the "invocation" ends right
    // after the handler's last statement — Vercel freezes the lambda.
    transporter.sendMail(MAIL)
      .then(() => console.log("[old] SENT (unexpectedly fast lane)"))
      .catch((e) => console.log("[old] SEND_ERR", e?.message || e));
    setTimeout(() => process.exit(0), OLD_FREEZE_AFTER_MS);
    return;
  }

  if (scenario === "new") {
    // Post-fix behaviour: simulate the Vercel request-context bridge, then
    // exactly what the patched /doc block does — waitUntil + bounded grace.
    const held = [];
    globalThis[Symbol.for("@vercel/request-context")] = {
      get: () => ({ waitUntil: (p) => held.push(p) }),
    };
    const { waitUntil } = await import("@vercel/functions");
    const emailDelivery = transporter.sendMail(MAIL)
      .then(() => console.log("[new] SENT"))
      .catch((e) => console.log("[new] SEND_ERR", e?.message || e));
    waitUntil(emailDelivery);
    await Promise.race([
      emailDelivery,
      new Promise((resolve) => setTimeout(resolve, NEW_GRACE_MS)),
    ]);
    console.log(`[new] grace done, bridge holds ${held.length} promise(s)`);
    // Platform contract: the invocation stays alive until waitUntil promises
    // settle — even when they outlive the grace window.
    await Promise.allSettled(held);
    process.exit(0);
  }
}

// ── Parent runner ────────────────────────────────────────────────────────────
async function runParent() {
  const self = fileURLToPath(import.meta.url);
  const sinks = {
    old: startSmtpSink(SINK_PORTS.old),
    new: startSmtpSink(SINK_PORTS.new),
  };
  const runChildAsync = (scenario) => new Promise((resolve) => {
    const child = spawn(process.execPath, [self, "--child", scenario], { stdio: "inherit" });
    child.on("exit", resolve);
  });
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));

  console.log("═".repeat(72));
  console.log("SCENARIO OLD — fire-and-forget + immediate invocation end (pre-fix)");
  await runChildAsync("old");
  await settle(4000); // give any accidental delivery plenty of time to land
  const oldCount = sinks.old.received.length;
  console.log(`  emails delivered: ${oldCount} (expected 0 — freeze swallows the send)`);
  const oldPass = oldCount === 0;

  console.log("═".repeat(72));
  console.log("SCENARIO NEW — waitUntil keeps the invocation alive (post-fix)");
  await runChildAsync("new");
  await settle(1500);
  const newMsgs = sinks.new.received;
  console.log(`  emails delivered: ${newMsgs.length} (expected 1)`);
  const m = newMsgs[0] || "";
  const hasAttachment = m.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    && m.includes("docx");
  const hasRecipient = m.includes("vip_bike@mail.ru");
  // The Cyrillic body is MIME-encoded (quoted-printable/base64) on the wire —
  // assert the multipart structure instead of the raw string.
  const hasBody = m.includes("multipart/mixed") && m.includes("text/plain");
  console.log(`  docx attachment present: ${hasAttachment}; recipient ok: ${hasRecipient}; body ok: ${hasBody}`);
  const newPass = newMsgs.length === 1 && hasAttachment && hasRecipient && hasBody;

  sinks.old.close();
  sinks.new.close();

  console.log("═".repeat(72));
  console.log(`RESULT: old(${oldPass ? "REPRODUCED ✓" : "✗"}) new(${newPass ? "DELIVERED ✓" : "✗"})`);
  process.exit(oldPass && newPass ? 0 : 1);
}

if (isChild) {
  await runChild(childScenario);
} else {
  await runParent();
}
