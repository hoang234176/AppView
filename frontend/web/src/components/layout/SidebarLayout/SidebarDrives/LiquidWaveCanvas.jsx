import { useEffect, useRef, memo } from 'react';

const TIER_COLORS = {
  normal: {
    active: {
      b: [29, 78, 216, 0.48],
      m: [59, 130, 246, 0.32],
      t: [96, 165, 250, 0.22],
      crest: [147, 197, 253, 0.90],
      bgWaveAlpha: 0.14,
      bgWaveRgb: '96, 165, 250',
    },
    inactive: {
      b: [45, 55, 72, 0.28],
      m: [55, 65, 81, 0.18],
      t: [75, 85, 99, 0.10],
      crest: [148, 163, 184, 0.35],
    },
  },
  warning: {
    active: {
      b: [217, 119, 6, 0.50],
      m: [245, 158, 11, 0.35],
      t: [251, 191, 36, 0.24],
      crest: [253, 230, 138, 0.95],
      bgWaveAlpha: 0.16,
      bgWaveRgb: '245, 158, 11',
    },
    inactive: {
      b: [120, 53, 15, 0.35],
      m: [146, 64, 14, 0.22],
      t: [180, 83, 9, 0.12],
      crest: [245, 158, 11, 0.45],
    },
  },
  danger: {
    active: {
      b: [220, 38, 38, 0.52],
      m: [239, 68, 68, 0.36],
      t: [248, 113, 113, 0.24],
      crest: [254, 202, 202, 0.95],
      bgWaveAlpha: 0.18,
      bgWaveRgb: '239, 68, 68',
    },
    inactive: {
      b: [127, 29, 29, 0.35],
      m: [153, 27, 27, 0.22],
      t: [185, 28, 28, 0.12],
      crest: [239, 68, 68, 0.45],
    },
  },
};

/**
 * Liquid Wave Canvas Component
 * Renders a single unified liquid body with animated sine/cosine waves and smooth
 * color & amplitude transitions across tiers (normal, warning, danger).
 */
