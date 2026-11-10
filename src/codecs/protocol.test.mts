import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { httpDate, parseHttpDate, parseContentType, serializeContentType } from "./http/index.mjs";
import { parseCookieHeader, serializeCookieHeader } from "./cookie/index.mjs";
import { parseSseStream, sseCommentFrame, sseEventFrame } from "./sse/index.mjs";
import { acceptKey, encodeFrame, FrameDecoder } from "./ws/index.mjs";

// RFC 9110 section 5.6.7 supplies all three representations of this instant.
test("HTTP dates retain the standard instant and emit IMF-fixdate", () => {
  const timestamp = Date.UTC(1994, 10, 6, 8, 49, 37);
  for (const date of [
    "Sun, 06 Nov 1994 08:49:37 GMT",
    "Sunday, 06-Nov-94 08:49:37 GMT",
    "Sun Nov  6 08:49:37 1994",
  ]) assert.equal(parseHttpDate(date)?.getTime(), timestamp);
  assert.equal(httpDate(timestamp), "Sun, 06 Nov 1994 08:49:37 GMT");
  assert.equal(parseHttpDate("not a date"), null);
});

test("obsolete HTTP asctime remains GMT under a non-UTC host timezone", () => {
  const module = new URL("./http/date.mjs", import.meta.url).href;
  const program = "import { parseHttpDate } from " + JSON.stringify(module) +
    "; console.log(parseHttpDate('Sun Nov  6 08:49:37 1994')?.toISOString());";
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", program], {
    env: { ...process.env, TZ: "Pacific/Honolulu" }, encoding: "utf8",
  });
  assert.equal(output.trim(), "1994-11-06T08:49:37.000Z");
});

test("media type normalization preserves quoted parameters", () => {
  const parsed = parseContentType('Text/HTML; Charset="utf-8"; boundary="one; two"');
  assert.deepEqual(parsed, { type: "text/html", params: { charset: "utf-8", boundary: "one; two" } });
  assert.ok(parsed);
  assert.deepEqual(parseContentType(serializeContentType(parsed)), parsed);
  assert.equal(parseContentType(undefined), null);
});

test("valid protocol names remain data when they match JavaScript prototype properties", () => {
  const cookies = parseCookieHeader("__proto__=first; constructor=second; session=third; session=fourth");
  assert.equal(Object.getPrototypeOf(cookies), Object.prototype);
  assert.equal(Object.hasOwn(cookies, "__proto__"), true);
  assert.equal(cookies["__proto__"], "first");
  assert.equal(cookies["constructor"], "second");
  assert.equal(cookies["session"], "third");
  const contentType = parseContentType("text/plain; __proto__=value; constructor=other");
  assert.ok(contentType);
  assert.equal(Object.hasOwn(contentType.params, "__proto__"), true);
  assert.equal(contentType.params["__proto__"], "value");
});

test("cookie round trips preserve values and refuse invalid field names", () => {
  const values = { session: "a b", language: "en", opaque: "a=b" };
  assert.deepEqual(parseCookieHeader(serializeCookieHeader(values)), values);
  assert.deepEqual(parseCookieHeader("broken; a=%xx; a=ignored"), { a: "%xx" });
  assert.throws(() => serializeCookieHeader({ "invalid name": "value" }), TypeError);
});

// RFC 6455 sections 1.3 and 5.7 supply the independent key and masked Hello vectors.
test("WebSocket handshake and fragmented wire input match the standard vectors", () => {
  assert.equal(acceptKey("dGhlIHNhbXBsZSBub25jZQ=="), "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
  const wire = Buffer.from("818537fa213d7f9f4d5158", "hex");
  const decoder = new FrameDecoder();
  const frames = [];
  for (const byte of wire) frames.push(...decoder.push(Buffer.from([byte])));
  assert.equal(frames.length, 1);
  assert.deepEqual(frames[0], { fin: true, opcode: 1, payload: Buffer.from("Hello"), masked: true });
  assert.equal(encodeFrame(1, Buffer.from("Hello")).toString("hex"), "810548656c6c6f");
});

test("WebSocket payload limits hold for extended length declarations", () => {
  for (const header of ["827e0010", "827f0000000000000010"]) {
    const frames = new FrameDecoder({ maxPayload: 8 }).push(Buffer.from(header, "hex"));
    assert.equal(frames.length, 1);
    assert.equal(frames[0]?.tooLarge, true);
    assert.equal(frames[0]?.payload.length, 0);
  }
});

test("SSE frames round trip multiline data while comments are ignored", () => {
  const record = { event: "update", id: "7", retry: 1000, data: "first\nsecond" };
  assert.deepEqual(parseSseStream(sseCommentFrame("keepalive") + sseEventFrame(record)), [record]);
  for (const newline of ["\n", "\r", "\r\n"]) {
    assert.deepEqual(parseSseStream(`data: first${newline}data: second${newline}${newline}`),
      [{ data: "first\nsecond" }]);
  }
});

// WHATWG HTML section 9.2.6 requires a data field and a complete blank-line delimiter.
test("SSE drops data-free and incomplete records", () => {
  for (const text of ["event: update\n\n", "id: 7\n\n", "retry: 1000\n\n", "data: unfinished", "data: unfinished\n"]) {
    assert.deepEqual(parseSseStream(text), []);
  }
  assert.deepEqual(parseSseStream("data: complete\n\ndata: unfinished"), [{ data: "complete" }]);
  assert.deepEqual(parseSseStream("data:\n\n"), [{ data: "" }]);
});
