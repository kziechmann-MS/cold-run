import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { personas } from "./personas.js";
import { createRunService } from "./run-service.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(root, "..", "public");
const runsDirectory = path.join(root, "..", "runs");
const runColdTest = createRunService({ runsDirectory });

export function createServer({ runService = runColdTest } = {}) {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/api/personas") {
        return json(response, 200, personas);
      }
      if (request.method === "POST" && request.url === "/api/runs") {
        const body = await readJson(request);
        return json(response, 201, await runService(body));
      }
      if (request.method === "GET" && request.url.startsWith("/runs/")) {
        return await serveFile(response, safePath(runsDirectory, request.url.slice("/runs/".length)));
      }
      if (request.method === "GET") {
        const requestPath = request.url === "/" ? "index.html" : request.url.slice(1);
        return await serveFile(response, safePath(publicDirectory, requestPath));
      }
      return json(response, 404, { error: "Not found." });
    } catch (error) {
      const notFound = error.code === "ENOENT";
      const status = error.code === "PAYLOAD_TOO_LARGE" ? 413 : notFound ? 404 : 400;
      return json(response, status, {
        error: notFound ? "Not found." : error.message || "The request could not be completed.",
      });
    }
  });
}

function safePath(base, relative) {
  const decoded = decodeURIComponent(relative.split("?")[0]);
  const resolved = path.resolve(base, decoded);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) throw new Error("Invalid path.");
  return resolved;
}

async function serveFile(response, filePath) {
  const details = await stat(filePath);
  if (!details.isFile()) {
    const error = new Error("Not found.");
    error.code = "ENOENT";
    throw error;
  }
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".png": "image/png",
    ".webm": "video/webm",
  };
  response.writeHead(200, {
    "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    "x-content-type-options": "nosniff",
  });
  response.end(await readFile(filePath));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 20_000) {
      const error = new Error("Request body is too large.");
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`Cold Run is ready at http://localhost:${port}`));
}
