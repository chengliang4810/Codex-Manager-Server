import fs from "node:fs";
import http from "node:http";

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(rawValue, fallback) {
  const trimmed = trimString(rawValue) || fallback;
  let normalized = trimmed.replace(/^https?:\/\//i, "").split("/")[0].trim();
  if (!normalized) {
    normalized = fallback;
  }
  if (/^\d+$/.test(normalized)) {
    normalized = `127.0.0.1:${normalized}`;
  }
  const [host, port] = normalized.split(":");
  if (port && (host === "0.0.0.0" || host === "::" || host === "[::]")) {
    normalized = `127.0.0.1:${port}`;
  }
  return `http://${normalized}`;
}

function readRpcToken() {
  const envToken = trimString(process.env.CODEXMANAGER_RPC_TOKEN);
  if (envToken) {
    return envToken;
  }

  const tokenFile = trimString(process.env.CODEXMANAGER_RPC_TOKEN_FILE);
  if (!tokenFile) {
    return "";
  }

  try {
    return fs.readFileSync(tokenFile, "utf8").trim();
  } catch {
    return "";
  }
}

const serviceBaseUrl = normalizeBaseUrl(
  process.env.CODEXMANAGER_SERVICE_ADDR,
  "127.0.0.1:48760",
);
const listenUrl = new URL(
  normalizeBaseUrl(process.env.CODEXMANAGER_DEV_RPC_PROXY_ADDR, "127.0.0.1:48762"),
);

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "missing request url" }));
    return;
  }

  const requestUrl = new URL(request.url, listenUrl);
  if (requestUrl.pathname === "/__dev/rpc-proxy/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        ok: true,
        serviceBaseUrl,
        listen: listenUrl.toString(),
      }),
    );
    return;
  }

  if (requestUrl.pathname !== "/api/rpc" || request.method !== "POST") {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }

  const rpcToken = readRpcToken();
  if (!rpcToken) {
    response.writeHead(503, { "content-type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        error:
          "missing CODEXMANAGER_RPC_TOKEN or CODEXMANAGER_RPC_TOKEN_FILE for dev rpc proxy",
      }),
    );
    return;
  }

  const bodyChunks = [];
  for await (const chunk of request) {
    bodyChunks.push(chunk);
  }
  const body = Buffer.concat(bodyChunks);

  const upstreamHeaders = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (!value) {
      continue;
    }
    const lowerName = name.toLowerCase();
    if (
      lowerName === "host" ||
      lowerName === "content-length" ||
      lowerName === "connection" ||
      lowerName === "transfer-encoding"
    ) {
      continue;
    }
    upstreamHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  upstreamHeaders.set("x-codexmanager-rpc-token", rpcToken);
  upstreamHeaders.set("content-type", "application/json");

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(`${serviceBaseUrl}/rpc`, {
      method: "POST",
      headers: upstreamHeaders,
      body,
    });
  } catch (error) {
    response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        serviceBaseUrl,
      }),
    );
    return;
  }

  const responseHeaders = {};
  upstreamResponse.headers.forEach((value, name) => {
    const lowerName = name.toLowerCase();
    if (
      lowerName === "content-length" ||
      lowerName === "connection" ||
      lowerName === "transfer-encoding"
    ) {
      return;
    }
    responseHeaders[name] = value;
  });

  response.writeHead(upstreamResponse.status, responseHeaders);
  const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
  response.end(responseBody);
});

server.listen(Number(listenUrl.port), listenUrl.hostname, () => {
  console.log(
    `[dev-rpc-proxy] listening on ${listenUrl.origin} -> ${serviceBaseUrl}/rpc`,
  );
});
