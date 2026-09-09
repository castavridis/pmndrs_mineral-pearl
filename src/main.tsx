import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AppShell } from './app/AppShell';
import { Home } from './app/Home';
import { DevIndex } from './app/DevIndex';
import { SplatPage } from './app/SplatPage';
import { CalloutPage } from './app/CalloutPage';
import { EngulfPage } from './app/EngulfPage';
import { BentoPage } from './app/BentoPage';

// Path routing without a router: every route is served the same index.html
// by the Vercel rewrite and picks its page here.
const path = window.location.pathname;
const page = path.startsWith('/dev/splat') ? (
  <SplatPage />
) : path.startsWith('/dev/callout') ? (
  <CalloutPage />
) : path.startsWith('/dev/engulf') ? (
  <EngulfPage />
) : path.startsWith('/dev/bento') ? (
  <BentoPage />
) : /^\/dev\/?$/.test(path) ? (
  <DevIndex />
) : (
  <Home />
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell>{page}</AppShell>
  </StrictMode>
);
