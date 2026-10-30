// Copied from ../generative_art/js/sandbox.js, the gallery's sandbox; keep the two in step.
// Runs untrusted p5.js code (model-generated sketches) in an isolated iframe.
//
// - sandbox="allow-scripts" and nothing else: the frame gets an opaque origin, so it
//   can't read this page's DOM, cookies or storage, and can't open popups, navigate
//   the top window, show dialogs, submit forms or download files.
// - A CSP inside the frame blocks every request except the p5 script itself: no
//   fetch, beacons, sockets, or images/fonts from anywhere.
// - The code travels as base64 and is injected as a script element, so it never goes
//   through the HTML parser and can't close its own <script> tag to inject markup.
//
// A small bootstrap in the frame seeds Math.random (p5's random() and noise() fall
// back to it) and talks to the parent over postMessage. Messages from the frame are
// untrusted too, so the parent only acts on the shapes it expects.
//
// Many sketches are written to be played with, so the bootstrap also plays a visitor:
// see `visit` below. In the full-screen viewer (interactive: true) real input reaches the
// sketch instead, and the frame passes key presses and activity back for the viewer's
// shortcuts and HUD.
(() => {
  const P5_URL = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js';
  const CSP = [
    "default-src 'none'",
    `script-src ${P5_URL} 'unsafe-inline'`,
    "style-src 'unsafe-inline'",
    'img-src data: blob:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  // Serialized into the frame; runs before p5 and the sketch.
  function bootstrap(seed, density) {
    // p5 sizes its canvas buffer from devicePixelRatio. A piece drawn larger than its frame and scaled down
    // doesn't need the screen's full density, so the parent can tell the sketch a lower one.
    if (density) Object.defineProperty(window, 'devicePixelRatio', { value: density, configurable: true });

    let s = seed >>> 0;
    Math.random = () => {
      // mulberry32
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const post = (msg) => parent.postMessage(msg, '*');
    addEventListener('error', (e) => post({ type: 'error', message: String(e.message) }));
    addEventListener('unhandledrejection', (e) => post({ type: 'error', message: String(e.reason) }));
    document.addEventListener('securitypolicyviolation', (e) =>
      post({ type: 'csp', directive: e.effectiveDirective, blocked: String(e.blockedURI) })
    );
    addEventListener('load', () => post({ type: 'ready' }));

    // How many distinct colours are on screen, sampled at 32×32 (1 = blank).
    const colors = (canvas) => {
      const small = document.createElement('canvas');
      small.width = small.height = 32;
      const g = small.getContext('2d');
      g.drawImage(canvas, 0, 0, 32, 32);
      const px = g.getImageData(0, 0, 32, 32).data;
      const seen = new Set();
      for (let i = 0; i < px.length; i += 4) seen.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
      return seen.size;
    };

    // Scale the canvas to fit the frame, keeping its aspect ratio. Sizing the element itself (rather than
    // object-fit) keeps its box where the drawing is, which is what p5 maps mouse and touch positions against.
    const fit = (canvas) => {
      const aspect = canvas.width / canvas.height;
      const w = Math.min(innerWidth, innerHeight * aspect);
      if (Math.abs(canvas.getBoundingClientRect().width - w) < 0.5) return;
      canvas.style.setProperty('width', `${w}px`, 'important');
      canvas.style.setProperty('height', `${w / aspect}px`, 'important');
    };

    // Heartbeat (stops if the sketch blocks the thread), canvas fitting and the visitor share one loop.
    let frames = 0;
    let paused = false;
    const started = performance.now();
    const loopFrame = () => {
      frames++;
      const canvas = document.querySelector('canvas');
      if (canvas) {
        fit(canvas);
        if (!paused) visit(canvas, (performance.now() - started) / 1000);
      }
      requestAnimationFrame(loopFrame);
    };
    requestAnimationFrame(loopFrame);
    setInterval(() => post({ type: 'tick', frames }), 500);

    // The visitor: a cursor that drifts over the canvas on a smooth path (no randomness, so the sketch's seeded
    // Math.random is untouched). If the canvas is still blank after 1.5 s, the sketch is waiting for a click,
    // so the visitor starts clicking and dragging too. It doesn't click otherwise, because plenty of sketches
    // clear themselves on click. It leaves for good the moment a real person uses the frame.
    let visiting = true;
    let clicking = null; // decided at 1.5 s
    let pressed = false;
    const visit = (canvas, t) => {
      if (!visiting) return;
      const x = 0.5 + 0.32 * Math.sin(t * 0.9) + 0.12 * Math.sin(t * 2.3 + 1);
      const y = 0.5 + 0.3 * Math.sin(t * 0.7 + 2) + 0.12 * Math.cos(t * 1.9);
      const r = canvas.getBoundingClientRect();
      const fire = (type) =>
        canvas.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: r.left + x * r.width,
            clientY: r.top + y * r.height,
            button: 0,
            buttons: pressed ? 1 : 0,
          })
        );
      if (clicking === null && t > 1.5) clicking = colors(canvas) < 2;
      const down = clicking && t % 1.2 < 0.35; // hold for 0.35 s every 1.2 s
      if (down && !pressed) {
        pressed = true;
        fire('mousedown');
      } else if (!down && pressed) {
        pressed = false;
        fire('mouseup');
        fire('click');
      }
      fire('mousemove');
    };
    const person = (e) => {
      if (!e.isTrusted) return;
      visiting = false;
      if (e.type === 'keydown') post({ type: 'key', key: e.key, meta: e.metaKey, ctrl: e.ctrlKey, alt: e.altKey });
      else if (performance.now() - lastActivity > 250) {
        lastActivity = performance.now();
        post({ type: 'activity' });
      }
    };
    let lastActivity = 0;
    for (const type of ['mousedown', 'mousemove', 'touchstart', 'keydown']) addEventListener(type, person, true);

    addEventListener('message', (e) => {
      if (e.source !== parent || !e.data) return;
      const canvas = document.querySelector('canvas');
      switch (e.data.cmd) {
        case 'pause':
          paused = true;
          if (typeof noLoop === 'function') noLoop();
          break;
        case 'play':
          paused = false;
          if (typeof loop === 'function') loop();
          break;
        case 'save':
          if (canvas) post({ type: 'png', data: canvas.toDataURL('image/png') });
          break;
        case 'probe':
          if (!canvas) return post({ type: 'probe', canvas: false });
          post({ type: 'probe', canvas: true, width: canvas.width, height: canvas.height, colors: colors(canvas) });
      }
    });
  }

  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function srcdoc(code, seed, density) {
    return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #111; touch-action: none; }
  body { display: grid; place-items: center; }
  canvas { display: block; }
</style>
<script>(${bootstrap})(${Number(seed) >>> 0}, ${Number(density) || 0});</script>
<script src="${P5_URL}" crossorigin="anonymous"></script>
</head><body>
<script>{
  const s = document.createElement('script');
  s.textContent = new TextDecoder().decode(Uint8Array.from(atob('${toBase64(code)}'), (c) => c.charCodeAt(0)));
  document.body.appendChild(s);
}</script>
</body></html>`;
  }

  // Same handle shape as the p5 instances the gallery mounts: loop/noLoop/saveCanvas/remove/width.
  function mount(el, code, { seed = 1, density, interactive = false, onEvent = () => {} } = {}) {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.title = 'Sandboxed sketch';
    // Thumbnails take no pointer events: taps belong to the card link. The viewer lets them through.
    frame.style.cssText = `display:block;width:100%;height:100%;border:0;pointer-events:${interactive ? 'auto' : 'none'}`;
    frame.srcdoc = srcdoc(code, seed, density);

    let playing = true;
    let saveName = null;
    const send = (cmd) => frame.contentWindow && frame.contentWindow.postMessage({ cmd }, '*');
    const onMessage = (e) => {
      if (e.source !== frame.contentWindow || !e.data || typeof e.data.type !== 'string') return;
      const msg = e.data;
      if (msg.type === 'ready' && !playing) send('pause');
      if (msg.type === 'png' && saveName && typeof msg.data === 'string' && msg.data.startsWith('data:image/png;base64,')) {
        const a = document.createElement('a');
        a.href = msg.data;
        a.download = `${saveName}.png`;
        a.click();
        saveName = null;
      }
      onEvent(msg);
    };
    window.addEventListener('message', onMessage);
    // CSP can't stop a frame navigating itself, and the sandbox flag survives navigation
    // but our CSP doesn't. The srcdoc fires `load` once, so a second load means it left: drop it.
    let loads = 0;
    frame.addEventListener('load', () => {
      if (++loads < 2) return;
      window.removeEventListener('message', onMessage);
      frame.remove();
      onEvent({ type: 'navigated' });
    });
    el.append(frame);

    return {
      get width() {
        return frame.clientWidth;
      },
      loop() {
        playing = true;
        send('play');
      },
      noLoop() {
        playing = false;
        send('pause');
      },
      saveCanvas(name) {
        saveName = name;
        send('save');
      },
      command: send,
      remove() {
        window.removeEventListener('message', onMessage);
        frame.remove();
      },
    };
  }

  window.Sandbox = { P5_URL, srcdoc, mount };
})();
