import { createServer } from "node:http";

/**
 * Minimal fake Telegram Bot API server for tests.
 * Each item of `setResponses(list)` is answered in order; the last repeats.
 * Records every request as { url, headers, json?, rawBody }.
 */
export function startServer() {
  const requests = [];
  let responses = [{ status: 200, body: { ok: true, result: { message_id: 1 } } }];
  let index = 0;

  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks);
      let json;
      try {
        json = JSON.parse(rawBody.toString("utf8"));
      } catch {
        json = undefined;
      }
      requests.push({ url: req.url, headers: req.headers, json, rawBody });

      const r = responses[Math.min(index++, responses.length - 1)];
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.body));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}`,
        requests,
        setResponses(list) {
          responses = list;
          index = 0;
        },
        close() {
          return new Promise((done) => server.close(done));
        },
      });
    });
  });
}
