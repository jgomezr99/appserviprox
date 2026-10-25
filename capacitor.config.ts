import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ionic.serviprox',
  appName: 'serviprox',
  webDir: 'dist',
  server: {
    cleartext: process.env.CAPACITOR_ALLOW_CLEARTEXT === "true",
  },
};

export default config;
