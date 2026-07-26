import * as Sentry from '@sentry/react-native';

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const environment = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

  if (!dsn) {
    console.error('Missing EXPO_PUBLIC_SENTRY_DSN — check the EAS environment variables for this build profile. Sentry will not be initialized.');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
  });
}

export { Sentry };
