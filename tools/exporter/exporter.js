(() => {
  const state = {
    inputFormat: 'auto',
    outputFormat: 'csv',
    rows: [],
    fields: [],
    columns: [],
    draggedField: null,
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
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
    if (looksLikeMarkdownTable(trimmed)) return 'md';
    if (state.inputFormat !== 'auto') return state.inputFormat;
    const lines = sourceLines(trimmed);
    const firstLine = lines[0] || '';
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

    const headers = splitMarkdownRow(lines[headerIndex]).map((header, index) => header || `field_${index + 1}`);
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
    rows.forEach(row => {
      Object.keys(row).forEach(field => {
        if (!fields.includes(field)) fields.push(field);
      });
    });
    return fields;
  }

  function getColumn(field) {
    return state.columns.find(column => column.field === field) || { field, label: field };
  }

  function columnLabel(field) {
    const label = getColumn(field).label.trim();
    return label || field;
  }

  function selectedColumns() {
    return state.fields
      .filter(field => state.selectedFields.has(field))
      .map(field => ({ field, label: columnLabel(field) }));
  }

  function syncFields(nextFields) {
    const hadFields = state.fields.length > 0;
    const previousFields = new Set(state.fields);
    const previousSelected = new Set(state.selectedFields);
    const previousColumns = new Map(state.columns.map(column => [column.field, column]));
    const nextFieldSet = new Set(nextFields);
    const orderedFields = [
      ...state.fields.filter(field => nextFieldSet.has(field)),
      ...nextFields.filter(field => !previousFields.has(field))
    ];

    state.fields = orderedFields;
    state.columns = orderedFields.map(field => previousColumns.get(field) || { field, label: field });
    state.selectedFields = new Set(orderedFields.filter(field => (
      !hadFields || previousSelected.has(field) || !previousFields.has(field)
    )));
  }

  function rowsForExport() {
    const columns = selectedColumns();
    return state.rows.map(row => Object.fromEntries(columns.map(column => [
      column.label,
      normalizeCell(row[column.field])
    ])));
  }

  function toDelimited(rows, delimiter) {
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
    return toDelimited(state.rows, state.outputFormat === 'tsv' ? '\t' : ',');
  }

  function renderFields() {
    if (!state.fields.length) {
      els.fieldList.innerHTML = '<div class="empty">Paste data to choose fields.</div>';
      els.toggleFields.textContent = 'All';
      return;
    }

    els.fieldList.innerHTML = state.fields.map(field => `
      <div class="field-item" data-field="${escapeHtml(field)}">
        <button class="drag-handle" type="button" draggable="true" aria-label="Drag ${escapeHtml(field)}"></button>
        <input type="checkbox" value="${escapeHtml(field)}" aria-label="Include ${escapeHtml(field)}" ${state.selectedFields.has(field) ? 'checked' : ''}>
        <label>
          <span>${escapeHtml(field)}</span>
          <input type="text" value="${escapeHtml(columnLabel(field))}" data-rename="${escapeHtml(field)}" aria-label="Export name for ${escapeHtml(field)}">
        </label>
      </div>
    `).join('');
    els.toggleFields.textContent = state.selectedFields.size === state.fields.length ? 'None' : 'All';
  }

  function renderPreview() {
    const columns = selectedColumns();
    const rows = state.rows.slice(0, 50);
    els.previewCount.textContent = `${rows.length} shown`;

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
      if (parsed.format !== 'empty') setActiveButton('[data-format]', 'format', parsed.format);
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
    render();
  });
  els.fieldList.addEventListener('input', event => {
    const input = event.target.closest('[data-rename]');
    if (!input) return;
    const column = getColumn(input.dataset.rename);
    column.label = input.value;
    if (!state.columns.some(item => item.field === column.field)) state.columns.push(column);
    renderPreview();
    renderOutput();
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
    state.draggedField = null;
  });
  els.fieldList.addEventListener('dragend', () => {
    state.draggedField = null;
    clearDropMarkers();
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
