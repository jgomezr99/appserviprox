import React, { useEffect, useState } from 'react';
import { IonSpinner } from '@ionic/react';
import logo from '../Assets/logo.png';
import styles from './SplashScreen.module.css';

const SPLASH_DURATION_MS = 5000;
const FADE_DURATION_MS = 400;

export const SplashScreen: React.FC = () => {
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), SPLASH_DURATION_MS);
    const hideTimer = window.setTimeout(() => setVisible(false), SPLASH_DURATION_MS + FADE_DURATION_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className={`${styles.splash} ${fading ? styles.hidden : ''}`} role="status" aria-label="Cargando Serviprox">
      <img src={logo} alt="Serviprox" className={styles.logo} />
      <IonSpinner name="crescent" className={styles.spinner} />
    </div>
  );
};

export default SplashScreen;
