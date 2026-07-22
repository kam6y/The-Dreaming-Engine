export const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
] as const;

export function isAllowedOrigin(
  origin: string | undefined,
  allowedOrigins: readonly string[] = DEFAULT_ALLOWED_ORIGINS
): boolean {
  return origin !== undefined && allowedOrigins.includes(origin);
}
