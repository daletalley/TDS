(() => {
  const PREFS_KEY = 'tds:exporter:column-prefs:v1';
  const PREVIEW_LIMIT = 50;
  const COMMON_ROW_KEYS = ['rows', 'records', 'items', 'data', 'results'];
  const state = {
    inputFormat: 'auto',
    outputFormat: 'csv',
    rows: [],
    fields: [],
    columns: [],
    columnPrefs: new Map(),
    draggedField: null,
    selectedFields: new Set(),
    fieldQuery: ''
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
    fieldSearch: $('#fieldSearch'),
    selectAllFields: $('#selectAllFields'),
    selectNoneFields: $('#selectNoneFields'),
    resetFields: $('#resetFields'),
    outputPreview: $('#outputPreview'),
    outputMeta: $('#outputMeta'),
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
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const byteSize = text => new Blob([text]).size;

  const uniqueHeaders = headers => {
    const seen = new Map();
    return headers.map((header, index) => {
      const fallback = `field_${index + 1}`;
      const base = String(header || '').replace(/^\uFEFF/, '').trim() || fallback;
      const key = fieldKey(base);
      const count = seen.get(key) || 0;
      seen.set(key, count + 1);
      return count ? `${base}_${count + 1}` : base;
    });
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
    if (looksLikeMarkdownTable(trimmed)) return 'md';
    const lines = sourceLines(trimmed);
    return scoreDelimiter(lines, '\t') > scoreDelimiter(lines, ',') ? 'tsv' : 'csv';
  }

  function scoreDelimiter(lines, delimiter) {
    return lines.slice(0, 8).reduce((score, line) => {
      let quoted = false;
      let count = 0;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"') {
          if (quoted && next === '"') index += 1;
          else quoted = !quoted;
        } else if (!quoted && char === delimiter) {
          count += 1;
        }
      }
      return score + count;
    }, 0);
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

    const headers = uniqueHeaders(rows[0]);
    return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
  }

  function parseJson(text) {
    const parsed = JSON.parse(text);
    const rowKey = COMMON_ROW_KEYS.find(key => Array.isArray(parsed?.[key]));
    const rowSource = Array.isArray(parsed)
      ? parsed
      : rowKey
        ? parsed[rowKey]
        : [parsed];
    return rowSource.map(normalizeJsonRow).filter(Boolean);
  }

  function normalizeJsonRow(row) {
    if (row === null || row === undefined) return null;
    if (typeof row !== 'object') return { value: row };
    if (Array.isArray(row)) return { value: row };
    return flattenObject(row);
  }

  function flattenObject(source, prefix = '', output = {}) {
    Object.entries(source).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        flattenObject(value, path, output);
      } else {
        output[path] = value;
      }
    });
    return output;
  }

  function splitMarkdownRow(line) {
    const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    const cells = [];
    let cell = '';
    let escaped = false;

    for (const char of trimmed) {
      if (escaped) {
        cell += char;
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '|') {
        cells.push(cell.trim().replace(/<br\s*\/?>/gi, '\n'));
        cell = '';
        continue;
      }
      cell += char;
    }

    cells.push(cell.trim().replace(/<br\s*\/?>/gi, '\n'));
    return cells;
  }

  function isMarkdownDivider(line) {
    const cells = splitMarkdownRow(line);
    return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
  }

  function sourceLines(text) {
    return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }

  function looksLikeMarkdownTable(text) {
    const lines = sourceLines(text);
    return lines.some((line, index) => line.includes('|') && lines[index + 1] && isMarkdownDivider(lines[index + 1]));
  }

  function parseMarkdown(text) {
    const lines = sourceLines(text);
    const headerIndex = lines.findIndex((line, index) => line.includes('|') && lines[index + 1] && isMarkdownDivider(lines[index + 1]));
    if (headerIndex < 0) return [];

    const headers = uniqueHeaders(splitMarkdownRow(lines[headerIndex]));
    return lines
      .slice(headerIndex + 2)
      .filter(line => line.includes('|') && !isMarkdownDivider(line))
      .map(line => {
        const values = splitMarkdownRow(line);
        return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
      });
  }

  function parseInput() {
    const text = els.sourceInput.value;
    const format = detectFormat(text);
    if (format === 'empty') return { rows: [], message: 'Waiting for data.' };
    const rows = format === 'json'
      ? parseJson(text)
      : format === 'md'
        ? parseMarkdown(text)
        : parseDelimited(text, format === 'tsv' ? '\t' : ',');
    return { format, rows, message: `Parsed ${rows.length} row${rows.length === 1 ? '' : 's'} as ${format.toUpperCase()}.` };
  }

  function collectFields(rows) {
    const fields = [];
    const seen = new Set();
    rows.forEach(row => {
      Object.keys(row).forEach(field => {
        if (seen.has(field)) return;
        seen.add(field);
        fields.push(field);
      });
    });
    return fields;
  }

  function fieldKey(field) {
    return String(field || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function rememberColumn(field, updates = {}) {
    const key = fieldKey(field);
    const existing = state.columnPrefs.get(key) || {
      field,
      label: field,
      selected: true,
      order: state.columnPrefs.size
    };
    const next = { ...existing, field, ...updates };
    state.columnPrefs.set(key, next);
    return next;
  }

  async function loadColumnPrefs() {
    try {
      const prefs = window.TDSStorage
        ? await window.TDSStorage.get(PREFS_KEY, [])
        : JSON.parse(localStorage.getItem(PREFS_KEY) || '[]');
      if (!Array.isArray(prefs)) return;
      state.columnPrefs = new Map(prefs
        .filter(pref => pref && typeof pref.field === 'string')
        .map(pref => [fieldKey(pref.field), {
          field: pref.field,
          label: typeof pref.label === 'string' ? pref.label : pref.field,
          selected: pref.selected !== false,
          order: Number.isFinite(pref.order) ? pref.order : 0
        }]));
    } catch {
      state.columnPrefs = new Map();
    }
  }

  function saveColumnPrefs() {
    const prefs = [...state.columnPrefs.values()];
    if (window.TDSStorage) {
      window.TDSStorage.set(PREFS_KEY, prefs);
      return;
    }
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Exporter can still work for the current session.
    }
  }

  function getColumn(field) {
    return state.columns.find(column => column.field === field) || rememberColumn(field);
  }

  function columnLabel(field) {
    const label = getColumn(field).label.trim();
    return label || field;
  }

  function selectedColumns() {
    const seen = new Map();
    return state.fields
      .filter(field => state.selectedFields.has(field))
      .map(field => {
        const label = columnLabel(field);
        const count = seen.get(label) || 0;
        seen.set(label, count + 1);
        return { field, label: count ? `${label}_${count + 1}` : label };
      });
  }

  function syncFields(nextFields) {
    const hadFields = state.fields.length > 0;
    const hadPrefs = state.columnPrefs.size > 0;
    state.fields.forEach((field, index) => {
      rememberColumn(field, {
        label: columnLabel(field),
        selected: state.selectedFields.has(field),
        order: index
      });
    });

    const previousFieldKeys = new Set(state.fields.map(fieldKey));
    const nextFieldKeys = new Set(nextFields.map(fieldKey));
    const nextFieldSet = new Set(nextFields);
    const orderedFields = [
      ...state.fields.filter(field => nextFieldSet.has(field)),
      ...nextFields.filter(field => !previousFieldKeys.has(fieldKey(field)))
    ].filter(field => nextFieldKeys.has(fieldKey(field)));

    nextFields.forEach(field => {
      if (!orderedFields.some(item => fieldKey(item) === fieldKey(field))) {
        orderedFields.push(field);
      }
    });

    orderedFields.sort((a, b) => {
      const aPref = state.columnPrefs.get(fieldKey(a));
      const bPref = state.columnPrefs.get(fieldKey(b));
      return (aPref?.order ?? Number.MAX_SAFE_INTEGER) - (bPref?.order ?? Number.MAX_SAFE_INTEGER);
    });

    state.fields = orderedFields;
    state.columns = orderedFields.map(field => rememberColumn(field));
    state.selectedFields = new Set(orderedFields.filter(field => (
      (!hadFields && !hadPrefs) || getColumn(field).selected
    )));
  }

  function rowsForExport() {
    const columns = selectedColumns();
    return state.rows.map(row => Object.fromEntries(columns.map(column => [
      column.label,
      normalizeCell(row[column.field])
    ])));
  }

  function toDelimited(delimiter) {
    const columns = selectedColumns();
    const escapeCell = value => {
      const text = normalizeCell(value);
      const mustQuote = text.includes(delimiter) || text.includes('"') || /[\r\n]/.test(text);
      const escaped = text.replace(/"/g, '""');
      return mustQuote ? `"${escaped}"` : escaped;
    };
    return [
      columns.map(column => escapeCell(column.label)).join(delimiter),
      ...state.rows.map(row => columns.map(column => escapeCell(row[column.field])).join(delimiter))
    ].join('\n');
  }

  function toMarkdown() {
    const columns = selectedColumns();
    const escapeCell = value => normalizeCell(value)
      .replace(/\r?\n/g, '<br>')
      .replace(/\|/g, '\\|')
      .trim();
    const header = `| ${columns.map(column => escapeCell(column.label)).join(' | ')} |`;
    const divider = `| ${columns.map(() => '---').join(' | ')} |`;
    const body = state.rows.map(row => `| ${columns.map(column => escapeCell(row[column.field])).join(' | ')} |`);
    return [header, divider, ...body].join('\n');
  }

  function outputText() {
    if (!state.rows.length || !selectedColumns().length) return '';
    if (state.outputFormat === 'json') return JSON.stringify(rowsForExport(), null, 2);
    if (state.outputFormat === 'md') return toMarkdown();
    return toDelimited(state.outputFormat === 'tsv' ? '\t' : ',');
  }

  function visibleFields() {
    const query = state.fieldQuery.trim().toLowerCase();
    if (!query) return state.fields;
    return state.fields.filter(field => {
      const label = columnLabel(field);
      return `${field} ${label}`.toLowerCase().includes(query);
    });
  }

  function renderFields() {
    if (!state.fields.length) {
      els.fieldList.innerHTML = '<div class="empty">Paste data to choose fields.</div>';
      els.fieldSearch.disabled = true;
      els.selectAllFields.disabled = true;
      els.selectNoneFields.disabled = true;
      els.resetFields.disabled = true;
      return;
    }

    els.fieldSearch.disabled = false;
    els.selectAllFields.disabled = false;
    els.selectNoneFields.disabled = false;
    els.resetFields.disabled = false;

    const fields = visibleFields();
    if (!fields.length) {
      els.fieldList.innerHTML = '<div class="empty">No matching columns.</div>';
      return;
    }

    els.fieldList.innerHTML = fields.map(field => `
      <div class="field-item" data-field="${escapeHtml(field)}">
        <button class="drag-handle" type="button" draggable="true" aria-label="Drag ${escapeHtml(field)}"></button>
        <input type="checkbox" value="${escapeHtml(field)}" aria-label="Include ${escapeHtml(field)}" ${state.selectedFields.has(field) ? 'checked' : ''}>
        <label>
          <span>${escapeHtml(field)}</span>
          <input type="text" value="${escapeHtml(columnLabel(field))}" data-rename="${escapeHtml(field)}" aria-label="Export name for ${escapeHtml(field)}">
        </label>
      </div>
    `).join('');
  }

  function renderPreview() {
    const columns = selectedColumns();
    const rows = state.rows.slice(0, PREVIEW_LIMIT);
    els.previewCount.textContent = state.rows.length > rows.length
      ? `${rows.length} of ${state.rows.length} shown`
      : `${rows.length} shown`;

    if (!rows.length || !columns.length) {
      els.tableWrap.innerHTML = '<div class="empty">Parsed rows will show here.</div>';
      return;
    }

    els.tableWrap.innerHTML = `
      <table>
        <thead>
          <tr>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>${columns.map(column => `<td data-label="${escapeHtml(column.label)}" title="${escapeHtml(normalizeCell(row[column.field]))}">${escapeHtml(normalizeCell(row[column.field]))}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function renderOutput() {
    const text = outputText();
    els.outputPreview.textContent = text || 'No export yet.';
    els.outputMeta.textContent = text ? `${byteSize(text).toLocaleString()} bytes` : '0 bytes';
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
      syncFields(collectFields(state.rows));
      els.statusText.textContent = parsed.message;
      setActiveButton('[data-format]', 'format', state.inputFormat);
    } catch (error) {
      state.rows = [];
      state.fields = [];
      state.columns = [];
      state.selectedFields.clear();
      els.statusText.textContent = error.message || 'Could not parse input.';
    }
    render();
  }

  function clearDropMarkers() {
    els.fieldList.querySelectorAll('.drop-before,.drop-after,.dragging').forEach(item => {
      item.classList.remove('drop-before', 'drop-after', 'dragging');
    });
  }

  function moveField(draggedField, targetField, placeAfter) {
    if (!draggedField || !targetField || draggedField === targetField) return;
    const fields = state.fields.filter(field => field !== draggedField);
    const targetIndex = fields.indexOf(targetField);
    if (targetIndex < 0) return;
    fields.splice(targetIndex + (placeAfter ? 1 : 0), 0, draggedField);
    state.fields = fields;
    state.columns = fields.map(getColumn);
    fields.forEach((field, index) => rememberColumn(field, { order: index }));
    render();
  }

  function persistCurrentColumns() {
    state.fields.forEach((field, index) => {
      rememberColumn(field, {
        label: columnLabel(field),
        selected: state.selectedFields.has(field),
        order: index
      });
    });
    saveColumnPrefs();
  }

  function resetCurrentColumns() {
    state.fields.forEach((field, index) => {
      rememberColumn(field, {
        label: field,
        selected: true,
        order: index
      });
    });
    state.columns = state.fields.map(field => state.columnPrefs.get(fieldKey(field)));
    state.selectedFields = new Set(state.fields);
    saveColumnPrefs();
    render();
  }

  function setActiveButton(selector, key, value) {
    document.querySelectorAll(selector).forEach(button => {
      button.classList.toggle('active', button.dataset[key] === value);
    });
  }

  function mimeType() {
    if (state.outputFormat === 'json') return 'application/json';
    if (state.outputFormat === 'csv') return 'text/csv';
    if (state.outputFormat === 'tsv') return 'text/tab-separated-values';
    return 'text/markdown';
  }

  function safeFilename(value) {
    return (value.trim() || 'tds-export')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/^\.+|\.+$/g, '') || 'tds-export';
  }

  function downloadExport() {
    const text = outputText();
    if (!text) {
      notify('Nothing to download.');
      return;
    }
    const extension = state.outputFormat;
    const safeName = safeFilename(els.filenameInput.value);
    const blob = new Blob([text], { type: `${mimeType()};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.${extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function copyExport() {
    const text = outputText();
    if (!text) {
      notify('Nothing to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied export.');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(els.outputPreview);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      notify('Copy blocked. Export selected.');
    }
  }

  els.sourceInput.addEventListener('input', updateFromInput);
  els.sampleBtn.addEventListener('click', () => {
    els.sourceInput.value = sample;
    state.inputFormat = 'auto';
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
    rememberColumn(event.target.value, { selected: event.target.checked });
    saveColumnPrefs();
    render();
  });
  els.fieldList.addEventListener('input', event => {
    const input = event.target.closest('[data-rename]');
    if (!input) return;
    const column = getColumn(input.dataset.rename);
    column.label = input.value;
    rememberColumn(input.dataset.rename, { label: input.value });
    saveColumnPrefs();
    if (!state.columns.some(item => item.field === column.field)) state.columns.push(column);
    renderPreview();
    renderOutput();
  });
  els.fieldSearch.addEventListener('input', event => {
    state.fieldQuery = event.target.value;
    renderFields();
  });
  els.fieldList.addEventListener('dragstart', event => {
    const handle = event.target.closest('.drag-handle');
    const item = handle?.closest('.field-item');
    if (!handle || !item) return;
    state.draggedField = item.dataset.field;
    item.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', state.draggedField);
  });
  els.fieldList.addEventListener('dragover', event => {
    const item = event.target.closest('.field-item');
    if (!item || !state.draggedField) return;
    event.preventDefault();
    clearDropMarkers();
    const rect = item.getBoundingClientRect();
    item.classList.add(event.clientY > rect.top + rect.height / 2 ? 'drop-after' : 'drop-before');
  });
  els.fieldList.addEventListener('drop', event => {
    const item = event.target.closest('.field-item');
    if (!item || !state.draggedField) return;
    event.preventDefault();
    const placeAfter = item.classList.contains('drop-after');
    const draggedField = event.dataTransfer.getData('text/plain') || state.draggedField;
    clearDropMarkers();
    moveField(draggedField, item.dataset.field, placeAfter);
    saveColumnPrefs();
    state.draggedField = null;
  });
  els.fieldList.addEventListener('dragend', () => {
    state.draggedField = null;
    clearDropMarkers();
  });
  els.selectAllFields.addEventListener('click', () => {
    state.selectedFields = new Set(state.fields);
    persistCurrentColumns();
    render();
  });
  els.selectNoneFields.addEventListener('click', () => {
    state.selectedFields = new Set();
    persistCurrentColumns();
    render();
  });
  els.resetFields.addEventListener('click', resetCurrentColumns);
  els.copyBtn.addEventListener('click', () => {
    copyExport();
  });
  els.downloadBtn.addEventListener('click', downloadExport);

  async function init() {
    await window.TDSStorage?.persist();
    await loadColumnPrefs();
    render();
  }

  init();
})();
