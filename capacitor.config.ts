import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ionic.serviprox',
  appName: 'serviprox',
  webDir: 'dist',
  server: {
    cleartext: true,
  },
};

export default config;
