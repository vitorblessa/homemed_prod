// Capacitor config for HomeMed Android app
// Android loads the deployed web app; native shell only provides camera/notif permissions.

const SERVER_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.homemed.tech'

// Web OAuth Client ID (not a secret — it's a public identifier). Used as
// GoogleAuth's serverClientId so the ID token returned to the native app is
// issued for OUR backend (same GOOGLE_CLIENT_ID it already verifies), even
// though sign-in itself happens through a separate "Android" OAuth client
// (package name + release keystore SHA-1) registered in Google Cloud Console.
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID || '225884335654-q7j0bih6j8sa02bnm4jdmi3cdid4qo91.apps.googleusercontent.com'

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.blessahome.homemed',
  appName: 'HomeMed',
  webDir: 'out',
  server: {
    // Load the live PWA. This keeps auth, cookies and API base URL working exactly like the web.
    url: SERVER_URL,
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#2563EB',
      showSpinner: false,
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: GOOGLE_WEB_CLIENT_ID,
      forceCodeForRefreshToken: false,
    },
    // Android 15+ (targetSdkVersion 36) draws the app edge-to-edge by
    // default, so without this the content renders behind the status bar
    // and the navigation bar. This plugin reports the real inset sizes as
    // CSS variables (see app/globals.css), which we also use to paint the
    // system bars white/dark-content to match the app's light theme.
    SafeArea: {
      enabled: true,
      customColorsForSystemBars: true,
      // AARRGGBB format (alpha first) — see note in app/page.js.
      statusBarColor: '#FF2563EB',
      statusBarContent: 'light',
      navigationBarColor: '#FF000000',
      navigationBarContent: 'light',
    },
  },
}

module.exports = config
