const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const app = require("../app");
const authorize = require("../authorization-middleware");
const config = require("../config");

// Silence middleware logging during tests
let originalLog;
before(() => {
  originalLog = console.log;
  console.log = () => {};
});
after(() => {
  console.log = originalLog;
});

const sign = (payload, secret = config.JWT_SECRET, options) =>
  jwt.sign(payload, secret, options);

const buildApp = credentials => {
  const testApp = express();
  testApp.get("/protected", authorize(credentials), (req, res) => {
    res.send("ok");
  });
  return testApp;
};

describe("GET /token", () => {
  it("returns a JWT signed with the configured secret", async () => {
    const res = await request(app).get("/token");
    assert.strictEqual(res.status, 200);

    const decoded = jwt.verify(res.text, config.JWT_SECRET);
    assert.strictEqual(decoded.name, "Jimmy");
    assert.strictEqual(decoded.scopes, "customer:read");
    assert.strictEqual(typeof decoded.iat, "number");
  });
});

describe("GET /customer", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app).get("/customer");
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.text, "Sorry pal: access denied");
  });

  it("returns 200 with a token issued by /token", async () => {
    const tokenRes = await request(app).get("/token");
    const res = await request(app)
      .get("/customer")
      .set("Authorization", `Bearer ${tokenRes.text}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.text, "Customer Information");
  });

  it("returns 401 with a token lacking the required scope", async () => {
    const token = sign({ name: "Jimmy", scopes: "orders:read" });
    const res = await request(app)
      .get("/customer")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.text, "Error: Access Denied");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/does-not-exist");
    assert.strictEqual(res.status, 404);
  });
});

describe("authorization middleware", () => {
  it("rejects a token signed with the wrong secret", async () => {
    const token = sign({ scopes: "customer:read" }, "wrong secret");
    const res = await request(buildApp("customer:read"))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.text, "Error: Access Denied");
  });

  it("rejects a malformed token", async () => {
    const res = await request(buildApp("customer:read"))
      .get("/protected")
      .set("Authorization", "Bearer not.a.jwt");
    assert.strictEqual(res.status, 401);
  });

  it("rejects an expired token", async () => {
    const token = sign(
      { scopes: "customer:read", exp: Math.floor(Date.now() / 1000) - 60 }
    );
    const res = await request(buildApp("customer:read"))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.status, 401);
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const encode = obj =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");
    const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      scopes: "customer:read"
    })}.`;
    const res = await request(buildApp("customer:read"))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.status, 401);
  });

  it("rejects a token with no scopes when scopes are required", async () => {
    const token = sign({ name: "Jimmy" });
    const res = await request(buildApp("customer:read"))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.status, 401);
  });

  it("accepts a string credential matching an array of scopes", async () => {
    const token = sign({ scopes: ["orders:read", "customer:read"] });
    const res = await request(buildApp("customer:read"))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.text, "ok");
  });

  it("accepts when any of an array of credentials matches", async () => {
    const token = sign({ scopes: "customer:write" });
    const res = await request(buildApp(["customer:read", "customer:write"]))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.status, 200);
  });

  it("rejects when none of an array of credentials matches", async () => {
    const token = sign({ scopes: ["orders:read"] });
    const res = await request(buildApp(["customer:read", "customer:write"]))
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.status, 401);
  });

  it("allows any valid token when no credentials are required", async () => {
    const token = sign({ name: "Jimmy" });
    const res = await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);
    assert.strictEqual(res.status, 200);
  });

  it("still requires a token when no credentials are required", async () => {
    const res = await request(buildApp()).get("/protected");
    assert.strictEqual(res.status, 401);
  });
});
