<script>
  import { onMount } from 'svelte';

  export let images = [];
  export let alt = '';
  export let variant = 'arc';

  const isVideo = (url) => typeof url === 'string' && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
  const labels = ['Harbor light', 'Low cloud', 'Way through', 'Canopy hour', 'Open hills'];
  const variantNames = {
    arc: 'Interactive Carousel',
    coverflow: 'CoverFlow Carousel',
    stack: 'Time Machine Stack'
  };

  const defaultsFor = (kind) => {
    if (kind === 'coverflow') return { duration: 660, spread: 118, depth: 120, tilt: 34 };
    if (kind === 'stack') return { duration: 740, lift: 14, depth: 62, tilt: 2.2 };
    return { duration: 660, spread: 164, curve: 14, tilt: 7 };
  };

  const defaults = defaultsFor(variant);
  let duration = defaults.duration;
  let spread = defaults.spread ?? 0;
  let curve = defaults.curve ?? 0;
  let depth = defaults.depth ?? 0;
  let lift = defaults.lift ?? 0;
  let tilt = defaults.tilt ?? 0;

  let stageEl;
  let stageW = 1100;
  let stageH = 620;
  let selectedIndex = 0;
  let visualIndex = 0;
  let motionDirection = 1;
  let animating = false;
  let reduced = false;
  let raf = 0;
  let pointer = null;
  let dragging = false;
  let suppressClick = false;

  $: pics = (Array.isArray(images) ? images : []).filter((url) => url && !isVideo(url));
  $: count = pics.length;
  $: current = count ? wrap(selectedIndex, count) : 0;
  $: currentLabel = labels[current] ?? `${alt} image ${current + 1}`;
  // Pass every geometry/motion input through the reactive expression. Svelte
  // does not trace dependencies read only inside styleFor(), so omitting this
  // state envelope would update the caption while leaving transforms frozen.
  $: cardStyles = buildCardStyles(pics, {
    stageW,
    stageH,
    visualIndex,
    motionDirection,
    animating,
    duration,
    spread,
    curve,
    depth,
    lift,
    tilt,
    variant,
    count
  });

  function buildCardStyles(list, _state) {
    return list.map((_, index) => styleFor(index));
  }

  function wrap(value, length = count) {
    if (!length) return 0;
    return ((value % length) + length) % length;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function circularOffset(index, position) {
    if (!count) return 0;
    let offset = wrap(index - position, count);
    if (offset > count / 2) offset -= count;
    return offset;
  }

  function positiveDepth(index, position) {
    return wrap(index - position, count);
  }

  function edgeVisibility(offset) {
    return clamp((2.35 - Math.abs(offset)) / 0.35, 0, 1);
  }

  function styleFor(index) {
    const fit = clamp(stageW / 980, 0.58, 1.08);

    if (variant === 'stack') {
      const signed = circularOffset(index, visualIndex);
      const planeDepth = positiveDepth(index, visualIndex);
      const cardW = Math.round(330 * fit);
      const cardH = Math.round(198 * fit);
      const box = `width:${cardW}px;height:${cardH}px;margin-left:${-cardW / 2}px;margin-top:${-cardH / 2}px;`;

      if (animating && motionDirection > 0 && signed < 0 && signed >= -1.01) {
        const progress = clamp(-signed, 0, 1);
        return `${box}transform:translate3d(0, ${(-92 * progress).toFixed(2)}px, ${(140 * progress).toFixed(2)}px) rotateX(${(-5 * progress).toFixed(2)}deg) scale(${(1 + progress * 0.05).toFixed(3)});opacity:${(1 - progress).toFixed(3)};z-index:140;`;
      }

      if (animating && motionDirection < 0 && signed < 0 && signed >= -1.01) {
        const progress = clamp(signed + 1, 0, 1);
        return `${box}transform:translate3d(0, ${((1 - progress) * 86).toFixed(2)}px, ${((1 - progress) * 120).toFixed(2)}px) rotateX(${((1 - progress) * 4).toFixed(2)}deg) scale(${(0.95 + progress * 0.05).toFixed(3)});opacity:${progress.toFixed(3)};z-index:140;`;
      }

      const visible = clamp((4.4 - planeDepth) / 0.8, 0, 1);
      const opacity = clamp(1 - planeDepth * 0.16, 0.26, 1) * visible;
      return `${box}transform:translate3d(0, ${(-planeDepth * lift * fit).toFixed(2)}px, ${(-planeDepth * depth * fit).toFixed(2)}px) rotateX(${(planeDepth * tilt).toFixed(2)}deg) scale(${(1 - planeDepth * 0.018).toFixed(3)});opacity:${opacity.toFixed(3)};z-index:${Math.round(120 - planeDepth * 12)};filter:saturate(${clamp(1 - planeDepth * 0.11, 0.45, 1).toFixed(3)});`;
    }

    const offset = circularOffset(index, visualIndex);
    const distance = Math.abs(offset);
    const center = clamp(1 - distance, 0, 1);
    const edge = edgeVisibility(offset);

    if (variant === 'coverflow') {
      const cardW = Math.round(164 * fit);
      const cardH = Math.round(220 * fit);
      return `width:${cardW}px;height:${cardH}px;margin-left:${-cardW / 2}px;margin-top:${-cardH / 2}px;transform:translate3d(${(offset * spread * fit).toFixed(2)}px, ${(distance * 14 * fit).toFixed(2)}px, ${(-distance * depth * fit + center * 80 * fit).toFixed(2)}px) rotateY(${(-offset * tilt).toFixed(2)}deg) scale(${(0.84 + center * 0.3).toFixed(3)});opacity:${((0.54 + center * 0.46) * edge).toFixed(3)};z-index:${Math.round(120 - distance * 12)};`;
    }

    const size = Math.round(170 * fit);
    return `width:${size}px;height:${size}px;margin-left:${-size / 2}px;margin-top:${-size / 2}px;transform:translate3d(${(offset * spread * fit).toFixed(2)}px, ${(distance * curve * fit).toFixed(2)}px, 0) rotate(${(offset * tilt).toFixed(2)}deg) scale(${(0.8 + center * 0.3).toFixed(3)});opacity:${((0.75 + center * 0.25) * edge).toFixed(3)};z-index:${Math.round(120 - distance * 12)};`;
  }

  function easeInOutQuint(progress) {
    return progress < 0.5 ? 16 * progress ** 5 : 1 - ((-2 * progress + 2) ** 5) / 2;
  }

  function animateTo(rawTarget) {
    cancelAnimationFrame(raf);
    const start = visualIndex;
    const delta = rawTarget - start;
    selectedIndex = wrap(Math.round(rawTarget));
    motionDirection = Math.sign(delta) || motionDirection;

    if (reduced || Math.abs(delta) < 0.001) {
      visualIndex = rawTarget;
      animating = false;
      return;
    }

    animating = true;
    const started = performance.now();
    const tick = (now) => {
      const progress = clamp((now - started) / duration, 0, 1);
      visualIndex = start + delta * easeInOutQuint(progress);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        visualIndex = rawTarget;
        animating = false;
      }
    };
    raf = requestAnimationFrame(tick);
  }

  function step(direction) {
    animateTo(Math.round(visualIndex) + direction);
  }

  function select(index) {
    const here = wrap(Math.round(visualIndex));
    let delta = index - here;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    animateTo(Math.round(visualIndex) + delta);
  }

  function onPointerDown(event) {
    if (event.target?.closest?.('.spatial-nav, .tune-panel')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancelAnimationFrame(raf);
    animating = false;
    dragging = true;
    suppressClick = false;
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startVisual: visualIndex
    };
    stageEl?.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const deltaX = event.clientX - pointer.startX;
    if (Math.abs(deltaX) > 6) suppressClick = true;
    const dragUnit = variant === 'stack' ? 150 : Math.max(120, spread);
    visualIndex = pointer.startVisual - deltaX / dragUnit;
    motionDirection = deltaX < 0 ? 1 : -1;
  }

  function finishPointer(event, commit = true) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const deltaX = event.clientX - pointer.startX;
    let target = Math.round(visualIndex);
    if (commit && Math.abs(deltaX) > 36 && target === Math.round(pointer.startVisual)) {
      target += deltaX < 0 ? 1 : -1;
    }
    if (!commit) target = Math.round(pointer.startVisual);
    if (stageEl?.hasPointerCapture?.(event.pointerId)) stageEl.releasePointerCapture(event.pointerId);
    pointer = null;
    dragging = false;
    animateTo(target);
  }

  function onCardClick(index, event) {
    if (suppressClick) {
      event.preventDefault();
      suppressClick = false;
      return;
    }
    select(index);
  }

  function onKeydown(event) {
    if (event.target?.closest?.('.tune-panel')) return;
    const previous = event.key === 'ArrowLeft' || (variant === 'stack' && event.key === 'ArrowUp');
    const next = event.key === 'ArrowRight' || (variant === 'stack' && event.key === 'ArrowDown');
    if (!previous && !next) return;
    event.preventDefault();
    step(previous ? -1 : 1);
  }

  function resetTuning() {
    const reset = defaultsFor(variant);
    duration = reset.duration;
    spread = reset.spread ?? 0;
    curve = reset.curve ?? 0;
    depth = reset.depth ?? 0;
    lift = reset.lift ?? 0;
    tilt = reset.tilt ?? 0;
  }

  function onImageError(event) {
    event.currentTarget.closest('.spatial-card')?.classList.add('media-failed');
  }

  onMount(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => {
      reduced = media.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        visualIndex = Math.round(visualIndex);
        selectedIndex = wrap(Math.round(visualIndex));
        animating = false;
      }
    };
    syncMotion();
    media.addEventListener?.('change', syncMotion);

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        stageW = rect.width || stageW;
        stageH = rect.height || stageH;
      }
    });
    if (stageEl) observer.observe(stageEl);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      media.removeEventListener?.('change', syncMotion);
    };
  });
