// Server-only activation. Preview stays opt-in; Production additionally needs
// an explicit release switch. Request/query parameters cannot activate it.
export function dialogueEnabled(env=process.env) {
  return env.AI_DIALOGUE_ENABLED==='true' && (env.VERCEL_ENV==='preview'
    || env.VERCEL_ENV==='production' && env.AI_DIALOGUE_RELEASE_ENABLED==='true');
}
export function dialogueReviewMode(env,experiment) {
  return env.VERCEL_ENV==='preview' && experiment==='single'?'inline':'separate';
}

// Editorial corrections are independent of the engine release switch, so an
// engine rollback can keep approved FAQ corrections in place.
export function editorialRevisionsEnabled(env=process.env) {
  return env.AI_DIALOGUE_ENABLED==='true' && ['preview','production'].includes(env.VERCEL_ENV);
}
