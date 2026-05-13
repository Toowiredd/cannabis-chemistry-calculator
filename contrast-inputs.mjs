(() => {
  const getL = (r, g, b) => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };
  const cr = (l1, l2) => {
    const L = Math.max(l1, l2), d = Math.min(l1, l2);
    return (L + 0.05) / (d + 0.05);
  };
  const pr = (s) => {
    const stripped = s.replace('rgba(', '').replace('rgb(', '').replace(')', '');
    const p = stripped.split(',').map(x => x.trim());
    return { r: parseInt(p[0]), g: parseInt(p[1]), b: parseInt(p[2]), a: p[3] !== undefined ? parseFloat(p[3]) : 1 };
  };
  const comp = (fg, bg) => {
    if (fg.a >= 0.99) return fg;
    const a = fg.a;
    return { r: Math.round(fg.r * a + bg.r * (1 - a)), g: Math.round(fg.g * a + bg.g * (1 - a)), b: Math.round(fg.b * a + bg.b * (1 - a)), a: 1 };
  };
  const gBg = (el) => {
    let ch = [];
    let c = el;
    while (c) {
      const b = getComputedStyle(c).backgroundColor;
      if (b && b !== 'transparent' && b !== 'rgba(0, 0, 0, 0)') {
        const p = pr(b);
        if (p.a > 0.001) ch.push(p);
      }
      c = c.parentElement;
    }
    // Start from the page's actual dark background
    let r = { r: 13, g: 13, b: 18, a: 1 };
    for (let i = ch.length - 1; i >= 0; i--) {
      r = comp(ch[i], r);
    }
    return r;
  };
  const inputs = document.querySelectorAll('input');
  let res = [];
  for (const el of inputs) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const fg = pr(cs.color);
    const bg = gBg(el);
    const R = cr(getL(fg.r, fg.g, fg.b), getL(bg.r, bg.g, bg.b));
    res.push({ tag: 'INPUT', type: el.type, value: el.value.substring(0, 20), ratio: R.toFixed(2), fg: `rgb(${fg.r},${fg.g},${fg.b})`, bg: `rgb(${bg.r},${bg.g},${bg.b})` });
  }
  return JSON.stringify(res.slice(0, 15));
})()
