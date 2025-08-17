/**
 * Catching non-localized requests
 *
 * This page renders when a route like `/unknown.txt` is requested.
 * In this case, the layout at `app/[locale]/layout.tsx` receives
 * an invalid value as the `[locale]` param and calls `notFound()`.
 *
 * https://next-intl.dev/docs/environments/error-files#catching-non-localized-requests
 */
export default function GlobalNotFound() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '4rem', margin: '0' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', margin: '1rem 0' }}>Page Not Found</h2>
      <p style={{ fontSize: '1rem', color: '#666' }}>
        The page you are looking for does not exist.
      </p>
    </div>
  );
}
