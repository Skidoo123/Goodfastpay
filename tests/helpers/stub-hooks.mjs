// Module customization hooks: redirect api/_lib/supabaseAdmin.js to an
// in-memory stub so unit tests never touch the network or a real key.
export async function resolve(specifier, context, next) {
  if (
    specifier === './supabaseAdmin.js' &&
    (context.parentURL?.endsWith('api/_lib/ledger.js') ||
     context.parentURL?.endsWith('api/_lib/auth.js'))
  ) {
    return {
      url: new URL('./stub-supabaseAdmin.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return next(specifier, context);
}
