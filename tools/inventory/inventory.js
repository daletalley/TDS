(() => {
  const STORE_KEY = 'tds:inventory:v1';
  const state = {
    items: [],
    editingId: '',
    deletingId: '',
    query: '',
    status: 'all',
    sort: 'updated'
  };

  const $ = selector => document.querySelector(selector);
  const els = {
    itemCount: $('#itemCount'),
    lowCount: $('#lowCount'),
    valueCount: $('#valueCount'),
    exportBtn: $('#exportBtn'),
    importInput: $('#importInput'),
    form: $('#itemForm'),
    formTitle: $('#formTitle'),
    formStatus: $('#formStatus'),
    resetForm: $('#resetForm'),
    tableWrap: $('#tableWrap'),
    searchInput: $('#searchInput'),
    statusFilter: $('#statusFilter'),
    sortSelect: $('#sortSelect'),
    sampleBtn: $('#sampleBtn'),
    confirmModal: $('#confirmModal'),
    toast: $('#toast')
  };

  const fields = {
    name: $('#nameInput'),
    category: $('#categoryInput'),
    location: $('#locationInput'),
    quantity: $('#quantityInput'),
    minimum: $('#minimumInput'),
    unit: $('#unitInput'),
    cost: $('#costInput'),
    note: $('#noteInput')
  };

  const sampleItems = [
    { name: 'Shop towels', category: 'Supplies', location: 'Shelf A', quantity: 18, minimum: 6, unit: 'pack', cost: 8.5, note: 'Keep near detail bay.' },
    { name: 'Nitrile gloves', category: 'Safety', location: 'Cabinet 2', quantity: 4, minimum: 8, unit: 'box', cost: 12.25, note: 'Medium black gloves.' },
    { name: 'Printer paper', category: 'Office', location: 'Desk', quantity: 9, minimum: 3, unit: 'ream', cost: 6.75, note: '' }
  ];

  const now = () => new Date().toISOString();
  const uid = () => `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const money = value => Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const itemValue = item => Number(item.quantity || 0) * Number(item.cost || 0);
  const isLow = item => Number(item.quantity || 0) <= Number(item.minimum || 0) && Number(item.minimum || 0) > 0;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

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

  function normalizeItem(item) {
    if (!item || typeof item !== 'object') return null;
    const createdAt = item.createdAt || now();
    const name = String(item.name || '').trim();
    if (!name) return null;
    return {
      id: String(item.id || uid()),
      name,
      category: String(item.category || '').trim(),
      location: String(item.location || '').trim(),
      quantity: Math.round(normalizeNumber(item.quantity)),
      minimum: Math.round(normalizeNumber(item.minimum)),
      unit: String(item.unit || '').trim(),
      cost: normalizeNumber(item.cost),
      note: String(item.note || '').trim(),
      createdAt,
      updatedAt: item.updatedAt || createdAt
    };
  }

  function readLegacyItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(normalizeItem).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  async function readItems() {
    try {
      const parsed = await window.TDSStorage?.get(STORE_KEY, readLegacyItems()) ?? readLegacyItems();
      return Array.isArray(parsed) ? parsed.map(normalizeItem).filter(Boolean) : [];
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
    if (saved === false) {
      notify('Unable to save inventory on this device.');
    }
  }

  function filteredItems() {
    const query = state.query.trim().toLowerCase();
    return state.items
      .filter(item => {
        if (state.status === 'low' && !isLow(item)) return false;
        if (state.status === 'ok' && isLow(item)) return false;
        if (!query) return true;
        return [item.name, item.category, item.location, item.unit, item.note].join(' ').toLowerCase().includes(query);
      })
      .sort((a, b) => {
        if (state.sort === 'name') return a.name.localeCompare(b.name);
        if (state.sort === 'quantity') return a.quantity - b.quantity;
        if (state.sort === 'value') return itemValue(b) - itemValue(a);
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

  function saveFromForm() {
    try {
      const item = itemFromForm();
      const index = state.items.findIndex(current => current.id === item.id);
      if (index >= 0) state.items.splice(index, 1, item);
      else state.items.unshift(item);
      saveItems();
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
    fields.category.value = item.category;
    fields.location.value = item.location;
    fields.quantity.value = item.quantity;
    fields.minimum.value = item.minimum;
    fields.unit.value = item.unit;
    fields.cost.value = item.cost || '';
    fields.note.value = item.note;
    fields.name.focus();
  }

  function adjustItem(id, delta) {
    const item = state.items.find(current => current.id === id);
    if (!item) return;
    item.quantity = Math.max(0, item.quantity + delta);
    item.updatedAt = now();
    saveItems();
    render();
  }

  function openConfirm(id) {
    state.deletingId = id;
    els.confirmModal.classList.add('open');
    els.confirmModal.setAttribute('aria-hidden', 'false');
  }

  function closeConfirm() {
    state.deletingId = '';
    els.confirmModal.classList.remove('open');
    els.confirmModal.setAttribute('aria-hidden', 'true');
  }

  function deleteItem() {
    state.items = state.items.filter(item => item.id !== state.deletingId);
    if (state.editingId === state.deletingId) resetForm();
    saveItems();
    closeConfirm();
    render();
    notify('Item deleted.');
  }

  function exportItems() {
    const blob = new Blob([JSON.stringify(state.items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tds-inventory.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function importItems(file) {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]'));
        const items = Array.isArray(parsed) ? parsed.map(normalizeItem).filter(Boolean) : [];
        if (!items.length) throw new Error('No valid items found.');
        state.items = items;
        saveItems();
        resetForm();
        render();
        notify('Inventory imported.');
      } catch (error) {
        notify(error.message || 'Import failed.');
      }
    });
    reader.readAsText(file);
  }

  function loadSample() {
    state.items = sampleItems.map(item => normalizeItem({ ...item, id: uid(), createdAt: now(), updatedAt: now() }));
    saveItems();
    resetForm();
    render();
    notify('Sample loaded.');
  }

  function renderStats() {
    els.itemCount.textContent = String(state.items.length);
    els.lowCount.textContent = String(state.items.filter(isLow).length);
    els.valueCount.textContent = money(state.items.reduce((total, item) => total + itemValue(item), 0));
  }

  function renderTable() {
    const items = filteredItems();
    if (!items.length) {
      els.tableWrap.innerHTML = `<div class="empty">${state.items.length ? 'No items match the current filters.' : 'No items yet. Add one clean item and build from there.'}</div>`;
      return;
    }

    els.tableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Status</th>
            <th>Qty</th>
            <th>Min</th>
            <th>Location</th>
            <th>Value</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td data-label="Item">
                <strong class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
                <span class="note">${escapeHtml([item.category, item.note].filter(Boolean).join(' / ') || 'Uncategorized')}</span>
              </td>
              <td data-label="Status"><span class="status-pill ${isLow(item) ? 'low' : 'ok'}">${isLow(item) ? 'Low' : 'OK'}</span></td>
              <td data-label="Quantity">
                <div class="qty-cell">
                  <button class="mini-btn" type="button" data-action="adjust" data-delta="-1" data-id="${item.id}" aria-label="Decrease ${escapeHtml(item.name)}">−</button>
                  <strong class="qty">${item.quantity}</strong>
                  <button class="mini-btn" type="button" data-action="adjust" data-delta="1" data-id="${item.id}" aria-label="Increase ${escapeHtml(item.name)}">+</button>
                  <span class="meta">${escapeHtml(item.unit || 'each')}</span>
                </div>
              </td>
              <td data-label="Minimum">${item.minimum}</td>
              <td data-label="Location">${escapeHtml(item.location || '—')}</td>
              <td data-label="Value">${money(itemValue(item))}</td>
              <td data-label="Actions">
                <div class="row-actions">
                  <button class="mini-btn" type="button" data-action="edit" data-id="${item.id}">Edit</button>
                  <button class="mini-btn danger" type="button" data-action="delete" data-id="${item.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function render() {
    renderStats();
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
  els.sortSelect.addEventListener('change', event => {
    state.sort = event.target.value;
    renderTable();
  });
  els.sampleBtn.addEventListener('click', loadSample);
  els.exportBtn.addEventListener('click', exportItems);
  els.importInput.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) importItems(file);
    event.target.value = '';
  });

  document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    const { action, id } = target.dataset;
    if (action === 'adjust') adjustItem(id, Number(target.dataset.delta || 0));
    if (action === 'edit') editItem(id);
    if (action === 'delete') openConfirm(id);
    if (target.dataset.confirm === 'cancel') closeConfirm();
    if (target.dataset.confirm === 'delete') deleteItem();
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
