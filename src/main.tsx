import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/tokens.css';
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
// The bento is the site's front page for now; the old home stays reachable at
// /dev/home. The bento shows a theme switch among its own elements, so the
// shell leaves its fixed one out wherever the bento is.
const ownToggle = path.startsWith('/dev/bento') || !path.startsWith('/dev');
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
) : path.startsWith('/dev/home') ? (
  <Home />
) : /^\/dev\/?$/.test(path) ? (
  <DevIndex />
) : (
  <BentoPage />
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell toggle={!ownToggle}>{page}</AppShell>
  </StrictMode>
);
