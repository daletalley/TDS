(() => {
  const STORE_KEY = 'tds:cookbook:recipes:v1';
  const state = {
    recipes: [],
    selectedId: '',
    editingId: '',
    deletingId: '',
    query: '',
    tag: '',
    sort: 'updated'
  };

  const $ = selector => document.querySelector(selector);
  const els = {
    newRecipe: $('#newRecipe'),
    recipeCount: $('#recipeCount'),
    tagCount: $('#tagCount'),
    visibleCount: $('#visibleCount'),
    searchInput: $('#searchInput'),
    tagFilter: $('#tagFilter'),
    sortSelect: $('#sortSelect'),
    recipeList: $('#recipeList'),
    recipeDetail: $('#recipeDetail'),
    editorModal: $('#editorModal'),
    recipeForm: $('#recipeForm'),
    editorTitle: $('#editorTitle'),
    formStatus: $('#formStatus'),
    confirmModal: $('#confirmModal')
  };

  const fields = {
    title: $('#titleInput'),
    category: $('#categoryInput'),
    servings: $('#servingsInput'),
    prepTime: $('#prepInput'),
    cookTime: $('#cookInput'),
    tags: $('#tagsInput'),
    ingredients: $('#ingredientsInput'),
    steps: $('#stepsInput'),
    notes: $('#notesInput')
  };

  const now = () => new Date().toISOString();
  const uid = () => `recipe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
  const splitLines = value => String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const splitTags = value => String(value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
  const titleCase = value => value.replace(/\b\w/g, char => char.toUpperCase());

  const readRecipes = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(normalizeRecipe).filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const saveRecipes = () => {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.recipes));
  };

  function normalizeRecipe(recipe) {
    if (!recipe || typeof recipe !== 'object') return null;
    const createdAt = recipe.createdAt || now();
    return {
      id: recipe.id || uid(),
      title: String(recipe.title || '').trim(),
      category: String(recipe.category || '').trim(),
      servings: String(recipe.servings || '').trim(),
      prepTime: String(recipe.prepTime || '').trim(),
      cookTime: String(recipe.cookTime || '').trim(),
      tags: Array.isArray(recipe.tags) ? recipe.tags.map(String).map(tag => tag.trim().toLowerCase()).filter(Boolean) : [],
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(String).map(item => item.trim()).filter(Boolean) : [],
      steps: Array.isArray(recipe.steps) ? recipe.steps.map(String).map(item => item.trim()).filter(Boolean) : [],
      notes: String(recipe.notes || '').trim(),
      createdAt,
      updatedAt: recipe.updatedAt || createdAt
    };
  }

  const recipeMeta = recipe => [
    recipe.category,
    recipe.servings,
    recipe.prepTime && `Prep ${recipe.prepTime}`,
    recipe.cookTime && `Cook ${recipe.cookTime}`
  ].filter(Boolean).join(' / ');

  const allTags = () => [...new Set(state.recipes.flatMap(recipe => recipe.tags))].sort();

  const filteredRecipes = () => {
    const query = state.query.trim().toLowerCase();
    return state.recipes
      .filter(recipe => {
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
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  };

  const selectedRecipe = () => state.recipes.find(recipe => recipe.id === state.selectedId) || null;

  const selectRecipe = id => {
    state.selectedId = id;
    render();
  };

  const openEditor = recipe => {
    state.editingId = recipe?.id || '';
    els.editorTitle.textContent = recipe ? 'Edit Recipe' : 'New Recipe';
    els.formStatus.textContent = '';
    fields.title.value = recipe?.title || '';
    fields.category.value = recipe?.category || '';
    fields.servings.value = recipe?.servings || '';
    fields.prepTime.value = recipe?.prepTime || '';
    fields.cookTime.value = recipe?.cookTime || '';
    fields.tags.value = recipe?.tags?.join(', ') || '';
    fields.ingredients.value = recipe?.ingredients?.join('\n') || '';
    fields.steps.value = recipe?.steps?.join('\n') || '';
    fields.notes.value = recipe?.notes || '';
    els.editorModal.classList.add('open');
    els.editorModal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => fields.title.focus(), 0);
  };

  const closeEditor = () => {
    els.editorModal.classList.remove('open');
    els.editorModal.setAttribute('aria-hidden', 'true');
    state.editingId = '';
  };

  const openConfirm = id => {
    state.deletingId = id;
    els.confirmModal.classList.add('open');
    els.confirmModal.setAttribute('aria-hidden', 'false');
  };

  const closeConfirm = () => {
    state.deletingId = '';
    els.confirmModal.classList.remove('open');
    els.confirmModal.setAttribute('aria-hidden', 'true');
  };

  const recipeFromForm = () => {
    const recipe = normalizeRecipe({
      id: state.editingId || uid(),
      title: fields.title.value,
      category: fields.category.value,
      servings: fields.servings.value,
      prepTime: fields.prepTime.value,
      cookTime: fields.cookTime.value,
      tags: splitTags(fields.tags.value),
      ingredients: splitLines(fields.ingredients.value),
      steps: splitLines(fields.steps.value),
      notes: fields.notes.value,
      createdAt: state.recipes.find(item => item.id === state.editingId)?.createdAt || now(),
      updatedAt: now()
    });

    if (!recipe.title) throw new Error('Title is required.');
    if (!recipe.ingredients.length) throw new Error('Add at least one ingredient.');
    if (!recipe.steps.length) throw new Error('Add at least one step.');
    return recipe;
  };

  const saveFromForm = () => {
    try {
      const recipe = recipeFromForm();
      const index = state.recipes.findIndex(item => item.id === recipe.id);
      if (index >= 0) state.recipes.splice(index, 1, recipe);
      else state.recipes.unshift(recipe);
      state.selectedId = recipe.id;
      saveRecipes();
      closeEditor();
      render();
    } catch (error) {
      els.formStatus.textContent = error.message || 'Recipe is incomplete.';
    }
  };

  const deleteRecipe = id => {
    state.recipes = state.recipes.filter(recipe => recipe.id !== id);
    if (state.selectedId === id) state.selectedId = state.recipes[0]?.id || '';
    saveRecipes();
    closeConfirm();
    render();
  };

  const duplicateRecipe = recipe => {
    const copy = normalizeRecipe({
      ...recipe,
      id: uid(),
      title: `${recipe.title} Copy`,
      createdAt: now(),
      updatedAt: now()
    });
    state.recipes.unshift(copy);
    state.selectedId = copy.id;
    saveRecipes();
    render();
  };

  const renderTagFilter = () => {
    const current = state.tag;
    const tags = allTags();
    els.tagFilter.innerHTML = '<option value="">All tags</option>' + tags
      .map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(titleCase(tag))}</option>`)
      .join('');
    els.tagFilter.value = tags.includes(current) ? current : '';
    state.tag = els.tagFilter.value;
    els.tagCount.textContent = String(tags.length);
  };

  const renderList = recipes => {
    els.visibleCount.textContent = `${recipes.length} shown`;
    if (!recipes.length) {
      const emptyTitle = state.recipes.length ? 'Keep the filters simple.' : 'No recipes yet.';
      const emptyLabel = state.recipes.length ? 'No matches' : 'Manual first';
      els.recipeList.innerHTML = `
        <div class="empty">
          <p class="eyebrow">${emptyLabel}</p>
          <h3>${emptyTitle}</h3>
        </div>
      `;
      return;
    }

    els.recipeList.innerHTML = recipes.map(recipe => `
      <button class="recipe-card ${recipe.id === state.selectedId ? 'active' : ''}" type="button" data-id="${recipe.id}">
        <strong>${escapeHtml(recipe.title)}</strong>
        <p>${escapeHtml(recipeMeta(recipe) || 'Manual recipe')}</p>
        <span class="meta">${recipe.ingredients.length} ingredients / ${recipe.steps.length} steps</span>
      </button>
    `).join('');
  };

  const renderDetail = recipe => {
    if (!recipe) {
      els.recipeDetail.innerHTML = `
        <div class="empty">
          <p class="eyebrow">No recipe selected</p>
          <h3>Add one recipe. Make it clean. Build from there.</h3>
          <button class="btn primary" type="button" data-action="new">New Recipe</button>
        </div>
      `;
      return;
    }

    els.recipeDetail.innerHTML = `
      <div class="detail-head">
        <div>
          <p class="eyebrow">${escapeHtml(recipe.category || 'Recipe')}</p>
          <h2>${escapeHtml(recipe.title)}</h2>
        </div>
        <div class="detail-actions">
          <button class="btn" type="button" data-action="duplicate" data-id="${recipe.id}">Duplicate</button>
          <button class="btn" type="button" data-action="edit" data-id="${recipe.id}">Edit</button>
          <button class="btn danger" type="button" data-action="delete" data-id="${recipe.id}">Delete</button>
        </div>
      </div>

      <div class="meta-grid">
        <div><span class="meta">Servings</span><strong>${escapeHtml(recipe.servings || 'Not set')}</strong></div>
        <div><span class="meta">Prep</span><strong>${escapeHtml(recipe.prepTime || 'Not set')}</strong></div>
        <div><span class="meta">Cook</span><strong>${escapeHtml(recipe.cookTime || 'Not set')}</strong></div>
        <div><span class="meta">Updated</span><strong>${escapeHtml(new Date(recipe.updatedAt).toLocaleDateString())}</strong></div>
      </div>

      ${recipe.tags.length ? `<div class="tag-row">${recipe.tags.map(tag => `<span class="tag">${escapeHtml(titleCase(tag))}</span>`).join('')}</div>` : ''}

      <div class="recipe-body">
        <section class="block">
          <h3>Ingredients</h3>
          <ul>${recipe.ingredients.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </section>
        <section class="block">
          <h3>Steps</h3>
          <ol>${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
        </section>
      </div>

      ${recipe.notes ? `<section class="notes"><h3>Notes</h3><p>${escapeHtml(recipe.notes)}</p></section>` : ''}
    `;
  };

  const render = () => {
    renderTagFilter();
    const recipes = filteredRecipes();
    if (!state.selectedId && state.recipes.length) state.selectedId = recipes[0]?.id || state.recipes[0].id;
    els.recipeCount.textContent = String(state.recipes.length);
    renderList(recipes);
    renderDetail(selectedRecipe());
  };

  els.newRecipe.addEventListener('click', () => openEditor(null));
  els.searchInput.addEventListener('input', event => {
    state.query = event.target.value;
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
  els.recipeForm.addEventListener('submit', event => {
    event.preventDefault();
    saveFromForm();
  });

  document.addEventListener('click', event => {
    const target = event.target.closest('button, .recipe-card');
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (target.classList.contains('recipe-card')) selectRecipe(target.dataset.id);
    if (action === 'new') openEditor(null);
    if (action === 'edit') openEditor(state.recipes.find(recipe => recipe.id === id));
    if (action === 'duplicate') duplicateRecipe(state.recipes.find(recipe => recipe.id === id));
    if (action === 'delete') openConfirm(id);
    if (action === 'close') closeEditor();
    if (target.dataset.confirm === 'cancel') closeConfirm();
    if (target.dataset.confirm === 'delete') deleteRecipe(state.deletingId);
  });

  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (els.confirmModal.classList.contains('open')) closeConfirm();
    else if (els.editorModal.classList.contains('open')) closeEditor();
  });

  state.recipes = readRecipes();
  state.selectedId = state.recipes[0]?.id || '';
  render();
})();
