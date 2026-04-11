export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  if (path.includes('type=recovery') || path.includes('access_token') && path.includes('type=recovery')) {
    console.log('[NativeIntent] Recovery link detected, routing to /reset-password');
    return '/reset-password';
  }
  return '/';
}