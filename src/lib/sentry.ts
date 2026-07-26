import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const environment = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

if (!dsn) {
  throw new Error('Missing EXPO_PUBLIC_SENTRY_DSN — check the EAS environment variables for this build profile.');
}

export function initSentry() {
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
  });
}

export { Sentry };
