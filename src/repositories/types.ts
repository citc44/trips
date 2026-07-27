/** Shared across every repository module -- extracted once a second repository
 * (voyage-repository.ts) needed it, rather than duplicating profile-repository.ts's
 * definition a second time (the exact class of mistake Story 1.5's code review
 * caught and fixed for a different duplicated type). */
export type RepositoryError = { code: string; message: string };
