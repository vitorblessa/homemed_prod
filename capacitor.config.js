// Capacitor config for HomeMed Android app
// Android loads the deployed web app; native shell only provides camera/notif permissions.

const SERVER_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.homemed.tech'

// Note: the Google Web Client ID used to live here as GoogleAuth's
// serverClientId. With @capgo/capacitor-social-login it's passed to
// SocialLogin.initialize() from app/page.js at runtime instead (see the
// comment there), so it can change on the live site without a new native
// build.

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
