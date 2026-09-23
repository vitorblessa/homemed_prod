// Capacitor config for HomeMed Android app
// Android loads the deployed web app; native shell only provides camera/notif permissions.

const SERVER_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://homemed-prod-uqag.vercel.app'

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
  },
}

module.exports = config
