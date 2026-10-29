import '@fontsource/ibm-plex-sans-thai-looped/400.css';
import '@fontsource/ibm-plex-sans-thai-looped/500.css';
import '@fontsource/ibm-plex-sans-thai-looped/600.css';
import './styles/tokens.css';
import './styles/layout.css';
import { startApp } from './app';

startApp(document.querySelector<HTMLDivElement>('#app')!);
