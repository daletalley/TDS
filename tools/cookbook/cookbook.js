(() => {
  const STORE_KEY = 'tds:cookbook:recipes:v1';
  const SCALE_OPTIONS = [0.5, 1, 1.5, 2, 3];

  const state = {
    recipes: [],
    selectedId: '',
    editingId: '',
    deletingId: '',
    query: '',
    category: '',
    tag: '',
    sort: 'updated',
    scale: 1
  };

  const draftRows = {
    ingredients: [],
    steps: []
  };

  const sampleRecipes = [
    {
      title: 'Lemon Pantry Pasta',
      category: 'Dinner',
      servings: '4 servings',
      prepTime: '10 min',
      cookTime: '18 min',
      tags: ['weeknight', 'vegetarian'],
      ingredients: [
        '12 oz spaghetti',
        '2 lemons, zested and juiced',
        '3 tbsp olive oil',
        '1/2 cup grated parmesan',
        '1/4 cup chopped parsley',
        '1 tsp black pepper'
      ],
      steps: [
        'Boil the pasta in salted water until just tender, reserving 1 cup of pasta water.',
        'Whisk lemon zest, lemon juice, olive oil, parmesan, and pepper in a wide pan.',
        'Toss pasta through the sauce, loosening with pasta water until glossy.',
        'Finish with parsley and more parmesan before serving.'
      ],
      notes: 'Add a handful of arugula at the end if dinner needs greens.'
    },
    {
      title: 'Saturday Pancakes',
      category: 'Breakfast',
      servings: '10 pancakes',
      prepTime: '12 min',
      cookTime: '18 min',
      tags: ['brunch', 'kid-friendly'],
      ingredients: [
        '1 1/2 cups all-purpose flour',
        '2 tbsp sugar',
        '2 tsp baking powder',
        '1/2 tsp kosher salt',
        '1 1/4 cups milk',
        '2 eggs',
        '3 tbsp melted butter'
      ],
      steps: [
        'Whisk the dry ingredients in one bowl and the wet ingredients in another.',
        'Fold wet into dry just until no dry streaks remain, leaving a few lumps.',
        'Cook on a buttered griddle until bubbles set, then flip and finish.'
      ],
      notes: 'Hold pancakes on a sheet pan in a 200 F oven.'
    },
    {
      title: 'Red Sauce Base',
      category: 'Sauce',
      servings: '6 cups',
      prepTime: '15 min',
      cookTime: '45 min',
      tags: ['batch', 'freezer'],
      ingredients: [
        '2 tbsp olive oil',
        '1 onion, diced',
        '4 garlic cloves, sliced',
        '28 oz crushed tomatoes',
        '1 tsp kosher salt',
        '1/2 tsp chili flakes'
      ],
      steps: [
        'Sweat onion in olive oil until soft and lightly golden around the edges.',
        'Add garlic and chili flakes, cooking briefly until fragrant.',
        'Stir in tomatoes and salt, then simmer until thickened and balanced.',
        'Cool before refrigerating or freezing in labeled containers.'
      ],
      notes: 'Blend smooth for pizza sauce.'
    }
  ];

  const $ = selector => document.querySelector(selector);
  const els = {
    newRecipe: $('#newRecipe'),
    exportRecipes: $('#exportRecipes'),
    importRecipes: $('#importRecipes'),
    recipeCount: $('#recipeCount'),
    tagCount: $('#tagCount'),
    categoryCount: $('#categoryCount'),
    readyCount: $('#readyCount'),
    visibleCount: $('#visibleCount'),
    searchInput: $('#searchInput'),
    categoryFilter: $('#categoryFilter'),
    tagFilter: $('#tagFilter'),
    sortSelect: $('#sortSelect'),
    clearFilters: $('#clearFilters'),
    recipeList: $('#recipeList'),
    recipeDetail: $('#recipeDetail'),
    editorModal: $('#editorModal'),
    recipeForm: $('#recipeForm'),
    editorTitle: $('#editorTitle'),
    formStatus: $('#formStatus'),
    confirmModal: $('#confirmModal'),
    toast: $('#toast')
  };

  const fields = {
    title: $('#titleInput'),
    category: $('#categoryInput'),
    servings: $('#servingsInput'),
    prepTime: $('#prepInput'),
    cookTime: $('#cookInput'),
    tags: $('#tagsInput'),
    ingredientRows: $('#ingredientRows'),
    stepRows: $('#stepRows'),
    addIngredient: $('#addIngredient'),
    addStep: $('#addStep'),
    notes: $('#notesInput')
  };

  const now = () => new Date().toISOString();
  const uid = () => `recipe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const rowId = () => `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
  const splitTags = value => [...new Set(String(value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean))];
  const titleCase = value => value.replace(/\b\w/g, char => char.toUpperCase());
  const normalizeKey = value => String(value || '').trim().toLowerCase();
  const cleanText = values => values.map(value => String(value || '').trim()).filter(Boolean);

  function notify(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function normalizeRecipe(recipe) {
    if (!recipe || typeof recipe !== 'object') return null;
    const createdAt = recipe.createdAt || now();
    const title = String(recipe.title || '').trim();
    return {
      id: String(recipe.id || uid()),
      title,
      category: String(recipe.category || '').trim(),
      servings: String(recipe.servings || '').trim(),
      prepTime: String(recipe.prepTime || '').trim(),
      cookTime: String(recipe.cookTime || '').trim(),
      tags: Array.isArray(recipe.tags) ? splitTags(recipe.tags.join(',')) : splitTags(recipe.tags || ''),
      ingredients: Array.isArray(recipe.ingredients) ? cleanText(recipe.ingredients) : [],
      steps: Array.isArray(recipe.steps) ? cleanText(recipe.steps) : [],
      notes: String(recipe.notes || '').trim(),
      createdAt,
      updatedAt: recipe.updatedAt || createdAt
    };
  }

  function isUsableRecipe(recipe) {
    return Boolean(recipe?.title && recipe.ingredients?.length && recipe.steps?.length);
  }

  function readLegacyRecipes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(normalizeRecipe).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  async function readRecipes() {
    try {
      const parsed = await window.TDSStorage?.get(STORE_KEY, readLegacyRecipes()) ?? readLegacyRecipes();
      return Array.isArray(parsed) ? parsed.map(normalizeRecipe).filter(Boolean) : [];
    } catch {
      return readLegacyRecipes();
    }
  }

  async function saveRecipes() {
    let saved = false;
    if (window.TDSStorage) {
      saved = await window.TDSStorage.set(STORE_KEY, state.recipes);
    } else {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(state.recipes));
        saved = true;
      } catch {
        saved = false;
      }
    }
    if (saved === false) notify('Unable to save recipes on this device.');
    return saved;
  }

  const recipeMeta = recipe => [
    recipe.category,
    recipe.servings,
    recipe.prepTime && `Prep ${recipe.prepTime}`,
    recipe.cookTime && `Cook ${recipe.cookTime}`
  ].filter(Boolean).join(' / ');

  const allTags = () => [...new Set(state.recipes.flatMap(recipe => recipe.tags))].sort();
  const allCategories = () => [...new Set(state.recipes.map(recipe => recipe.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function qualityChecks(recipe) {
    const issues = [];
    const normalizedIngredients = recipe.ingredients.map(item => item.toLowerCase());
    const duplicates = normalizedIngredients.filter((item, index) => normalizedIngredients.indexOf(item) !== index);
    if (!recipe.category) issues.push('Missing category');
    if (!recipe.servings) issues.push('Missing servings');
    if (!recipe.prepTime && !recipe.cookTime) issues.push('No timing');
    if (!recipe.tags.length) issues.push('No tags');
    if (recipe.steps.some(step => step.length < 12)) issues.push('Short steps');
    if (duplicates.length) issues.push('Duplicate ingredients');
    return issues;
  }

  const readiness = recipe => qualityChecks(recipe).length;

  function filteredRecipes() {
    const query = state.query.trim().toLowerCase();
    return state.recipes
      .filter(recipe => {
        if (state.category && recipe.category !== state.category) return false;
        if (state.tag && !recipe.tags.includes(state.tag)) return false;
        if (!query) return true;
        const haystack = [
          recipe.title,
          recipe.category,
          recipe.servings,
          recipe.prepTime,
          recipe.cookTime,
          recipe.notes,
          recipe.tags.join(' '),
          recipe.ingredients.join(' '),
          recipe.steps.join(' ')
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (state.sort === 'title') return a.title.localeCompare(b.title);
        if (state.sort === 'created') return b.createdAt.localeCompare(a.createdAt);
        if (state.sort === 'quality') return readiness(a) - readiness(b) || a.title.localeCompare(b.title);
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }

  const selectedRecipe = () => state.recipes.find(recipe => recipe.id === state.selectedId) || null;

  function selectRecipe(id) {
    state.selectedId = id;
    state.scale = 1;
    render();
  }

  function openEditor(recipe) {
    state.editingId = recipe?.id || '';
    els.editorTitle.textContent = recipe ? 'Edit Recipe' : 'New Recipe';
    els.formStatus.textContent = '';
    fields.title.value = recipe?.title || '';
    fields.category.value = recipe?.category || '';
    fields.servings.value = recipe?.servings || '';
    fields.prepTime.value = recipe?.prepTime || '';
    fields.cookTime.value = recipe?.cookTime || '';
    fields.tags.value = recipe?.tags?.join(', ') || '';
    draftRows.ingredients = (recipe?.ingredients?.length ? recipe.ingredients : ['']).map(value => ({ id: rowId(), value }));
    draftRows.steps = (recipe?.steps?.length ? recipe.steps : ['']).map(value => ({ id: rowId(), value }));
    fields.notes.value = recipe?.notes || '';
    renderRowEditor('ingredients');
    renderRowEditor('steps');
    els.editorModal.classList.add('open');
    els.editorModal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => fields.title.focus(), 0);
  }

  function closeEditor() {
    els.editorModal.classList.remove('open');
    els.editorModal.setAttribute('aria-hidden', 'true');
    state.editingId = '';
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

  function recipeFromForm() {
    const existing = state.recipes.find(item => item.id === state.editingId);
    const recipe = normalizeRecipe({
      id: state.editingId || uid(),
      title: fields.title.value,
      category: fields.category.value,
      servings: fields.servings.value,
      prepTime: fields.prepTime.value,
      cookTime: fields.cookTime.value,
      tags: splitTags(fields.tags.value),
      ingredients: draftRows.ingredients.map(row => row.value.trim()).filter(Boolean),
      steps: draftRows.steps.map(row => row.value.trim()).filter(Boolean),
      notes: fields.notes.value,
      createdAt: existing?.createdAt || now(),
      updatedAt: now()
    });

    if (!recipe.title) throw new Error('Title is required.');
    if (!recipe.ingredients.length) throw new Error('Add at least one ingredient.');
    if (!recipe.steps.length) throw new Error('Add at least one step.');
    return recipe;
  }

  async function saveFromForm() {
    try {
      const recipe = recipeFromForm();
      const index = state.recipes.findIndex(item => item.id === recipe.id);
      if (index >= 0) state.recipes.splice(index, 1, recipe);
      else state.recipes.unshift(recipe);
      state.selectedId = recipe.id;
      state.scale = 1;
      await saveRecipes();
      closeEditor();
      render();
      notify('Recipe saved.');
    } catch (error) {
      els.formStatus.textContent = error.message || 'Recipe is incomplete.';
    }
  }

  async function deleteRecipe(id) {
    state.recipes = state.recipes.filter(recipe => recipe.id !== id);
    if (state.selectedId === id) state.selectedId = state.recipes[0]?.id || '';
    await saveRecipes();
    closeConfirm();
    render();
    notify('Recipe deleted.');
  }

  async function duplicateRecipe(recipe) {
    if (!recipe) return;
    const copy = normalizeRecipe({
      ...recipe,
      id: uid(),
      title: `${recipe.title} Copy`,
      createdAt: now(),
      updatedAt: now()
    });
    state.recipes.unshift(copy);
    state.selectedId = copy.id;
    state.scale = 1;
    await saveRecipes();
    render();
    notify('Recipe duplicated.');
  }

  function exportRecipes() {
    const blob = new Blob([JSON.stringify(state.recipes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `tds-recipes-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Recipe export downloaded.');
  }

  function mergeImportedRecipes(imported) {
    let added = 0;
    let updated = 0;
    const recipes = [...state.recipes];

    imported.forEach(recipe => {
      const byId = recipes.findIndex(current => current.id === recipe.id);
      const byTitle = recipes.findIndex(current => normalizeKey(current.title) === normalizeKey(recipe.title));
      const index = byId >= 0 ? byId : byTitle;
      if (index >= 0) {
        recipes.splice(index, 1, { ...recipe, id: recipes[index].id, createdAt: recipes[index].createdAt || recipe.createdAt });
        updated += 1;
      } else {
        recipes.unshift(recipe);
        added += 1;
      }
    });

    state.recipes = recipes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { added, updated };
  }

  function importRecipes(file) {
    const reader = new FileReader();
    reader.addEventListener('load', async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]'));
        const rawRecipes = Array.isArray(parsed) ? parsed : parsed.recipes;
        const recipes = Array.isArray(rawRecipes) ? rawRecipes.map(normalizeRecipe).filter(isUsableRecipe) : [];
        if (!recipes.length) throw new Error('No valid recipes found.');
        const result = mergeImportedRecipes(recipes);
        state.selectedId = state.recipes.find(recipe => normalizeKey(recipe.title) === normalizeKey(recipes[0]?.title))?.id || state.recipes[0]?.id || '';
        await saveRecipes();
        render();
        notify(`Import complete: ${result.added} added, ${result.updated} updated.`);
      } catch (error) {
        notify(error.message || 'Import failed.');
      }
    });
    reader.readAsText(file);
  }

  async function loadSampleRecipes() {
    const recipes = sampleRecipes.map(recipe => normalizeRecipe({
      ...recipe,
      id: uid(),
      createdAt: now(),
      updatedAt: now()
    }));
    state.recipes = recipes;
    state.selectedId = recipes[0]?.id || '';
    state.scale = 1;
    await saveRecipes();
    render();
    notify('Sample recipes loaded.');
  }

  function renderRowEditor(type) {
    const target = type === 'ingredients' ? fields.ingredientRows : fields.stepRows;
    target.innerHTML = draftRows[type].map((row, index) => `
      <div class="edit-row" draggable="true" data-type="${type}" data-id="${row.id}">
        <span class="drag-handle" aria-hidden="true">::</span>
        <input value="${escapeHtml(row.value)}" placeholder="${type === 'ingredients' ? 'Ingredient' : `Step ${index + 1}`}" data-row-input>
        <button class="icon-btn" type="button" data-row-action="duplicate" aria-label="Duplicate row">+</button>
        <button class="icon-btn" type="button" data-row-action="delete" aria-label="Delete row">x</button>
      </div>
    `).join('');
  }

  function addRow(type, value = '', afterId = '') {
    const next = { id: rowId(), value };
    const index = draftRows[type].findIndex(row => row.id === afterId);
    if (index >= 0) draftRows[type].splice(index + 1, 0, next);
    else draftRows[type].push(next);
    renderRowEditor(type);
    window.setTimeout(() => {
      const input = document.querySelector(`.edit-row[data-id="${next.id}"] [data-row-input]`);
      input?.focus();
    }, 0);
  }

  function insertRowsAfter(type, afterId, values) {
    const index = draftRows[type].findIndex(row => row.id === afterId);
    const rows = values.map(value => ({ id: rowId(), value }));
    draftRows[type].splice(index + 1, 0, ...rows);
    renderRowEditor(type);
    window.setTimeout(() => {
      const input = document.querySelector(`.edit-row[data-id="${rows.at(-1)?.id}"] [data-row-input]`);
      input?.focus();
    }, 0);
  }

  function updateRow(type, id, value) {
    const row = draftRows[type].find(item => item.id === id);
    if (row) row.value = value;
  }

  function deleteRow(type, id) {
    draftRows[type] = draftRows[type].filter(row => row.id !== id);
    if (!draftRows[type].length) draftRows[type].push({ id: rowId(), value: '' });
    renderRowEditor(type);
  }

  function duplicateRow(type, id) {
    const row = draftRows[type].find(item => item.id === id);
    if (row) addRow(type, row.value, id);
  }

  function moveRow(type, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    const rows = draftRows[type];
    const from = rows.findIndex(row => row.id === fromId);
    const to = rows.findIndex(row => row.id === toId);
    if (from < 0 || to < 0) return;
    const [row] = rows.splice(from, 1);
    rows.splice(to, 0, row);
    renderRowEditor(type);
  }

  function renderCategoryFilter() {
    const current = state.category;
    const categories = allCategories();
    els.categoryFilter.innerHTML = '<option value="">All categories</option>' + categories
      .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join('');
    els.categoryFilter.value = categories.includes(current) ? current : '';
    state.category = els.categoryFilter.value;
    els.categoryCount.textContent = String(categories.length);
  }

  function renderTagFilter() {
    const current = state.tag;
    const tags = allTags();
    els.tagFilter.innerHTML = '<option value="">All tags</option>' + tags
      .map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(titleCase(tag))}</option>`)
      .join('');
    els.tagFilter.value = tags.includes(current) ? current : '';
    state.tag = els.tagFilter.value;
    els.tagCount.textContent = String(tags.length);
  }

  function renderStats() {
    els.recipeCount.textContent = String(state.recipes.length);
    els.readyCount.textContent = String(state.recipes.filter(recipe => readiness(recipe) === 0).length);
  }

  function renderList(recipes) {
    els.visibleCount.textContent = `${recipes.length} shown`;
    if (!recipes.length) {
      const emptyTitle = state.recipes.length ? 'No recipes match.' : 'No recipes yet.';
      const emptyLabel = state.recipes.length ? 'Filtered out' : 'Manual first';
      const action = state.recipes.length
        ? '<button class="btn compact" type="button" data-action="clear-filters">Clear Filters</button>'
        : '<button class="btn compact" type="button" data-action="load-sample">Load Sample</button>';
      els.recipeList.innerHTML = `
        <div class="empty small-empty">
          <p class="eyebrow">${emptyLabel}</p>
          <h3>${emptyTitle}</h3>
          ${action}
        </div>
      `;
      return;
    }

    els.recipeList.innerHTML = recipes.map(recipe => {
      const issueCount = readiness(recipe);
      return `
        <button class="recipe-card ${recipe.id === state.selectedId ? 'active' : ''}" type="button" data-id="${recipe.id}">
          <span class="recipe-card-top">
            <strong>${escapeHtml(recipe.title)}</strong>
            <span class="status-dot ${issueCount ? 'warn' : 'ready'}">${issueCount ? `${issueCount}` : 'OK'}</span>
          </span>
          <span class="recipe-card-meta">${escapeHtml(recipeMeta(recipe) || 'Manual recipe')}</span>
          <span class="recipe-card-foot">
            <span>${recipe.ingredients.length} ingredients</span>
            <span>${recipe.steps.length} steps</span>
          </span>
        </button>
      `;
    }).join('');
  }

  function formatQuantity(value) {
    const rounded = Math.round(value * 100) / 100;
    if (Number.isInteger(rounded)) return String(rounded);

    const whole = Math.floor(rounded);
    const decimal = rounded - whole;
    const fractions = [
      [1 / 8, '1/8'],
      [1 / 4, '1/4'],
      [1 / 3, '1/3'],
      [1 / 2, '1/2'],
      [2 / 3, '2/3'],
      [3 / 4, '3/4'],
      [7 / 8, '7/8']
    ];
    const match = fractions.find(([number]) => Math.abs(decimal - number) < 0.03);
    if (match) return whole ? `${whole} ${match[1]}` : match[1];
    return rounded.toFixed(2).replace(/\.?0+$/, '');
  }

  function scaleIngredient(item) {
    if (state.scale === 1) return item;
    const text = String(item);
    let match = text.match(/^(\s*)(\d+)\s+(\d+)\/(\d+)(\s+.+)$/);
    if (match) {
      const quantity = (Number(match[2]) + (Number(match[3]) / Number(match[4]))) * state.scale;
      return `${match[1]}${formatQuantity(quantity)}${match[5]}`;
    }

    match = text.match(/^(\s*)(\d+)\/(\d+)(\s+.+)$/);
    if (match) {
      const quantity = (Number(match[2]) / Number(match[3])) * state.scale;
      return `${match[1]}${formatQuantity(quantity)}${match[4]}`;
    }

    match = text.match(/^(\s*)(\d+(?:\.\d+)?)(\s+.+)$/);
    if (match) {
      return `${match[1]}${formatQuantity(Number(match[2]) * state.scale)}${match[3]}`;
    }

    return item;
  }

  function scaledIngredients(recipe) {
    return recipe.ingredients.map(scaleIngredient);
  }

  function renderScaleControls() {
    return `
      <div class="scale-controls" aria-label="Ingredient scale">
        <span class="meta">Scale</span>
        ${SCALE_OPTIONS.map(value => `
          <button class="mini-btn ${state.scale === value ? 'active' : ''}" type="button" data-action="scale" data-scale="${value}">${value}x</button>
        `).join('')}
      </div>
    `;
  }

  function renderQuality(recipe) {
    const issues = qualityChecks(recipe);
    if (!issues.length) return '<div class="quality clean"><span>Checks clean</span></div>';
    return `<div class="quality">${issues.map(issue => `<span>${escapeHtml(issue)}</span>`).join('')}</div>`;
  }

  function renderDetail(recipe) {
    if (!recipe) {
      const action = state.recipes.length
        ? '<button class="btn primary" type="button" data-action="clear-filters">Clear Filters</button>'
        : '<button class="btn primary" type="button" data-action="new">New Recipe</button><button class="btn" type="button" data-action="load-sample">Load Sample</button>';
      els.recipeDetail.innerHTML = `
        <div class="empty">
          <p class="eyebrow">No recipe selected</p>
          <h3>${state.recipes.length ? 'Clear the filters or pick another recipe.' : 'Add one recipe. Make it clean. Build from there.'}</h3>
          <div class="empty-actions">${action}</div>
        </div>
      `;
      return;
    }

    const ingredients = scaledIngredients(recipe);
    els.recipeDetail.innerHTML = `
      <div class="detail-head">
        <div class="title-stack">
          <p class="eyebrow">${escapeHtml(recipe.category || 'Recipe')}</p>
          <h2>${escapeHtml(recipe.title)}</h2>
        </div>
        <div class="detail-actions">
          <button class="btn" type="button" data-action="cook" data-id="${recipe.id}">Cook</button>
          <button class="btn" type="button" data-action="copy-list" data-id="${recipe.id}">Copy List</button>
          <button class="btn" type="button" data-action="edit" data-id="${recipe.id}">Edit</button>
          <button class="btn secondary" type="button" data-action="print" data-id="${recipe.id}">Print</button>
          <button class="btn secondary" type="button" data-action="duplicate" data-id="${recipe.id}">Duplicate</button>
          <button class="btn danger subtle" type="button" data-action="delete" data-id="${recipe.id}">Delete</button>
        </div>
      </div>

      <div class="meta-grid">
        <div><span class="meta">Servings</span><strong>${escapeHtml(recipe.servings || 'Not set')}</strong></div>
        <div><span class="meta">Prep</span><strong>${escapeHtml(recipe.prepTime || 'Not set')}</strong></div>
        <div><span class="meta">Cook</span><strong>${escapeHtml(recipe.cookTime || 'Not set')}</strong></div>
        <div><span class="meta">Updated</span><strong>${escapeHtml(new Date(recipe.updatedAt).toLocaleDateString())}</strong></div>
      </div>

      <div class="detail-tools">
        ${recipe.tags.length ? `<div class="tag-row">${recipe.tags.map(tag => `<span class="tag">${escapeHtml(titleCase(tag))}</span>`).join('')}</div>` : '<div class="tag-row"></div>'}
        ${renderScaleControls()}
      </div>
      ${renderQuality(recipe)}

      <section class="cook-panel" id="cookPanel" data-step="0">
        <strong>Cook Mode</strong>
        <p id="cookStep">${escapeHtml(recipe.steps[0] || 'No steps yet.')}</p>
        <div class="cook-actions">
          <button class="btn" type="button" data-action="cook-prev">Previous</button>
          <span class="meta" id="cookCount">1 / ${recipe.steps.length || 1}</span>
          <button class="btn primary" type="button" data-action="cook-next">Next</button>
        </div>
      </section>

      <div class="recipe-body">
        <section class="block">
          <div class="block-head">
            <h3>Ingredients</h3>
            ${state.scale !== 1 ? `<span class="meta">Scaled ${state.scale}x</span>` : ''}
          </div>
          <ul>${ingredients.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </section>
        <section class="block">
          <h3>Steps</h3>
          <ol>${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        </section>
      </div>

      ${recipe.notes ? `<section class="notes"><h3>Notes</h3><p>${escapeHtml(recipe.notes)}</p></section>` : ''}
    `;
  }

  function updateCookPanel(delta) {
    const recipe = selectedRecipe();
    const panel = $('#cookPanel');
    if (!recipe || !panel) return;
    const max = Math.max(0, recipe.steps.length - 1);
    const next = Math.min(max, Math.max(0, Number(panel.dataset.step || 0) + delta));
    panel.dataset.step = String(next);
    $('#cookStep').textContent = recipe.steps[next] || 'No steps yet.';
    $('#cookCount').textContent = `${next + 1} / ${recipe.steps.length || 1}`;
  }

  function shoppingListText(recipe) {
    return [
      recipe.title,
      state.scale !== 1 ? `Scale: ${state.scale}x` : '',
      '',
      ...scaledIngredients(recipe).map(item => `- ${item}`)
    ].filter((line, index) => index < 2 ? line : true).join('\n');
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyShoppingList(recipe) {
    if (!recipe) return;
    const text = shoppingListText(recipe);
    try {
      await navigator.clipboard.writeText(text);
      notify('Shopping list copied.');
    } catch {
      const filename = `${recipe.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe'}-shopping-list.txt`;
      downloadText(filename, text);
      notify('Shopping list downloaded.');
    }
  }

  function clearFilters() {
    state.query = '';
    state.category = '';
    state.tag = '';
    state.sort = 'updated';
    els.searchInput.value = '';
    els.sortSelect.value = 'updated';
    render();
  }

  function render() {
    renderCategoryFilter();
    renderTagFilter();
    renderStats();

    const recipes = filteredRecipes();
    const hasActiveFilters = Boolean(state.query || state.category || state.tag);
    const selectedVisible = recipes.some(recipe => recipe.id === state.selectedId);

    if (recipes.length && (!state.selectedId || !selectedVisible)) {
      state.selectedId = recipes[0].id;
      state.scale = 1;
    } else if (!recipes.length && hasActiveFilters) {
      state.selectedId = '';
    } else if (!state.selectedId && state.recipes.length) {
      state.selectedId = state.recipes[0].id;
    }

    renderList(recipes);
    renderDetail(selectedRecipe());
  }

  els.newRecipe.addEventListener('click', () => openEditor(null));
  els.exportRecipes.addEventListener('click', exportRecipes);
  els.importRecipes.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) importRecipes(file);
    event.target.value = '';
  });
  els.searchInput.addEventListener('input', event => {
    state.query = event.target.value;
    render();
  });
  els.categoryFilter.addEventListener('change', event => {
    state.category = event.target.value;
    render();
  });
  els.tagFilter.addEventListener('change', event => {
    state.tag = event.target.value;
    render();
  });
  els.sortSelect.addEventListener('change', event => {
    state.sort = event.target.value;
    render();
  });
  els.clearFilters.addEventListener('click', clearFilters);
  els.recipeForm.addEventListener('submit', event => {
    event.preventDefault();
    saveFromForm();
  });
  fields.addIngredient.addEventListener('click', () => addRow('ingredients'));
  fields.addStep.addEventListener('click', () => addRow('steps'));

  els.recipeForm.addEventListener('input', event => {
    const row = event.target.closest('.edit-row');
    if (row && event.target.matches('[data-row-input]')) updateRow(row.dataset.type, row.dataset.id, event.target.value);
  });

  els.recipeForm.addEventListener('paste', event => {
    const row = event.target.closest('.edit-row');
    if (!row || !event.target.matches('[data-row-input]')) return;
    const lines = String(event.clipboardData?.getData('text') || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    event.preventDefault();
    updateRow(row.dataset.type, row.dataset.id, lines[0]);
    insertRowsAfter(row.dataset.type, row.dataset.id, lines.slice(1));
  });

  els.recipeForm.addEventListener('keydown', event => {
    const row = event.target.closest('.edit-row');
    if (!row || !event.target.matches('[data-row-input]') || event.key !== 'Enter') return;
    event.preventDefault();
    addRow(row.dataset.type, '', row.dataset.id);
  });

  els.recipeForm.addEventListener('dragstart', event => {
    const row = event.target.closest('.edit-row');
    if (!row) return;
    row.classList.add('dragging');
    event.dataTransfer.setData('text/plain', `${row.dataset.type}:${row.dataset.id}`);
  });

  els.recipeForm.addEventListener('dragend', event => {
    event.target.closest('.edit-row')?.classList.remove('dragging');
  });

  els.recipeForm.addEventListener('dragover', event => {
    if (event.target.closest('.edit-row')) event.preventDefault();
  });

  els.recipeForm.addEventListener('drop', event => {
    const row = event.target.closest('.edit-row');
    if (!row) return;
    event.preventDefault();
    const [type, id] = event.dataTransfer.getData('text/plain').split(':');
    if (type === row.dataset.type) moveRow(type, id, row.dataset.id);
  });

  document.addEventListener('click', event => {
    const target = event.target.closest('button, .recipe-card');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (target.classList.contains('recipe-card')) selectRecipe(target.dataset.id);
    if (action === 'new') openEditor(null);
    if (action === 'load-sample') loadSampleRecipes();
    if (action === 'clear-filters') clearFilters();
    if (action === 'edit') openEditor(state.recipes.find(recipe => recipe.id === id));
    if (action === 'duplicate') duplicateRecipe(state.recipes.find(recipe => recipe.id === id));
    if (action === 'copy-list') copyShoppingList(state.recipes.find(recipe => recipe.id === id));
    if (action === 'print') window.print();
    if (action === 'cook') $('#cookPanel')?.classList.toggle('open');
    if (action === 'cook-prev') updateCookPanel(-1);
    if (action === 'cook-next') updateCookPanel(1);
    if (action === 'scale') {
      state.scale = Number(target.dataset.scale) || 1;
      renderDetail(selectedRecipe());
    }
    if (action === 'delete') openConfirm(id);
    if (action === 'close') closeEditor();
    if (target.dataset.rowAction === 'delete') {
      const row = target.closest('.edit-row');
      deleteRow(row.dataset.type, row.dataset.id);
    }
    if (target.dataset.rowAction === 'duplicate') {
      const row = target.closest('.edit-row');
      duplicateRow(row.dataset.type, row.dataset.id);
    }
    if (target.dataset.confirm === 'cancel') closeConfirm();
    if (target.dataset.confirm === 'delete') deleteRecipe(state.deletingId);
  });

  document.addEventListener('click', event => {
    if (event.target === els.editorModal) closeEditor();
    if (event.target === els.confirmModal) closeConfirm();
  });

  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (els.confirmModal.classList.contains('open')) closeConfirm();
    else if (els.editorModal.classList.contains('open')) closeEditor();
  });

  async function init() {
    await window.TDSStorage?.persist();
    state.recipes = await readRecipes();
    state.selectedId = state.recipes[0]?.id || '';
    render();
  }

  init();
})();
