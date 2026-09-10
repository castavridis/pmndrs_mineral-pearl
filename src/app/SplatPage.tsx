import { Leva, button, useControls } from 'leva';
import { BLOT_SCALE, InkSplat, page, useResolvedTheme } from '../components';
import { replay, useSplatPage } from './splatStore';
import { useThemeTweak } from './tweaks';

/** `/dev/splat`: the full-viewport splat with every knob exposed. */
export function SplatPage() {
  useThemeTweak();
  const setSplat = useSplatPage((s) => s.setSplat);
  const setSettled = useSplatPage((s) => s.setSettled);
  const settled = useSplatPage((s) => s.settled);
  const theme = useResolvedTheme();

  const {
    logo,
    scale,
    interactive,
    inkOverride,
    ink,
    mark,
    originX,
    originY,
    nacre,
  } = useControls(
    'ink splat',
    {
      logo: true,
      scale: { value: BLOT_SCALE, min: 0.5, max: 4, step: 0.05 },
      nacre: { value: 0, min: 0, max: 1, step: 0.05, label: 'nacre surface' },
      interactive: { value: true, label: 'click to splat' },
      inkOverride: { value: false, label: 'custom colours' },
      ink: { value: page.light.ink, render: (get) => get('ink splat.inkOverride') },
      mark: { value: page.light.bg, render: (get) => get('ink splat.inkOverride') },
      originX: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'origin x' },
      originY: { value: 0.5, min: 0, max: 1, step: 0.01, label: 'origin y' },
      splat: button(replay),
    }
  );

  return (
    <>
      <main className="stage">
        <InkSplat
          ref={setSplat}
          className="splat"
          theme={theme}
          ink={inkOverride ? ink : undefined}
          mark={inkOverride ? mark : undefined}
          logo={logo}
          scale={scale}
          nacre={nacre}
          origin={[originX, originY]}
          interactive={interactive}
          onSettle={() => setSettled(true)}
        />
        <p className="hint" hidden={settled}>
          click anywhere
        </p>
      </main>
      <Leva collapsed titleBar={{ title: 'pmndrs' }} />
    </>
  );
}
