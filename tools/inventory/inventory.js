(() => {
  const STORE_KEY = 'tds:inventory:v1';
  const EXPORT_VERSION = 2;
  const state = {
    items: [],
    editingId: '',
    deletingId: '',
    confirmAction: '',
    lastFocus: null,
    query: '',
    status: 'all',
    category: '',
    location: '',
    sort: 'updated'
  };

  const $ = selector => document.querySelector(selector);
  const els = {
    itemCount: $('#itemCount'),
    lowCount: $('#lowCount'),
    unitCount: $('#unitCount'),
    valueCount: $('#valueCount'),
    exportBtn: $('#exportBtn'),
    clearBtn: $('#clearBtn'),
    importInput: $('#importInput'),
    form: $('#itemForm'),
    formTitle: $('#formTitle'),
    formStatus: $('#formStatus'),
    resetForm: $('#resetForm'),
    tableWrap: $('#tableWrap'),
    listSummary: $('#listSummary'),
    searchInput: $('#searchInput'),
    statusFilter: $('#statusFilter'),
    categoryFilter: $('#categoryFilter'),
    locationFilter: $('#locationFilter'),
    sortSelect: $('#sortSelect'),
    resetFilters: $('#resetFilters'),
    sampleBtn: $('#sampleBtn'),
    categoryOptions: $('#categoryOptions'),
    locationOptions: $('#locationOptions'),
    unitOptions: $('#unitOptions'),
    confirmModal: $('#confirmModal'),
    confirmTitle: $('#confirmTitle'),
    toast: $('#toast')
  };

  const fields = {
    name: $('#nameInput'),
    sku: $('#skuInput'),
    supplier: $('#supplierInput'),
    category: $('#categoryInput'),
    location: $('#locationInput'),
    quantity: $('#quantityInput'),
    minimum: $('#minimumInput'),
    unit: $('#unitInput'),
    cost: $('#costInput'),
    note: $('#noteInput')
  };

  const sampleItems = [
    { name: 'Shop towels', sku: 'TOWEL-12PK', supplier: 'Grainger', category: 'Supplies', location: 'Shelf A', quantity: 18, minimum: 6, unit: 'pack', cost: 8.5, note: 'Keep near detail bay.' },
    { name: 'Nitrile gloves', sku: 'GLOVE-M-BLK', supplier: 'Uline', category: 'Safety', location: 'Cabinet 2', quantity: 4, minimum: 8, unit: 'box', cost: 12.25, note: 'Medium black gloves.' },
    { name: 'Printer paper', sku: 'PAPER-LTR', supplier: 'Office Depot', category: 'Office', location: 'Desk', quantity: 9, minimum: 3, unit: 'ream', cost: 6.75, note: '' },
    { name: 'Shipping labels', sku: 'LABEL-4X6', supplier: 'Amazon Business', category: 'Shipping', location: 'Packing bench', quantity: 0, minimum: 2, unit: 'roll', cost: 14, note: 'Thermal label rolls.' }
  ];

  const now = () => new Date().toISOString();
  const uid = () => `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const money = value => Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const shortDate = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  const itemValue = item => Number(item.quantity || 0) * Number(item.cost || 0);
  const reorderNeed = item => Math.max(0, Number(item.minimum || 0) - Number(item.quantity || 0));
  const trackedMinimum = item => Number(item.minimum || 0) > 0;
  const itemStatus = item => {
    if (!trackedMinimum(item)) return 'untracked';
    if (Number(item.quantity || 0) <= 0) return 'out';
    if (Number(item.quantity || 0) <= Number(item.minimum || 0)) return 'low';
    return 'ok';
  };
  const needsReorder = item => ['out', 'low'].includes(itemStatus(item));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
  const cleanText = (value, limit = 120) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit);

  function notify(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function normalizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function normalizeId(value) {
    const id = String(value || '');
    return /^[a-zA-Z0-9:_-]{6,80}$/.test(id) ? id : uid();
  }

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return null;
    const createdAt = item.createdAt || now();
    const name = cleanText(item.name, 80);
    if (!name) return null;
    return {
      id: normalizeId(item.id),
      name,
      sku: cleanText(item.sku, 40).toUpperCase(),
      supplier: cleanText(item.supplier || item.vendor, 60),
      category: cleanText(item.category, 40),
      location: cleanText(item.location, 40),
      quantity: Math.round(normalizeNumber(item.quantity)),
      minimum: Math.round(normalizeNumber(item.minimum)),
      unit: cleanText(item.unit, 24),
      cost: Math.round(normalizeNumber(item.cost) * 100) / 100,
      note: cleanText(item.note, 240),
      createdAt,
      updatedAt: item.updatedAt || createdAt
    };
  }

  function readLegacyItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return parseItemsPayload(parsed);
    } catch {
      return [];
    }
  }

  async function readItems() {
    try {
      const parsed = await window.TDSStorage?.get(STORE_KEY, readLegacyItems()) ?? readLegacyItems();
      return parseItemsPayload(parsed);
    } catch {
      return readLegacyItems();
    }
  }

  async function saveItems() {
    let saved = false;
    if (window.TDSStorage) {
      saved = await window.TDSStorage.set(STORE_KEY, state.items);
    } else {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state.items));
        saved = true;
      } catch {
        saved = false;
      }
    }
    if (saved === false) notify('Unable to save inventory on this device.');
    return saved;
  }

  function parseItemsPayload(payload) {
    const source = Array.isArray(payload) ? payload : payload?.items || payload?.inventory || [];
    return Array.isArray(source) ? source.map(normalizeItem).filter(Boolean) : [];
  }

  function uniqueSorted(key) {
    return [...new Set(state.items.map(item => item[key]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }

  function filteredItems() {
    const query = state.query.trim().toLowerCase();
    return state.items
      .filter(item => {
        const status = itemStatus(item);
        if (state.status === 'needs' && !needsReorder(item)) return false;
        if (state.status !== 'all' && state.status !== 'needs' && status !== state.status) return false;
        if (state.category && item.category !== state.category) return false;
        if (state.location && item.location !== state.location) return false;
        if (!query) return true;
        return [item.name, item.sku, item.supplier, item.category, item.location, item.unit, item.note]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (state.sort === 'name') return a.name.localeCompare(b.name);
        if (state.sort === 'quantity') return a.quantity - b.quantity || a.name.localeCompare(b.name);
        if (state.sort === 'reorder') return Number(needsReorder(b)) - Number(needsReorder(a)) || reorderNeed(b) - reorderNeed(a) || a.name.localeCompare(b.name);
        if (state.sort === 'value') return itemValue(b) - itemValue(a) || a.name.localeCompare(b.name);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }

  function resetForm() {
    state.editingId = '';
    els.formTitle.textContent = 'Add stock';
    els.formStatus.textContent = '';
    els.form.reset();
    fields.quantity.value = '0';
    fields.minimum.value = '0';
  }

  function itemFromForm() {
    const existing = state.items.find(item => item.id === state.editingId);
    const item = normalizeItem({
      id: state.editingId || uid(),
      name: fields.name.value,
      sku: fields.sku.value,
      supplier: fields.supplier.value,
      category: fields.category.value,
      location: fields.location.value,
      quantity: fields.quantity.value,
      minimum: fields.minimum.value,
      unit: fields.unit.value,
      cost: fields.cost.value,
      note: fields.note.value,
      createdAt: existing?.createdAt || now(),
      updatedAt: now()
    });
    if (!item) throw new Error('Name is required.');
    return item;
  }

  async function saveFromForm() {
    try {
      const item = itemFromForm();
      const index = state.items.findIndex(current => current.id === item.id);
      if (index >= 0) state.items.splice(index, 1, item);
      else state.items.unshift(item);
      await saveItems();
      resetForm();
      render();
      notify('Inventory saved.');
    } catch (error) {
      els.formStatus.textContent = error.message || 'Item is incomplete.';
    }
  }

  function editItem(id) {
    const item = state.items.find(current => current.id === id);
    if (!item) return;
    state.editingId = id;
    els.formTitle.textContent = 'Edit stock';
    els.formStatus.textContent = '';
    fields.name.value = item.name;
    fields.sku.value = item.sku;
    fields.supplier.value = item.supplier;
    fields.category.value = item.category;
    fields.location.value = item.location;
    fields.quantity.value = item.quantity;
    fields.minimum.value = item.minimum;
    fields.unit.value = item.unit;
    fields.cost.value = item.cost || '';
    fields.note.value = item.note;
    fields.name.focus();
  }

  async function adjustItem(id, delta) {
    const item = state.items.find(current => current.id === id);
    if (!item) return;
    item.quantity = Math.max(0, item.quantity + delta);
    item.updatedAt = now();
    await saveItems();
    render();
  }

  async function restockItem(id) {
    const item = state.items.find(current => current.id === id);
    if (!item || !trackedMinimum(item)) return;
    item.quantity = Math.max(item.quantity, item.minimum);
    item.updatedAt = now();
    await saveItems();
    render();
    notify('Quantity restored to minimum.');
  }

  async function duplicateItem(id) {
    const item = state.items.find(current => current.id === id);
    if (!item) return;
    const copy = normalizeItem({
      ...item,
      id: uid(),
      name: `${item.name} copy`,
      sku: '',
      createdAt: now(),
      updatedAt: now()
    });
    state.items.unshift(copy);
    await saveItems();
    render();
    editItem(copy.id);
    notify('Item duplicated.');
  }

  function openConfirm({ action, id = '', title, message, confirmLabel = 'Delete' }) {
    state.deletingId = id;
    state.confirmAction = action;
    state.lastFocus = document.activeElement;
    els.confirmTitle.textContent = title;
    els.confirmModal.querySelector('p:not(.eyebrow)').textContent = message;
    els.confirmModal.querySelector('[data-confirm="delete"]').textContent = confirmLabel;
    els.confirmModal.classList.add('open');
    els.confirmModal.setAttribute('aria-hidden', 'false');
    els.confirmModal.querySelector('[data-confirm="cancel"]').focus();
  }

  function closeConfirm() {
    state.deletingId = '';
    state.confirmAction = '';
    els.confirmModal.classList.remove('open');
    els.confirmModal.setAttribute('aria-hidden', 'true');
    state.lastFocus?.focus?.();
  }

  async function runConfirmAction() {
    if (state.confirmAction === 'delete') await deleteItem();
    if (state.confirmAction === 'clear') await clearItems();
    if (state.confirmAction === 'sample') await loadSample(true);
  }

  async function deleteItem() {
    state.items = state.items.filter(item => item.id !== state.deletingId);
    if (state.editingId === state.deletingId) resetForm();
    await saveItems();
    closeConfirm();
    render();
    notify('Item deleted.');
  }

  function exportItems() {
    const payload = {
      version: EXPORT_VERSION,
      exportedAt: now(),
      summary: {
        items: state.items.length,
        low: state.items.filter(needsReorder).length,
        units: state.items.reduce((total, item) => total + item.quantity, 0),
        value: state.items.reduce((total, item) => total + itemValue(item), 0)
      },
      items: state.items
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `tds-inventory-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Inventory exported.');
  }

  function requestClearItems() {
    if (!state.items.length) {
      notify('Inventory is already empty.');
      return;
    }
    openConfirm({
      action: 'clear',
      title: 'Clear inventory?',
      message: 'This removes every item from this browser.',
      confirmLabel: 'Clear'
    });
  }

  async function clearItems() {
    state.items = [];
    await saveItems();
    resetForm();
    closeConfirm();
    render();
    notify('Inventory cleared.');
  }

  function mergeImportedItems(importedItems) {
    const merged = [...state.items];
    let added = 0;
    let updated = 0;
    importedItems.forEach(imported => {
      const key = imported.sku
        ? current => current.sku && current.sku.toLowerCase() === imported.sku.toLowerCase()
        : current => current.name.toLowerCase() === imported.name.toLowerCase() && current.location.toLowerCase() === imported.location.toLowerCase();
      const index = merged.findIndex(key);
      if (index >= 0) {
        merged[index] = { ...imported, id: merged[index].id, createdAt: merged[index].createdAt, updatedAt: now() };
        updated += 1;
      } else {
        merged.unshift({ ...imported, id: imported.id || uid(), createdAt: imported.createdAt || now(), updatedAt: imported.updatedAt || now() });
        added += 1;
      }
    });
    state.items = merged.map(normalizeItem).filter(Boolean);
    return { added, updated };
  }

  function importItems(file) {
    const reader = new FileReader();
    reader.addEventListener('load', async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]'));
        const items = parseItemsPayload(parsed);
        if (!items.length) throw new Error('No valid items found.');
        const result = mergeImportedItems(items);
        await saveItems();
        resetForm();
        render();
        notify(`Imported ${result.added} new, updated ${result.updated}.`);
      } catch (error) {
        notify(error.message || 'Import failed.');
      }
    });
    reader.readAsText(file);
  }

  async function loadSample(force = false) {
    if (state.items.length && !force) {
      openConfirm({
        action: 'sample',
        title: 'Load sample?',
        message: 'Sample data replaces the current inventory in this browser.',
        confirmLabel: 'Load'
      });
      return;
    }
    state.items = sampleItems.map(item => normalizeItem({ ...item, id: uid(), createdAt: now(), updatedAt: now() }));
    await saveItems();
    resetForm();
    closeConfirm();
    render();
    notify('Sample loaded.');
  }

  function resetFilters() {
    state.query = '';
    state.status = 'all';
    state.category = '';
    state.location = '';
    state.sort = 'updated';
    els.searchInput.value = '';
    els.statusFilter.value = state.status;
    els.categoryFilter.value = state.category;
    els.locationFilter.value = state.location;
    els.sortSelect.value = state.sort;
    render();
  }

  function renderStats() {
    els.itemCount.textContent = String(state.items.length);
    els.lowCount.textContent = String(state.items.filter(needsReorder).length);
    els.unitCount.textContent = String(state.items.reduce((total, item) => total + item.quantity, 0));
    els.valueCount.textContent = money(state.items.reduce((total, item) => total + itemValue(item), 0));
  }

  function renderOptionList(select, values, allLabel, selected) {
    const options = [`<option value="">${escapeHtml(allLabel)}</option>`]
      .concat(values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`));
    select.innerHTML = options.join('');
    select.value = values.includes(selected) ? selected : '';
  }

  function renderFilters() {
    const categories = uniqueSorted('category');
    const locations = uniqueSorted('location');
    const units = uniqueSorted('unit');
    if (state.category && !categories.includes(state.category)) state.category = '';
    if (state.location && !locations.includes(state.location)) state.location = '';
    renderOptionList(els.categoryFilter, categories, 'All categories', state.category);
    renderOptionList(els.locationFilter, locations, 'All locations', state.location);
    els.categoryOptions.innerHTML = categories.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    els.locationOptions.innerHTML = locations.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');
    els.unitOptions.innerHTML = [...new Set(['each', 'box', 'pack', 'case', 'roll', ...units])]
      .filter(Boolean)
      .map(value => `<option value="${escapeHtml(value)}"></option>`)
      .join('');
  }

  function statusLabel(item) {
    const status = itemStatus(item);
    if (status === 'out') return 'Out';
    if (status === 'low') return Number(item.quantity) === Number(item.minimum) ? 'At min' : 'Low';
    if (status === 'untracked') return 'No min';
    return 'OK';
  }

  function statusDetail(item) {
    if (!trackedMinimum(item)) return 'Set a minimum to track reorder risk.';
    if (itemStatus(item) === 'ok') return `${item.quantity - item.minimum} above minimum`;
    if (reorderNeed(item) > 0) return `${reorderNeed(item)} needed to reach minimum`;
    return 'At reorder point';
  }

  function renderTable() {
    const items = filteredItems();
    els.listSummary.textContent = `${items.length} of ${state.items.length} items shown`;
    if (!items.length) {
      els.tableWrap.innerHTML = `<div class="empty">${state.items.length ? 'No items match the current filters.' : 'No items yet. Add one clean item and build from there.'}</div>`;
      return;
    }

    els.tableWrap.innerHTML = `
      <div class="inventory-grid">
        ${items.map(item => {
          const status = itemStatus(item);
          return `
            <article class="inventory-card ${escapeHtml(status)}">
              <header class="card-head">
                <div class="card-title">
                  <strong class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
                  <span class="note">${escapeHtml([item.sku, item.category].filter(Boolean).join(' / ') || 'Uncategorized')}</span>
                </div>
                <span class="status-pill ${escapeHtml(status)}">${escapeHtml(statusLabel(item))}</span>
              </header>

              <div class="card-body">
                <section class="stock-block" aria-label="Quantity for ${escapeHtml(item.name)}">
                  <div class="qty-cell">
                    <button class="mini-btn icon-btn" type="button" data-action="adjust" data-delta="-1" data-id="${escapeHtml(item.id)}" aria-label="Decrease ${escapeHtml(item.name)}">-</button>
                    <strong class="qty">${item.quantity}</strong>
                    <button class="mini-btn icon-btn" type="button" data-action="adjust" data-delta="1" data-id="${escapeHtml(item.id)}" aria-label="Increase ${escapeHtml(item.name)}">+</button>
                  </div>
                  <div>
                    <span class="meta">${escapeHtml(item.unit || 'each')}</span>
                    <span class="stock-detail">${escapeHtml(statusDetail(item))}</span>
                  </div>
                </section>

                <dl class="item-facts">
                  <div>
                    <dt>Location</dt>
                    <dd>${escapeHtml(item.location || 'Unassigned')}</dd>
                  </div>
                  <div>
                    <dt>Supplier</dt>
                    <dd>${escapeHtml(item.supplier || 'None')}</dd>
                  </div>
                  <div>
                    <dt>Value</dt>
                    <dd>${money(itemValue(item))}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>${escapeHtml(shortDate(item.updatedAt))}</dd>
                  </div>
                </dl>
              </div>

              ${item.note ? `<p class="card-note">${escapeHtml(item.note)}</p>` : ''}

              <footer class="card-actions">
                <div class="action-main">
                  ${needsReorder(item) ? `<button class="btn compact" type="button" data-action="restock" data-id="${escapeHtml(item.id)}">Set to minimum</button>` : `<span class="action-spacer">${escapeHtml(item.minimum ? `Minimum ${item.minimum}` : 'No minimum set')}</span>`}
                </div>
                <div class="row-actions" aria-label="Item actions">
                  <button class="action-link" type="button" data-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>
                  <button class="action-link" type="button" data-action="duplicate" data-id="${escapeHtml(item.id)}">Copy</button>
                  <button class="action-link danger" type="button" data-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>
                </div>
              </footer>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  function render() {
    renderStats();
    renderFilters();
    renderTable();
  }

  els.form.addEventListener('submit', event => {
    event.preventDefault();
    saveFromForm();
  });
  els.resetForm.addEventListener('click', resetForm);
  els.searchInput.addEventListener('input', event => {
    state.query = event.target.value;
    renderTable();
  });
  els.statusFilter.addEventListener('change', event => {
    state.status = event.target.value;
    renderTable();
  });
  els.categoryFilter.addEventListener('change', event => {
    state.category = event.target.value;
    renderTable();
  });
  els.locationFilter.addEventListener('change', event => {
    state.location = event.target.value;
    renderTable();
  });
  els.sortSelect.addEventListener('change', event => {
    state.sort = event.target.value;
    renderTable();
  });
  els.resetFilters.addEventListener('click', resetFilters);
  els.sampleBtn.addEventListener('click', () => loadSample());
  els.exportBtn.addEventListener('click', exportItems);
  els.importInput.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) importItems(file);
    event.target.value = '';
  });
  els.clearBtn.addEventListener('click', requestClearItems);
  els.confirmModal.addEventListener('click', event => {
    if (event.target === els.confirmModal) closeConfirm();
  });

  document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    const { action, id } = target.dataset;
    if (action === 'adjust') adjustItem(id, Number(target.dataset.delta || 0));
    if (action === 'restock') restockItem(id);
    if (action === 'duplicate') duplicateItem(id);
    if (action === 'edit') editItem(id);
    if (action === 'delete') {
      openConfirm({
        action: 'delete',
        id,
        title: 'Delete item?',
        message: 'This removes the item from this browser.',
        confirmLabel: 'Delete'
      });
    }
    if (target.dataset.confirm === 'cancel') closeConfirm();
    if (target.dataset.confirm === 'delete') runConfirmAction();
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && els.confirmModal.classList.contains('open')) closeConfirm();
  });

  async function init() {
    await window.TDSStorage?.persist();
    state.items = await readItems();
    render();
  }

  init();
})();
