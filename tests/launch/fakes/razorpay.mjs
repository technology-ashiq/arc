// In-memory Razorpay orders API (test mode). Basic auth must be the fixture key id and secret; orders filter by receipt
// the way the real list does; amounts are paise. It replaces only the transport; other hosts go to `inner`.
//   orders   seed orders [{ id, receipt, amount, currency, notes }]
export function makeRazorpay({ inner, keyId = "rzp_test_Fixture0123456", keySecret = "fixtureSecret0123456789ab", orders = [] } = {}) {
  const store = orders.map((o) => ({ entity: "order", amount: 100, currency: "INR", status: "created", notes: {}, ...o }));
  const calls = [];
  let n = 0;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const err = (status, description) => json(status, { error: { code: "BAD_REQUEST_ERROR", description } });
  const want = `Basic ${Buffer.from(`${keyId}:${keySecret}`, "utf8").toString("base64")}`;

  async function fetch(input, init = {}) {
    const url = new URL(String(input));
    if (url.hostname !== "api.razorpay.com") return inner ? inner(input, init) : err(404, "fake razorpay: no inner transport");
    const method = String(init.method || "GET").toUpperCase();
    calls.push(`${method} ${url.pathname}`);
    if ((init.headers || {}).authorization !== want) return err(401, "The api key provided is invalid");
    const body = init.body ? JSON.parse(init.body) : null;
    const p = url.pathname;
    if (method === "GET" && p === "/v1/orders") {
      const receipt = url.searchParams.get("receipt");
      const items = store.filter((o) => receipt === null || o.receipt === receipt);
      return json(200, { entity: "collection", count: items.length, items });
    }
    if (method === "POST" && p === "/v1/orders") {
      if (!Number.isInteger(body.amount) || body.amount < 100) return err(400, "The amount must be atleast INR 1.00");
      if (typeof body.receipt === "string" && body.receipt.length > 40) return err(400, "receipt: The receipt may not be greater than 40 characters.");
      const o = { id: `order_Fx${String(++n).padStart(12, "0")}`, entity: "order", amount: body.amount, currency: body.currency, receipt: body.receipt, status: "created", notes: body.notes || {} };
      store.push(o);
      return json(200, o);
    }
    const m = p.match(/^\/v1\/orders\/([^/]+)$/);
    if (m && method === "GET") {
      const o = store.find((x) => x.id === decodeURIComponent(m[1]));
      return o ? json(200, o) : err(400, "The id provided does not exist");
    }
    return err(404, `fake razorpay: ${method} ${p} not modelled`);
  }
  return { fetch, store, calls };
}
