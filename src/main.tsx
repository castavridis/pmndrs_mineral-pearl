import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AppShell } from './app/AppShell';
import { Home } from './app/Home';
import { Demo } from './app/Demo';
import { DevGallery } from './app/DevGallery';
import { DevIndex } from './app/DevIndex';
import { SplatPage } from './app/SplatPage';
import { CalloutPage } from './app/CalloutPage';
import { AnnouncementPage } from './app/AnnouncementPage';
import { PalettePage } from './app/PalettePage';
import { EngulfPage } from './app/EngulfPage';
import { BentoPage } from './app/BentoPage';

// Path routing without a router: every route is served the same index.html
// by the Vercel rewrite and picks its page here.
const path = window.location.pathname;
const page = path.startsWith('/dev/demo') ? (
  <Demo />
) : path.startsWith('/dev/nav') ? (
  <DevGallery />
) : path.startsWith('/dev/splat') ? (
  <SplatPage />
) : path.startsWith('/dev/callout') ? (
  <CalloutPage />
) : path.startsWith('/dev/announcement') ? (
  <AnnouncementPage />
) : path.startsWith('/dev/palette') ? (
  <PalettePage />
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
