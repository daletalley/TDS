(() => {
  const OFFER_KEY = 'tds:closer:offer:v1';
  const PIPELINE_KEY = 'tds:closer:pipeline:v1';

  const presets = {
    booking: {
      studio: 'Talley Digital Studio',
      offer: 'Booking Page Rescue',
      buyer: 'local service business',
      turnaround: 'Same day',
      pain: 'good leads are leaking before they book',
      outcome: 'a cleaner booking path that turns warm visitors into scheduled calls',
      deliverables: [
        'Conversion scan of the current booking path',
        'Priority fixes to the page copy and call-to-action flow',
        'Mobile-first checkout/contact pass',
        'Launch checklist with before-and-after receipt'
      ],
      proof: 'Built by Talley Digital Studio with a clean handoff and smoke-test receipt.',
      price: 750,
      deposit: 250,
      slots: 4,
      cta: 'Reserve my sprint',
      includeUrgency: true,
      includeGuarantee: true
    },
    audit: {
      studio: 'Talley Digital Studio',
      offer: 'Revenue Leak Audit',
      buyer: 'owner with a live website and unclear conversion path',
      turnaround: '24 hours',
      pain: 'traffic, calls, and referrals are not converting consistently',
      outcome: 'a ranked fix list with copy, layout, and checkout changes tied to revenue',
      deliverables: [
        'Screen-recorded conversion teardown',
        'Ranked list of the ten highest-value fixes',
        'Offer and CTA rewrite for the primary money page',
        'One implementation quote that can start immediately'
      ],
      proof: 'Delivered as a decision-ready audit with receipts, screenshots, and next actions.',
      price: 297,
      deposit: 297,
      slots: 8,
      cta: 'Buy the audit',
      includeUrgency: true,
      includeGuarantee: false
    },
    ops: {
      studio: 'Talley Digital Studio',
      offer: 'Ops Cleanup Sprint',
      buyer: 'small team buried in manual follow-up',
      turnaround: '48 hours',
      pain: 'leads, jobs, and handoffs are spread across too many tools',
      outcome: 'one clean operating board with fewer missed follow-ups',
      deliverables: [
        'Current workflow map',
        'Simple CRM or tracker setup',
        'Automation-ready status fields and handoff notes',
        'Owner walkthrough with exportable operating receipt'
      ],
      proof: 'Local-first systems thinking with practical operator flow and clean documentation.',
      price: 1200,
      deposit: 400,
      slots: 3,
      cta: 'Hold my sprint',
      includeUrgency: true,
      includeGuarantee: true
    }
  };

  const fields = [
    'studio',
    'offer',
    'buyer',
    'turnaround',
    'pain',
    'outcome',
    'deliverables',
    'proof',
    'price',
    'deposit',
    'slots',
    'checkoutUrl',
    'email',
    'phone',
    'cta',
    'includeUrgency',
    'includeGuarantee'
  ];

  const state = {
    offer: {
      ...presets.booking,
      deliverables: presets.booking.deliverables.join('\n'),
      checkoutUrl: '',
      email: 'dale@talleydigitalstudio.com',
      phone: '913-940-4441'
    },
    pipeline: [],
    messageType: 'dm'
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const els = {
    form: $('#offerForm'),
    presetButtons: $$('[data-preset]'),
    messageButtons: $$('[data-message]'),
    proposalPreview: $('#proposalPreview'),
    metricGrid: $('#metricGrid'),
    messageOutput: $('#messageOutput'),
    prospectForm: $('#prospectForm'),
    prospectList: $('#prospectList'),
    toast: $('#toast'),
    copyPitchBtn: $('#copyPitchBtn'),
    copyMessageBtn: $('#copyMessageBtn'),
    downloadPageBtn: $('#downloadPageBtn'),
    printBtn: $('#printBtn'),
    resetBtn: $('#resetBtn'),
    exportPipelineBtn: $('#exportPipelineBtn'),
    emailLeadBtn: $('#emailLeadBtn'),
    stripTitle: $('#stripTitle'),
    stripLine: $('#stripLine'),
    stripCta: $('#stripCta'),
    pathSummary: $('#pathSummary'),
    pathTwoClose: $('#pathTwoClose'),
    pathTwoCloseLine: $('#pathTwoCloseLine'),
    checkoutHint: $('#checkoutHint'),
    statPrice: $('#statPrice'),
    statDeposit: $('#statDeposit'),
    statPotential: $('#statPotential')
  };

  const inputFor = key => $(`[name="${key}"]`);

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function money(value) {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: amount % 1 ? 2 : 0
    }).format(amount);
  }

  function numberValue(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function lines(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  }

  function safeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function phoneHref(phone) {
    const digits = String(phone || '').replace(/[^\d+]/g, '');
    return digits ? `tel:${digits}` : '';
  }

  function mailtoHref(offer) {
    const address = String(offer.email || 'dale@talleydigitalstudio.com').replace(/[\r\n?&]/g, '').trim();
    const subject = `${offer.offer} - ${money(offer.deposit)} deposit`;
    const body = `I want to reserve ${offer.offer} for ${money(offer.deposit)} today.\n\nBuyer: ${offer.buyer}\nOutcome: ${offer.outcome}`;
    return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function primaryHref(offer) {
    return safeUrl(offer.checkoutUrl) || mailtoHref(offer);
  }

  function collectOffer() {
    const next = {};
    fields.forEach(key => {
      const input = inputFor(key);
      if (!input) return;
      if (input.type === 'checkbox') {
        next[key] = input.checked;
      } else if (input.type === 'number') {
        next[key] = numberValue(input.value);
      } else {
        next[key] = input.value.trim();
      }
    });
    state.offer = next;
    return next;
  }

  function setOfferForm(offer) {
    fields.forEach(key => {
      const input = inputFor(key);
      if (!input || offer[key] === undefined) return;
      if (input.type === 'checkbox') {
        input.checked = Boolean(offer[key]);
      } else if (Array.isArray(offer[key])) {
        input.value = offer[key].join('\n');
      } else {
        input.value = offer[key];
      }
    });
    collectOffer();
  }

  function persistOffer() {
    const value = { ...state.offer };
    if (window.TDSStorage) {
      window.TDSStorage.set(OFFER_KEY, value);
      return;
    }
    try {
      localStorage.setItem(OFFER_KEY, JSON.stringify(value));
    } catch {
      // The app remains usable for the current session.
    }
  }

  function persistPipeline() {
    if (window.TDSStorage) {
      window.TDSStorage.set(PIPELINE_KEY, state.pipeline);
      return;
    }
    try {
      localStorage.setItem(PIPELINE_KEY, JSON.stringify(state.pipeline));
    } catch {
      // The app remains usable for the current session.
    }
  }

  async function loadStored() {
    try {
      const offer = window.TDSStorage
        ? await window.TDSStorage.get(OFFER_KEY, null)
        : JSON.parse(localStorage.getItem(OFFER_KEY) || 'null');
      if (offer && typeof offer === 'object') {
        state.offer = { ...state.offer, ...offer };
      }
    } catch {
      // Defaults are ready.
    }

    try {
      const pipeline = window.TDSStorage
        ? await window.TDSStorage.get(PIPELINE_KEY, [])
        : JSON.parse(localStorage.getItem(PIPELINE_KEY) || '[]');
      state.pipeline = Array.isArray(pipeline) ? pipeline : [];
    } catch {
      state.pipeline = [];
    }
  }

  function notify(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  async function copyText(text, label = 'Copied') {
    try {
      await navigator.clipboard.writeText(text);
      notify(label);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      notify(label);
    }
  }

  function buildPlainPitch(offer = state.offer) {
    const depositLine = Number(offer.deposit) >= Number(offer.price)
      ? `${money(offer.price)} paid upfront`
      : `${money(offer.deposit)} deposit today, ${money(Number(offer.price) - Number(offer.deposit))} on handoff`;
    return `${offer.offer} for ${offer.buyer}

Problem: ${offer.pain}.
Outcome: ${offer.outcome}.
Turnaround: ${offer.turnaround}.
Price: ${money(offer.price)} (${depositLine}).

Includes:
${lines(offer.deliverables).map(item => `- ${item}`).join('\n')}

${offer.includeUrgency ? `Open slots: ${offer.slots}. ` : ''}${offer.cta}: ${safeUrl(offer.checkoutUrl) || offer.email || offer.phone}`.trim();
  }

  function buildMessages(offer = state.offer) {
    const checkout = safeUrl(offer.checkoutUrl);
    const contact = checkout || offer.email || offer.phone;
    return {
      dm: `Quick idea: I can run a ${offer.turnaround.toLowerCase()} ${offer.offer} for your ${offer.buyer} flow.

It is built for the spot where ${offer.pain}. The outcome is ${offer.outcome}.

Fixed price is ${money(offer.price)}${Number(offer.deposit) ? ` with ${money(offer.deposit)} to reserve it today` : ''}. ${offer.includeUrgency ? `${offer.slots} slots are open.` : ''}

${offer.cta}: ${contact}`,
      email: `Subject: ${offer.offer} for ${offer.buyer}

Hey,

I put together a fixed ${offer.turnaround.toLowerCase()} offer for the point where ${offer.pain}.

The outcome: ${offer.outcome}.

Included:
${lines(offer.deliverables).map(item => `- ${item}`).join('\n')}

Price is ${money(offer.price)}${Number(offer.deposit) ? `, with ${money(offer.deposit)} due today to lock the slot` : ''}.

${offer.includeUrgency ? `I am holding ${offer.slots} slot${Number(offer.slots) === 1 ? '' : 's'} for this batch.` : ''}

${offer.cta}: ${contact}

${offer.studio}`,
      call: `Open with the leak: "${offer.pain}."

Frame the offer: "${offer.offer} is a ${offer.turnaround.toLowerCase()} sprint for ${offer.buyer}. The outcome is ${offer.outcome}."

Anchor the price: "${offer.price ? money(offer.price) : 'Fixed price'} for the sprint${offer.deposit ? `, ${money(offer.deposit)} reserves it today` : ''}."

Close: "${offer.cta}. I can send the checkout link now and start with the highest-value fix first."`
    };
  }

  function renderProposal(offer = state.offer) {
    const items = lines(offer.deliverables);
    const due = Number(offer.deposit) || Number(offer.price) || 0;
    const balance = Math.max(0, Number(offer.price) - due);
    const href = primaryHref(offer);
    const callHref = phoneHref(offer.phone);
    const urgency = offer.includeUrgency
      ? `<div class="proposal-note">${escapeHtml(offer.slots)} sprint slot${Number(offer.slots) === 1 ? '' : 's'} open for this batch. ${escapeHtml(money(due))} reserves the next slot today.</div>`
      : '';
    const guarantee = offer.includeGuarantee
      ? '<div class="proposal-note">Fit guarantee: if the first pass does not identify a clear revenue path, the sprint converts into a written action plan at no extra cost.</div>'
      : '';

    els.proposalPreview.innerHTML = `
      <div class="proposal-media">
        <img src="assets/revenue-desk.jpg" alt="">
        <div>
          <p>${escapeHtml(offer.studio)}</p>
          <h3>${escapeHtml(offer.offer)}</h3>
        </div>
      </div>
      <div class="proposal-body">
        <p class="proposal-lede">For a ${escapeHtml(offer.buyer)} where ${escapeHtml(offer.pain)}, this ${escapeHtml(offer.turnaround.toLowerCase())} sprint creates ${escapeHtml(offer.outcome)}.</p>
        <div class="proposal-kpis" aria-label="Proposal numbers">
          <div><span>Price</span><strong>${escapeHtml(money(offer.price))}</strong></div>
          <div><span>Due today</span><strong>${escapeHtml(money(due))}</strong></div>
          <div><span>Balance</span><strong>${escapeHtml(money(balance))}</strong></div>
        </div>
        <div class="proposal-block">
          <h4>Included</h4>
          <ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </div>
        <div class="proposal-block">
          <h4>Proof</h4>
          <p class="proposal-note">${escapeHtml(offer.proof)}</p>
        </div>
        ${urgency}
        ${guarantee}
        <div class="proposal-actions">
          <a class="primary" href="${escapeAttr(href)}" target="${safeUrl(offer.checkoutUrl) ? '_blank' : '_self'}" rel="noreferrer">${escapeHtml(offer.cta)}</a>
          <a href="${escapeAttr(mailtoHref(offer))}">Email</a>
          ${callHref ? `<a href="${escapeAttr(callHref)}">Call</a>` : ''}
        </div>
      </div>`;
  }

  function renderMetrics(offer = state.offer) {
    const price = Number(offer.price) || 0;
    const deposit = Number(offer.deposit) || 0;
    const slots = Math.max(1, Number(offer.slots) || 1);
    const batch = price * slots;
    const today = (deposit || price) * slots;
    const balance = Math.max(0, price - (deposit || price));

    els.statPrice.textContent = money(price);
    els.statDeposit.textContent = money(deposit || price);
    els.statPotential.textContent = money(batch);

    els.metricGrid.innerHTML = [
      ['Batch revenue', money(batch), `${slots} slot${slots === 1 ? '' : 's'} at ${money(price)}`],
      ['Cash today', money(today), `${money(deposit || price)} due per slot`],
      ['Per client balance', money(balance), balance ? 'Due on handoff' : 'Paid upfront'],
      ['Checkout', safeUrl(offer.checkoutUrl) ? 'Ready' : 'Email fallback', safeUrl(offer.checkoutUrl) ? 'Payment link is active' : 'Paste a Stripe, Square, or PayPal link'],
      ['Turnaround', offer.turnaround || 'Same day', offer.includeUrgency ? 'Scarcity shown' : 'Scarcity hidden'],
      ['Pipeline', `${state.pipeline.length}`, `${state.pipeline.filter(item => item.status === 'Won').length} won`]
    ].map(([label, value, detail]) => `
      <div class="metric-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
    `).join('');
  }

  function renderMessages() {
    const messages = buildMessages();
    els.messageOutput.value = messages[state.messageType];
    els.emailLeadBtn.href = mailtoHref(state.offer);
  }

  function renderStrip(offer = state.offer) {
    els.stripTitle.textContent = offer.offer || 'Closer';
    els.stripLine.textContent = `${money(offer.deposit || offer.price)} today. ${money((Number(offer.price) || 0) * (Number(offer.slots) || 1))} batch potential.`;
    els.stripCta.textContent = offer.cta || 'Reserve';
    els.stripCta.href = primaryHref(offer);
    if (safeUrl(offer.checkoutUrl)) {
      els.stripCta.target = '_blank';
      els.stripCta.rel = 'noreferrer';
    } else {
      els.stripCta.removeAttribute('target');
      els.stripCta.removeAttribute('rel');
    }
  }

  function renderMoneyPath(offer = state.offer) {
    const due = Number(offer.deposit) || Number(offer.price) || 0;
    const price = Number(offer.price) || 0;
    const slots = Math.max(1, Number(offer.slots) || 1);
    const checkoutReady = Boolean(safeUrl(offer.checkoutUrl));
    els.pathSummary.textContent = `Send the ${offer.offer} pitch to 25 matched owners and collect ${money(due)} to reserve each slot.`;
    els.pathTwoClose.textContent = money(due * 2);
    els.pathTwoCloseLine.textContent = `2 deposits today; full batch is ${money(price * slots)} if ${slots} slot${slots === 1 ? '' : 's'} sell.`;
    els.checkoutHint.textContent = checkoutReady
      ? 'Payment link active. The proposal CTA can collect money now.'
      : 'Paste a real Stripe, Square, PayPal, or invoice link here. Without it, the CTA opens email instead of collecting money.';
    els.checkoutHint.classList.toggle('ready', checkoutReady);
  }

  function renderPipeline() {
    if (!state.pipeline.length) {
      els.prospectList.innerHTML = '<p class="empty">No prospects yet.</p>';
      return;
    }

    els.prospectList.innerHTML = state.pipeline.map(item => `
      <div class="prospect-item" data-id="${escapeAttr(item.id)}">
        <div>
          <strong>${escapeHtml(item.company || item.name || 'Prospect')}</strong>
          <span>${escapeHtml(item.name || 'Owner')} · ${escapeHtml(item.createdAtLabel || '')}</span>
        </div>
        <span class="status-pill">${escapeHtml(item.status || 'New')}</span>
        <button class="btn compact" type="button" data-remove="${escapeAttr(item.id)}">Remove</button>
      </div>
    `).join('');
  }

  function render() {
    renderStrip();
    renderMoneyPath();
    renderProposal();
    renderMetrics();
    renderMessages();
    renderPipeline();
  }

  function buildStandaloneHtml(offer = state.offer) {
    const items = lines(offer.deliverables);
    const due = Number(offer.deposit) || Number(offer.price) || 0;
    const balance = Math.max(0, Number(offer.price) - due);
    const imageUrl = new URL('assets/revenue-desk.jpg', window.location.href).href;
    const href = primaryHref(offer);
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(offer.offer)} | ${escapeHtml(offer.studio)}</title>
  <style>
    *{box-sizing:border-box} body{margin:0;background:#f4f1ea;color:#111;font-family:Arial,Helvetica,sans-serif} main{width:min(1040px,calc(100% - 28px));margin:0 auto;padding:18px 0 36px} .hero{min-height:330px;display:grid;align-content:end;position:relative;overflow:hidden;padding:22px;border:1px solid #111;background:#111;color:#fff} .hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.72}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.68),rgba(0,0,0,.12))}.hero div{position:relative;z-index:1}.eyebrow{font-size:12px;font-weight:900;text-transform:uppercase} h1{margin:8px 0 0;font-size:44px;line-height:1;text-transform:uppercase} .body{display:grid;gap:16px;border:1px solid #111;border-top:0;background:#fbf8f1;padding:20px}.lede{font-size:20px;line-height:1.35;font-weight:800}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.kpis div,.note{border:1px solid rgba(17,17,17,.24);padding:13px;background:rgba(255,255,255,.46)}.kpis span{display:block;color:#6b6760;font-size:12px;font-weight:900;text-transform:uppercase}.kpis strong{display:block;margin-top:8px;font-size:28px}.block{border-top:2px solid #111;padding-top:14px}.block h2{margin:0 0 10px;font-size:14px;text-transform:uppercase} li{margin:0 0 8px;font-weight:800}.actions{display:flex;flex-wrap:wrap;gap:10px}.actions a{display:inline-flex;min-height:44px;align-items:center;justify-content:center;border:1px solid #111;padding:11px 14px;color:#111;text-decoration:none;font-weight:900;text-transform:uppercase}.actions .primary{background:#d71920;border-color:#d71920;color:#fff}@media(max-width:720px){.kpis{grid-template-columns:1fr}h1{font-size:34px}}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <img src="${escapeAttr(imageUrl)}" alt="">
      <div><p class="eyebrow">${escapeHtml(offer.studio)}</p><h1>${escapeHtml(offer.offer)}</h1></div>
    </section>
    <section class="body">
      <p class="lede">For a ${escapeHtml(offer.buyer)} where ${escapeHtml(offer.pain)}, this ${escapeHtml(offer.turnaround.toLowerCase())} sprint creates ${escapeHtml(offer.outcome)}.</p>
      <div class="kpis"><div><span>Price</span><strong>${escapeHtml(money(offer.price))}</strong></div><div><span>Due today</span><strong>${escapeHtml(money(due))}</strong></div><div><span>Balance</span><strong>${escapeHtml(money(balance))}</strong></div></div>
      <div class="block"><h2>Included</h2><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>
      <p class="note">${escapeHtml(offer.proof)}</p>
      ${offer.includeUrgency ? `<p class="note">${escapeHtml(offer.slots)} sprint slot${Number(offer.slots) === 1 ? '' : 's'} open for this batch. ${escapeHtml(money(due))} reserves the next slot today.</p>` : ''}
      ${offer.includeGuarantee ? '<p class="note">Fit guarantee: if the first pass does not identify a clear revenue path, the sprint converts into a written action plan at no extra cost.</p>' : ''}
      <div class="actions"><a class="primary" href="${escapeAttr(href)}">${escapeHtml(offer.cta)}</a><a href="${escapeAttr(mailtoHref(offer))}">Email</a></div>
    </section>
  </main>
</body>
</html>`;
  }

  function download(filename, content, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function slug(value) {
    return String(value || 'closer-offer')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'closer-offer';
  }

  function applyPreset(key) {
    const preset = presets[key];
    if (!preset) return;
    const currentContact = {
      checkoutUrl: state.offer.checkoutUrl,
      email: state.offer.email,
      phone: state.offer.phone
    };
    setOfferForm({
      ...preset,
      ...currentContact,
      deliverables: preset.deliverables.join('\n')
    });
    els.presetButtons.forEach(button => button.classList.toggle('active', button.dataset.preset === key));
    persistOffer();
    render();
  }

  function addProspect(event) {
    event.preventDefault();
    const name = $('#prospectName').value.trim();
    const company = $('#prospectCompany').value.trim();
    const status = $('#prospectStatus').value;
    if (!name && !company) {
      notify('Add a name or company');
      return;
    }
    const created = new Date();
    state.pipeline.unshift({
      id: `${created.getTime()}-${Math.random().toString(16).slice(2)}`,
      name,
      company,
      status,
      value: Number(state.offer.price) || 0,
      createdAt: created.toISOString(),
      createdAtLabel: created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    });
    event.currentTarget.reset();
    persistPipeline();
    render();
    notify('Prospect added');
  }

  function bindEvents() {
    els.form.addEventListener('input', () => {
      collectOffer();
      persistOffer();
      render();
    });
    els.form.addEventListener('change', () => {
      collectOffer();
      persistOffer();
      render();
    });

    els.presetButtons.forEach(button => {
      button.addEventListener('click', () => applyPreset(button.dataset.preset));
    });

    els.messageButtons.forEach(button => {
      button.addEventListener('click', () => {
        state.messageType = button.dataset.message;
        els.messageButtons.forEach(item => item.classList.toggle('active', item === button));
        renderMessages();
      });
    });

    els.copyPitchBtn.addEventListener('click', () => copyText(buildPlainPitch(), 'Pitch copied'));
    els.copyMessageBtn.addEventListener('click', () => copyText(els.messageOutput.value, 'Message copied'));
    els.downloadPageBtn.addEventListener('click', () => {
      download(`${slug(state.offer.offer)}.html`, buildStandaloneHtml(), 'text/html');
      notify('Proposal downloaded');
    });
    els.printBtn.addEventListener('click', () => window.print());
    els.resetBtn.addEventListener('click', () => applyPreset('booking'));
    els.exportPipelineBtn.addEventListener('click', () => {
      download('closer-pipeline.json', JSON.stringify({
        offer: state.offer,
        pipeline: state.pipeline
      }, null, 2), 'application/json');
      notify('Pipeline exported');
    });

    els.prospectForm.addEventListener('submit', addProspect);
    els.prospectList.addEventListener('click', event => {
      const button = event.target.closest('[data-remove]');
      if (!button) return;
      state.pipeline = state.pipeline.filter(item => item.id !== button.dataset.remove);
      persistPipeline();
      render();
      notify('Prospect removed');
    });
  }

  async function init() {
    await loadStored();
    setOfferForm(state.offer);
    bindEvents();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
