// In-memory stub for api/_lib/supabaseAdmin.js (unit tests only).
// rpc() returns a canned result the test controls. Any other surface
// (.from, .auth, …) throws loudly — no silent DB access, ever.

export const rpcCalls = [];
let nextResult = { data: { id: 1, balance_after: '100.00' }, error: null };

export function __setResult(result) {
  nextResult = result;
}

export function __reset() {
  rpcCalls.length = 0;
  nextResult = { data: { id: 1, balance_after: '100.00' }, error: null };
}

function unexpected(prop) {
  return () => {
    throw new Error(`stubbed supabaseAdmin.${prop} — no DB in unit tests`);
  };
}

export function supabaseAdmin() {
  return {
    rpc: async (fn, params) => {
      rpcCalls.push({ fn, params });
      return nextResult;
    },
    from: unexpected('from'),
    auth: unexpected('auth'),
  };
}
