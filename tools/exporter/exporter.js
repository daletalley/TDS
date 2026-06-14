(() => {
  const state = {
    inputFormat: 'auto',
    outputFormat: 'csv',
    rows: [],
    fields: [],
    selectedFields: new Set()
  };

  const $ = selector => document.querySelector(selector);
  const els = {
    fileInput: $('#fileInput'),
    clearBtn: $('#clearBtn'),
    sampleBtn: $('#sampleBtn'),
    sourceInput: $('#sourceInput'),
    statusText: $('#statusText'),
    rowCount: $('#rowCount'),
    fieldCount: $('#fieldCount'),
    fieldList: $('#fieldList'),
    toggleFields: $('#toggleFields'),
    outputPreview: $('#outputPreview'),
    previewCount: $('#previewCount'),
    tableWrap: $('#tableWrap'),
    filenameInput: $('#filenameInput'),
    copyBtn: $('#copyBtn'),
    downloadBtn: $('#downloadBtn'),
    toast: $('#toast')
  };

  const sample = `name,status,type,owner
Spaces,live,workflow,Talley Digital Studio
Cookbook,live,recipe library,Talley Digital Studio
Exporter,live,data handoff,Talley Digital Studio`;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const normalizeCell = value => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  function notify(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function detectFormat(text) {
    const trimmed = text.trim();
    if (!trimmed) return 'empty';
    if (state.inputFormat !== 'auto') return state.inputFormat;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    const firstLine = trimmed.split(/\r?\n/, 1)[0] || '';
    return firstLine.includes('\t') ? 'tsv' : 'csv';
  }

  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];

      if (char === '"') {
        if (quoted && next === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (!quoted && char === delimiter) {
        row.push(cell);
        cell = '';
        continue;
      }

      if (!quoted && (char === '\n' || char === '\r')) {
        if (char === '\r' && next === '\n') index += 1;
        row.push(cell);
        if (row.some(value => value.trim() !== '')) rows.push(row);
        row = [];
        cell = '';
        continue;
      }

      cell += char;
    }

    row.push(cell);
    if (row.some(value => value.trim() !== '')) rows.push(row);
    if (!rows.length) return [];

    const headers = rows[0].map((header, index) => header.trim() || `field_${index + 1}`);
    return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  function parseJson(text) {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.filter(row => row && typeof row === 'object' && !Array.isArray(row));
  }

  function parseInput() {
    const text = els.sourceInput.value;
    const format = detectFormat(text);
    if (format === 'empty') return { rows: [], message: 'Waiting for data.' };
    const rows = format === 'json' ? parseJson(text) : parseDelimited(text, format === 'tsv' ? '\t' : ',');
    return { rows, message: `Parsed ${rows.length} row${rows.length === 1 ? '' : 's'} as ${format.toUpperCase()}.` };
  }

  function collectFields(rows) {
    const fields = [];
    rows.forEach(row => {
      Object.keys(row).forEach(field => {
        if (!fields.includes(field)) fields.push(field);
      });
    });
    return fields;
  }

  function selectedFields() {
    return state.fields.filter(field => state.selectedFields.has(field));
  }

  function rowsForExport() {
    const fields = selectedFields();
    return state.rows.map(row => Object.fromEntries(fields.map(field => [field, normalizeCell(row[field])])));
  }

  function toDelimited(rows, delimiter) {
    const fields = selectedFields();
    const escapeCell = value => {
      const text = normalizeCell(value);
      const mustQuote = text.includes(delimiter) || text.includes('"') || /[\r\n]/.test(text);
      const escaped = text.replace(/"/g, '""');
      return mustQuote ? `"${escaped}"` : escaped;
    };
    return [
      fields.map(escapeCell).join(delimiter),
      ...state.rows.map(row => fields.map(field => escapeCell(row[field])).join(delimiter))
    ].join('\n');
  }

  function outputText() {
    if (!state.rows.length || !selectedFields().length) return '';
    if (state.outputFormat === 'json') return JSON.stringify(rowsForExport(), null, 2);
    return toDelimited(state.rows, state.outputFormat === 'tsv' ? '\t' : ',');
  }

  function renderFields() {
    if (!state.fields.length) {
      els.fieldList.innerHTML = '<div class="empty">Paste data to choose fields.</div>';
      els.toggleFields.textContent = 'All';
      return;
    }

    els.fieldList.innerHTML = state.fields.map(field => `
      <label class="field-item">
        <input type="checkbox" value="${escapeHtml(field)}" ${state.selectedFields.has(field) ? 'checked' : ''}>
        <strong>${escapeHtml(field)}</strong>
      </label>
    `).join('');
    els.toggleFields.textContent = state.selectedFields.size === state.fields.length ? 'None' : 'All';
  }

  function renderPreview() {
    const fields = selectedFields();
    const rows = state.rows.slice(0, 50);
    els.previewCount.textContent = `${rows.length} shown`;

    if (!rows.length || !fields.length) {
      els.tableWrap.innerHTML = '<div class="empty">Parsed rows will show here.</div>';
      return;
    }

    els.tableWrap.innerHTML = `
      <table>
        <thead>
          <tr>${fields.map(field => `<th>${escapeHtml(field)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>${fields.map(field => `<td title="${escapeHtml(normalizeCell(row[field]))}">${escapeHtml(normalizeCell(row[field]))}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderOutput() {
    const text = outputText();
    els.outputPreview.textContent = text || 'No export yet.';
  }

  function render() {
    els.rowCount.textContent = String(state.rows.length);
    els.fieldCount.textContent = String(state.fields.length);
    renderFields();
    renderPreview();
    renderOutput();
  }

  function updateFromInput() {
    try {
      const parsed = parseInput();
      state.rows = parsed.rows;
      state.fields = collectFields(state.rows);
      state.selectedFields = new Set(state.fields);
      els.statusText.textContent = parsed.message;
    } catch (error) {
      state.rows = [];
      state.fields = [];
      state.selectedFields.clear();
      els.statusText.textContent = error.message || 'Could not parse input.';
    }
    render();
  }

  function setActiveButton(selector, key, value) {
    document.querySelectorAll(selector).forEach(button => {
      button.classList.toggle('active', button.dataset[key] === value);
    });
  }

  function downloadExport() {
    const text = outputText();
    if (!text) {
      notify('Nothing to download.');
      return;
    }
    const extension = state.outputFormat;
    const safeName = (els.filenameInput.value.trim() || 'tds-export').replace(/[^\w.-]+/g, '-');
    const type = state.outputFormat === 'json' ? 'application/json' : 'text/plain';
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  els.sourceInput.addEventListener('input', updateFromInput);
  els.sampleBtn.addEventListener('click', () => {
    els.sourceInput.value = sample;
    state.inputFormat = 'csv';
    setActiveButton('[data-format]', 'format', state.inputFormat);
    updateFromInput();
  });
  els.clearBtn.addEventListener('click', () => {
    els.sourceInput.value = '';
    updateFromInput();
  });
  els.fileInput.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      els.sourceInput.value = String(reader.result || '');
      els.filenameInput.value = file.name.replace(/\.[^.]+$/, '') || 'tds-export';
      updateFromInput();
    });
    reader.readAsText(file);
    event.target.value = '';
  });
  document.addEventListener('click', event => {
    const formatButton = event.target.closest('[data-format]');
    const outputButton = event.target.closest('[data-output]');
    if (formatButton) {
      state.inputFormat = formatButton.dataset.format;
      setActiveButton('[data-format]', 'format', state.inputFormat);
      updateFromInput();
    }
    if (outputButton) {
      state.outputFormat = outputButton.dataset.output;
      setActiveButton('[data-output]', 'output', state.outputFormat);
      renderOutput();
    }
  });
  els.fieldList.addEventListener('change', event => {
    if (!event.target.matches('input[type="checkbox"]')) return;
    if (event.target.checked) state.selectedFields.add(event.target.value);
    else state.selectedFields.delete(event.target.value);
    render();
  });
  els.toggleFields.addEventListener('click', () => {
    state.selectedFields = state.selectedFields.size === state.fields.length ? new Set() : new Set(state.fields);
    render();
  });
  els.copyBtn.addEventListener('click', async () => {
    const text = outputText();
    if (!text) {
      notify('Nothing to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied export.');
    } catch {
      notify('Copy blocked by browser.');
    }
  });
  els.downloadBtn.addEventListener('click', downloadExport);

  render();
})();