</script>

<div class="spatial-shell" data-spatial-variant={variant}>
  <!-- The composite carousel surface intentionally owns drag and Arrow-key
       interaction while its nested cards and controls remain native buttons. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={stageEl}
    class="spatial-stage"
    class:is-dragging={dragging}
    class:is-stack={variant === 'stack'}
    tabindex="0"
    role="group"
    aria-roledescription="carousel"
    aria-label={`${variantNames[variant]} — drag, swipe, use the buttons, or press arrow keys`}
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={(event) => finishPointer(event, true)}
    on:pointercancel={(event) => finishPointer(event, false)}
    on:keydown={onKeydown}
  >
    <div class="stage-heading">
      <span>{variantNames[variant]}</span>
      <strong aria-live="polite">{currentLabel}</strong>
    </div>

    <div class="spatial-scene" class:is-coverflow={variant === 'coverflow'}>
      {#each pics as src, index (src)}
        <button
          type="button"
          class="spatial-card"
          class:is-active={index === current}
          style={cardStyles[index]}
          tabindex={index === current ? 0 : -1}
          aria-label={`Select ${labels[index] ?? `${alt} image ${index + 1}`}`}
          aria-current={index === current ? 'true' : undefined}
          on:click={(event) => onCardClick(index, event)}
        >
          <img src={src} alt={labels[index] ?? `${alt} image ${index + 1}`} draggable="false" on:error={onImageError} />
        </button>
      {/each}
    </div>

    <div class="spatial-nav" aria-label={`${variantNames[variant]} controls`}>
      <button type="button" class="step-button" aria-label="Previous image" on:click={() => step(-1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
      </button>
      <div class:timeline={variant === 'stack'} class="progress" role="tablist" aria-label="Choose an image">
        {#each pics as src, index (src)}
          <button
            type="button"
            role="tab"
            aria-selected={index === current}
            tabindex={index === current ? 0 : -1}
            aria-label={`Show ${labels[index] ?? `image ${index + 1}`}`}
            on:click={() => select(index)}
          ><span class="sr-only">{labels[index] ?? `Image ${index + 1}`}</span></button>
        {/each}
      </div>
      <button type="button" class="step-button" aria-label="Next image" on:click={() => step(1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5.5 6.5 6.5-6.5 6.5" /></svg>
      </button>
    </div>

    <details class="tune-panel">
      <summary>Tune motion</summary>
      <div class="tune-body">
        <label><span>Duration</span><output>{duration} ms</output><input type="range" min="380" max="1300" step="20" bind:value={duration} /></label>
        {#if variant === 'arc'}
          <label><span>Spread</span><output>{spread} px</output><input type="range" min="110" max="210" step="2" bind:value={spread} /></label>
          <label><span>Curve</span><output>{curve} px</output><input type="range" min="0" max="30" step="1" bind:value={curve} /></label>
        {:else if variant === 'coverflow'}
          <label><span>Spread</span><output>{spread} px</output><input type="range" min="80" max="180" step="2" bind:value={spread} /></label>
          <label><span>Depth</span><output>{depth} px</output><input type="range" min="60" max="200" step="4" bind:value={depth} /></label>
        {:else}
          <label><span>Lift</span><output>{lift} px</output><input type="range" min="4" max="28" step="1" bind:value={lift} /></label>
          <label><span>Depth</span><output>{depth} px</output><input type="range" min="30" max="100" step="2" bind:value={depth} /></label>
        {/if}
        <label><span>Tilt</span><output>{tilt}°</output><input type="range" min="0" max={variant === 'coverflow' ? 55 : variant === 'arc' ? 18 : 6} step={variant === 'stack' ? 0.2 : 1} bind:value={tilt} /></label>
        <button type="button" class="reset-button" on:click={resetTuning}>Reset</button>
      </div>
    </details>

    <span class="drag-hint" aria-hidden="true">Drag to explore</span>
  </div>
</div>

<style>
  .spatial-shell { width: 100%; }
  .spatial-stage {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    min-height: 420px;
    overflow: hidden;
    border-radius: var(--radius-3xl);
    background: #0b0b0d;
    color: #f7f5ef;
    cursor: grab;
    touch-action: pan-y;
    user-select: none;
    isolation: isolate;
  }
  .spatial-stage.is-dragging { cursor: grabbing; }
  .spatial-stage:focus-visible { outline: 3px solid #6fa8ff; outline-offset: 3px; }
  .stage-heading {
    position: absolute;
    top: 22px;
    left: 24px;
    z-index: 30;
    display: grid;
    gap: 3px;
    pointer-events: none;
  }
  .stage-heading span,
  .drag-hint {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #aaa8a3;
  }
  .stage-heading strong {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.35;
    color: #f7f5ef;
  }
  .spatial-scene {
    position: absolute;
    inset: 70px 0 74px;
    perspective: 1000px;
    transform-style: preserve-3d;
  }
  .spatial-card {
    position: absolute;
    left: 50%;
    top: 50%;
    border: 0;
    padding: 0;
    overflow: hidden;
    border-radius: 16px;
    background: #151519;
    box-shadow: 0 22px 52px rgba(0, 0, 0, 0.54), 0 0 0 1px rgba(255, 255, 255, 0.12);
    transform-style: preserve-3d;
    transform-origin: center;
  }
  [data-spatial-variant='stack'] .spatial-card { border-radius: 22px; }
  .spatial-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: inherit;
    pointer-events: none;
  }
  .spatial-card img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    transform: scale(1.035);
    transition: transform 500ms cubic-bezier(.22, 1, .36, 1), filter 400ms ease;
  }
  .spatial-card.is-active img { transform: scale(1); filter: saturate(1.04); }
  :global(.spatial-card.media-failed) { visibility: hidden; }
  .spatial-card:focus-visible,
  .spatial-nav button:focus-visible,
  .tune-panel summary:focus-visible,
  .tune-panel input:focus-visible,
  .reset-button:focus-visible {
    outline: 3px solid #6fa8ff;
    outline-offset: 3px;
  }
  .spatial-nav {
    position: absolute;
    left: 50%;
    bottom: 16px;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    transform: translateX(-50%);
  }
  .step-button {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    color: #f7f5ef;
    cursor: pointer;
    transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
  }
  .step-button:hover { background: rgba(255, 255, 255, 0.13); border-color: rgba(255, 255, 255, 0.55); }
  .step-button:active { transform: scale(0.94); }
  .step-button svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
  .progress {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 3px;
  }
  .progress button {
    width: 28px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: pointer;
  }
  .progress button::before {
    content: '';
    width: 16px;
    height: 3px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.32);
    transition: width 180ms ease, background 180ms ease, transform 180ms ease;
  }
  .progress button:hover::before { transform: scaleY(1.7); background: rgba(255, 255, 255, 0.74); }
  .progress button[aria-selected='true']::before { width: 24px; background: #e3ad43; }
  .progress.timeline button::before { border-radius: 2px; }
  .tune-panel {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 50;
    width: 220px;
    max-width: calc(100% - 32px);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 14px;
    background: rgba(18, 18, 21, 0.9);
    color: #f7f5ef;
    backdrop-filter: blur(12px);
  }
  .tune-panel summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding: 0 14px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #dedbd4;
    cursor: pointer;
    list-style: none;
  }
  .tune-panel summary::-webkit-details-marker { display: none; }
  .tune-body { display: grid; gap: 12px; padding: 4px 14px 14px; }
  .tune-body label { display: grid; grid-template-columns: 1fr auto; gap: 6px 8px; font-size: 12px; color: #c6c2ba; }
  .tune-body output { color: #fff; font-variant-numeric: tabular-nums; }
  .tune-body input {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 24px;
    accent-color: #e3ad43;
  }
  .reset-button {
    min-height: 36px;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 10px;
    background: transparent;
    color: #f7f5ef;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .reset-button:hover { background: rgba(255, 255, 255, 0.09); }
  .drag-hint {
    position: absolute;
    left: 22px;
    bottom: 22px;
    z-index: 20;
    pointer-events: none;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 720px) {
    .spatial-stage { min-height: 390px; }
    .stage-heading { top: 18px; left: 18px; }
    .tune-panel { top: 12px; right: 12px; width: 190px; }
    .spatial-scene { inset: 76px 0 68px; }
    .progress { display: none; }
    .drag-hint { display: none; }
  }

  @media (max-width: 430px) {
    .spatial-stage { min-height: 360px; }
    .stage-heading strong { font-size: 14px; }
    .stage-heading span { max-width: 130px; }
    .tune-panel { width: 158px; }
    .tune-panel summary { padding: 0 12px; }
    .spatial-scene { inset: 82px 0 66px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .spatial-card img,
    .step-button,
    .progress button::before { transition: none; }
  }
</style>
