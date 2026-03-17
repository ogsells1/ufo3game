"use strict";
const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  let store;
  try {
    store = getStore("czp3");
  } catch(e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Store init failed: " + e.message }) };
  }

  const empty = { scores: [], visits: 0 };

  async function read() {
    try {
      const raw = await store.get("data");
      return raw ? JSON.parse(raw) : empty;
    } catch(e) { return empty; }
  }

  async function write(data) {
    await store.set("data", JSON.stringify(data));
  }

  if (event.httpMethod === "GET") {
    const data = await read();
    return { statusCode: 200, headers: cors, body: JSON.stringify(data) };
  }

  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch(e) { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON" }) }; }

    const data = await read();

    if (body.action === "visit") {
      data.visits = (data.visits || 0) + 1;
      await write(data);
      return { statusCode: 200, headers: cors, body: JSON.stringify({ visits: data.visits }) };
    }

    if (body.action === "score") {
      const { name, score } = body;
      if (!name || typeof score !== "number") {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "name and score required" }) };
      }
      const list = data.scores || [];
      const idx = list.findIndex(s => s.name === name);
      if (idx >= 0) {
        if (score > list[idx].score) list[idx].score = score;
      } else {
        list.push({ name, score });
      }
      list.sort((a, b) => b.score - a.score);
      data.scores = list.slice(0, 50);
      await write(data);
      return { statusCode: 200, headers: cors, body: JSON.stringify(data) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "unknown action" }) };
  }

  return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "method not allowed" }) };
};