export const LiquidWaveCanvas = memo(({ percent, isActive, tier = 'normal' }) => {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    animValue: 0,
    activeProgress: isActive ? 1 : 0,
    currentPercent: 0, // Starts at 0 so liquid wave visibly rises from the bottom
    targetActive: isActive ? 1 : 0,
    targetPercent: percent,
    targetTier: tier,
  });

  // Keep target values up to date
  useEffect(() => {
    stateRef.current.targetActive = isActive ? 1 : 0;
    stateRef.current.targetPercent = percent;
    stateRef.current.targetTier = tier;
  }, [isActive, percent, tier]);

  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const render = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const state = stateRef.current;
      // Smoothly interpolate active state (0: inactive -> 1: active)
      state.activeProgress += (state.targetActive - state.activeProgress) * Math.min(dt * 7, 1);
      // Smoothly interpolate percent level (rising from 0 up to targetPercent)
      state.currentPercent += (state.targetPercent - state.currentPercent) * Math.min(dt * 3.2, 1);

      // Advance wave phase smoothly
      const speed = 0.26 + state.activeProgress * 0.12;
      state.animValue = (state.animValue + dt * speed) % 1;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const expectedW = Math.round(width * dpr);
      const expectedH = Math.round(height * dpr);
      if (canvas.width !== expectedW || canvas.height !== expectedH) {
        canvas.width = expectedW;
        canvas.height = expectedH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const p = Math.max(0, Math.min(100, state.currentPercent));
      if (p > 0) {
        const waterHeight = height * (p / 100);
        const baseWaterY = height - waterHeight;
        const act = state.activeProgress;

        // Wave amplitude scales gently at low percentages so waves never touch the bottom
        const maxAmp = Math.min(3.6, Math.max(0.5, waterHeight * 0.45));
        const primaryAmp = Math.min(maxAmp, (0.8 + act * 2.6) * Math.min(1, p / 12));
        const secondaryAmp = primaryAmp * 0.72;

        const currentTier = state.targetTier || 'normal';
        const colors = TIER_COLORS[currentTier] || TIER_COLORS.normal;
        const cAct = colors.active;
        const cInact = colors.inactive;

        // 1. Background Ripple Wave
        if (act > 0.02) {
          ctx.beginPath();
          ctx.moveTo(0, height);
          ctx.lineTo(0, baseWaterY);
          for (let x = 0; x <= width; x += 4) {
            const y = baseWaterY + Math.cos((x / width * 2 * Math.PI) - (state.animValue * 2 * Math.PI)) * secondaryAmp;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fillStyle = `rgba(${cAct.bgWaveRgb}, ${cAct.bgWaveAlpha * act})`;
          ctx.fill();
        }

        // 2. Primary Unified Wave
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, baseWaterY);
        for (let x = 0; x <= width; x += 3) {
          const y = baseWaterY + Math.sin((x / width * 2 * Math.PI) + (state.animValue * 2 * Math.PI)) * primaryAmp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();

        // Linear gradient from bottom of button up to the wave surface
        const grad = ctx.createLinearGradient(0, height, 0, Math.max(0, baseWaterY - primaryAmp));

        // Seamless color interpolation between Inactive and Active state for the tier
        const r1 = Math.round(cInact.b[0] + act * (cAct.b[0] - cInact.b[0]));
        const g1 = Math.round(cInact.b[1] + act * (cAct.b[1] - cInact.b[1]));
        const b1 = Math.round(cInact.b[2] + act * (cAct.b[2] - cInact.b[2]));
        const a1 = cInact.b[3] + act * (cAct.b[3] - cInact.b[3]);

        const r2 = Math.round(cInact.m[0] + act * (cAct.m[0] - cInact.m[0]));
        const g2 = Math.round(cInact.m[1] + act * (cAct.m[1] - cInact.m[1]));
        const b2 = Math.round(cInact.m[2] + act * (cAct.m[2] - cInact.m[2]));
        const a2 = cInact.m[3] + act * (cAct.m[3] - cInact.m[3]);

        const r3 = Math.round(cInact.t[0] + act * (cAct.t[0] - cInact.t[0]));
        const g3 = Math.round(cInact.t[1] + act * (cAct.t[1] - cInact.t[1]));
        const b3 = Math.round(cInact.t[2] + act * (cAct.t[2] - cInact.t[2]));
        const a3 = cInact.t[3] + act * (cAct.t[3] - cInact.t[3]);

        grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${a1})`);
        grad.addColorStop(0.5, `rgba(${r2}, ${g2}, ${b2}, ${a2})`);
        grad.addColorStop(1, `rgba(${r3}, ${g3}, ${b3}, ${a3})`);

        ctx.fillStyle = grad;
        ctx.fill();

        // 3. Water surface crest highlight line
        ctx.beginPath();
        const startY = baseWaterY + Math.sin(state.animValue * 2 * Math.PI) * primaryAmp;
        ctx.moveTo(0, startY);
        for (let x = 0; x <= width; x += 3) {
          const y = baseWaterY + Math.sin((x / width * 2 * Math.PI) + (state.animValue * 2 * Math.PI)) * primaryAmp;
          ctx.lineTo(x, y);
        }

        const lineR = Math.round(cInact.crest[0] + act * (cAct.crest[0] - cInact.crest[0]));
        const lineG = Math.round(cInact.crest[1] + act * (cAct.crest[1] - cInact.crest[1]));
        const lineB = Math.round(cInact.crest[2] + act * (cAct.crest[2] - cInact.crest[2]));
        const lineA = cInact.crest[3] + act * (cAct.crest[3] - cInact.crest[3]);

        ctx.strokeStyle = `rgba(${lineR}, ${lineG}, ${lineB}, ${lineA})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
});

LiquidWaveCanvas.displayName = 'LiquidWaveCanvas';
