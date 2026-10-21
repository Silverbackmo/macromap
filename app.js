(() => {
  'use strict';
  const icons = {
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
    heart:'<path d="M20.8 4.7a5.3 5.3 0 0 0-7.5 0L12 6l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 21l8.8-8.8a5.3 5.3 0 0 0 0-7.5Z"/>',
    pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    leaf:'<path d="M20 3C10 2 3 7 5 14s14 8 15-11Z"/><path d="m4 21 11-12"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    reset:'<path d="M3 10a9 9 0 1 1 1.7 8M3 4v6h6"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    cup:'<path d="M5 8h12v8a5 5 0 0 1-10 0V8m10 1h2a3 3 0 0 1 0 6h-2M4 22h16M9 3v2m5-2v2"/>',
    bag:'<path d="M5 7h14l1 14H4L5 7Zm4 0V5a3 3 0 0 1 6 0v2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    sliders:'<path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
    chevron:'<path d="m6 9 6 6 6-6"/>',
    check:'<path d="m5 12 4 4L19 6"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.info}</svg>`;
  const $ = id => document.getElementById(id);
  const meals = window.MACROMAP_MEALS;
  const discovery = window.MACROMAP_DISCOVERY;
  const dietLabels = {vegetarian:'Vegetarian',porkFree:'Pork free',vegan:'Vegan',dairyFree:'Dairy free'};
  const byId = new Map(meals.map(m => [m.id,m]));
  const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defaults = {budget:20,calories:900,protein:0,distance:5,vegetarian:false,porkFree:false,vegan:false,dairyFree:false,search:'',category:'All meals',sort:'recommended'};
  const state = {...defaults,view:'discover',compare:[]};
  let saved = new Set(), plan = [], goals = {budget:20,calories:900,protein:40};
  let detailId = null, toastTimer, activeSuggestions = [];
  try {
    const old = JSON.parse(localStorage.getItem('macromap-favorites-v1') || '[]');
    if(Array.isArray(old)) saved = new Set(old.filter(id => byId.has(id)));
    const stored = JSON.parse(localStorage.getItem('macromap-plan-v1') || '{}');
    if(Array.isArray(stored.items)) plan = [...new Map(stored.items.filter(i => byId.has(i.id) && Number.isInteger(i.qty) && i.qty > 0 && i.qty <= 9).map(i => [i.id,{id:i.id,qty:i.qty}])).values()];
    if(stored.goals) for(const key of ['budget','calories','protein']) {
      const max = {budget:100,calories:3000,protein:200}[key];
      const min = key === 'budget' ? 1 : 0;
      if(Number.isFinite(stored.goals[key]) && stored.goals[key] >= min && stored.goals[key] <= max) goals[key] = stored.goals[key];
    }
  } catch {}
  document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = svg(el.dataset.icon));
  function toast(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true,2600);
  }
  function persistPlan() {
    try { localStorage.setItem('macromap-plan-v1',JSON.stringify({items:plan,goals})); return true; }
    catch { return false; }
  }
  function setFiltersOpen(open, returnFocus = false) {
    document.body.classList.toggle('filters-open',open);
    $('mobile-filter-toggle').setAttribute('aria-expanded',String(open));
    if(returnFocus) $('mobile-filter-toggle').focus({preventScroll:true});
  }
  function renderCategories() {
    const items = state.view === 'drinks' ? meals.filter(m => m.kind === 'drink') : state.view === 'saved' ? meals.filter(m => saved.has(m.id)) : meals.filter(m => m.kind === 'food');
    const all = state.view === 'drinks' ? 'All drinks' : state.view === 'saved' ? 'All saved' : 'All meals';
    const categories = [all,...new Set(items.map(m => m.category))];
    $('categories').innerHTML = categories.map(c => `<button type="button" class="category-chip ${state.category === c ? 'active' : ''}" data-category="${escape(c)}" aria-pressed="${state.category === c}">${c}</button>`).join('');
  }
  function filterMeals() {
    return discovery.filter(meals,state,saved);
  }
  function fitReasons(m) {
    const cents = Math.round((state.budget-m.price)*100);
    const reasons = [];
    if(state.protein>0) reasons.push({met:m.protein>=state.protein,text:m.protein>=state.protein ? `Meets ${state.protein}g protein goal` : `${state.protein-m.protein}g short of protein goal`});
    reasons.push({met:cents>=0,text:cents>0 ? `${money(cents/100)} below price limit` : cents===0 ? 'At your price limit' : `${money(-cents/100)} above price limit`});
    reasons.push({met:m.calories<=state.calories,text:m.calories<=state.calories ? `Within ${state.calories} cal` : `${m.calories-state.calories} cal above limit`});
    reasons.push({met:m.distance<=state.distance,text:m.distance<=state.distance ? `Within ${state.distance} mi` : `${(m.distance-state.distance).toFixed(1)} mi beyond your radius`});
    return reasons;
  }
  function fitHTML(m,detail = false) {
    const reasons = detail ? fitReasons(m) : fitReasons(m).slice(0,2);
    return `<div class="fit-block ${detail?'detail-fit-block':''}"><span class="fit-kicker">${detail?'Your browsing filters':'Why it fits'}</span><ul class="fit-reasons">${reasons.map(reason=>`<li class="${reason.met?'':'is-outside'}">${svg(reason.met?'check':'info')}<span>${escape(reason.text)}</span></li>`).join('')}</ul></div>`;
  }
  function dietHTML(m) {
    const tags = [];
    if(m.vegan) tags.push('Vegan'); else if(m.vegetarian) tags.push('Vegetarian');
    if(m.dairyFree) tags.push('Dairy free');
    tags.push(m.porkFree?'Pork free':'Contains pork');
    return `<div class="dietary-tags" aria-label="Sample recipe tags">${tags.map(tag=>`<span class="diet-tag ${tag==='Contains pork'?'contains-pork':''}">${tag}</span>`).join('')}</div>`;
  }
  function adjustmentLabels(patch) {
    return Object.entries(patch).map(([key,value])=>{
      if(key==='budget') return `Raise price limit to $${value}`;
      if(key==='calories') return `Raise calorie limit to ${value} cal`;
      if(key==='protein') return `Lower protein minimum to ${value}g`;
      if(key==='distance') return `Increase distance to ${value} mi`;
      if(key==='search') return 'Clear search text';
      return 'Search all categories';
    });
  }
  function emptyResultsHTML() {
    activeSuggestions = discovery.suggestions(meals,state,saved);
    const preferences = discovery.dietKeys.filter(key=>state[key]).map(key=>dietLabels[key]);
    const options = activeSuggestions.map((suggestion,index)=>`<button type="button" class="alternative-button" data-suggestion="${index}"><span class="alternative-arrow">↗</span><span><strong>${adjustmentLabels(suggestion.patch).map(escape).join(' · ')}</strong><small>Show ${suggestion.count} matching ${suggestion.count===1?'item':'items'}</small></span></button>`).join('');
    return `<div class="empty-state"><div class="empty-symbol">✳</div><h3>No exact matches yet.</h3><p>${activeSuggestions.length?'A small change could reveal your next good find.':'Try another search or category, or review your selected preferences.'}</p>${preferences.length?`<p class="preferences-kept">${svg('leaf')} Keeping ${preferences.map(escape).join(' · ')} selected</p>`:''}${options?`<div class="empty-alternatives">${options}</div>`:''}<button class="${options?'text-button':'primary-button'}" data-clear>Clear all filters</button></div>`;
  }
  function card(m) {
    const selected = state.compare.includes(m.id), favorite = saved.has(m.id), quantity = plan.find(i => i.id === m.id)?.qty || 0;
    const third = m.kind === 'drink' ? `${m.caffeine}mg` : `${m.carbs}g`;
    return `<article class="meal-card" data-meal-id="${m.id}"><div class="meal-art" style="--art-bg:${m.accent}"><button class="meal-image" data-detail="${m.id}" aria-label="View ${escape(m.name)} details"><img src="assets/${m.art}.svg" alt="Illustration of ${escape(m.name)}" loading="lazy"></button>${m.vegetarian && m.kind === 'food' ? '<span class="veg-badge">Vegetarian</span>' : ''}${m.kind === 'drink' ? `<span class="veg-badge">${m.category}</span>` : ''}<button class="favorite ${favorite ? 'saved' : ''}" data-save="${m.id}" aria-label="${favorite ? 'Unsave' : 'Save'} ${escape(m.name)}" aria-pressed="${favorite}">${svg('heart')}</button></div><div class="meal-body"><div class="restaurant-row"><span>${m.restaurant}</span><span>${m.distance.toFixed(1)} mi</span></div><button class="meal-title" data-detail="${m.id}">${m.name}</button>${fitHTML(m)}<div class="macro-row"><div><strong>${m.calories}</strong><span>calories</span></div><div><strong>${m.protein}g</strong><span>protein</span></div><div><strong>${third}</strong><span>${m.kind === 'drink' ? 'caffeine' : 'carbs'}</span></div></div>${dietHTML(m)}<div class="protein-value ${state.sort==='value'?'emphasized':''}"><span>Protein value</span><strong>${discovery.proteinValue(m).toFixed(1)}g per $1</strong></div><div class="price-row"><strong>${money(m.price)}</strong><span class="data-label">Sample data</span></div></div><div class="meal-bottom"><button class="compare-toggle" data-compare="${m.id}" aria-label="${selected ? 'Remove' : 'Add'} ${escape(m.name)} ${selected ? 'from' : 'to'} comparison" aria-pressed="${selected}"><span class="check-square">${selected ? '✓' : ''}</span>Compare</button><button class="details-button" data-detail="${m.id}">Details</button><button class="card-add ${quantity ? 'has-item' : ''}" data-add="${m.id}" aria-label="Add ${escape(m.name)} to my meal">${quantity ? quantity : svg('plus')}</button></div></article>`;
  }
  function render() {
    const visible = filterMeals(), noun = state.view === 'drinks' ? 'drink' : state.view === 'saved' ? 'saved item' : 'meal';
    $('results-count').textContent = `${visible.length} ${noun}${visible.length === 1 ? '' : 's'} ${state.view === 'saved' ? 'to revisit' : 'to explore'}`;
    const preferences = discovery.dietKeys.filter(key=>state[key]).map(key=>dietLabels[key]);
    $('mobile-filter-summary').textContent = [`$${state.budget} max`,state.protein ? `${state.protein}g+ protein` : 'Any protein',...preferences].join(' · ');
    $('mobile-filter-done-label').textContent = `Show ${visible.length} ${noun}${visible.length === 1 ? '' : 's'}`;
    $('value-sort-note').hidden = state.sort !== 'value';
    activeSuggestions = [];
    $('filter-summary').textContent = state.view === 'drinks' ? 'A good sip deserves a spot in your day.' : 'Matched to your goals. Made for your day.';
    if(visible.length) $('meal-grid').innerHTML = visible.map(card).join('');
    else if(state.view === 'saved' && !saved.size) $('meal-grid').innerHTML = '<div class="empty-state"><div class="empty-symbol">♡</div><h3>Keep a good thing close.</h3><p>Tap the heart on a meal or drink to save it for next time.<br>Your favorites stay on this browser.</p><button class="primary-button" data-discover>Discover meals</button></div>';
    else $('meal-grid').innerHTML = emptyResultsHTML();
    $('saved-count').textContent = saved.size;
    $('results-heading').textContent = state.view === 'saved' ? 'Your good finds, saved.' : state.view === 'drinks' ? 'Find your next favorite sip.' : 'What sounds good?';
    $('section-kicker').textContent = state.view === 'saved' ? 'GOOD FINDS, KEPT CLOSE' : state.view === 'drinks' ? 'MAKE ROOM FOR A GOOD SIP' : 'FIND YOUR FIT';
    for(const [id,view] of [['discover-nav','discover'],['drinks-nav','drinks'],['saved-nav','saved']]) {
      $(id).classList.toggle('active',state.view === view);
      if(state.view === view) $(id).setAttribute('aria-current','page'); else $(id).removeAttribute('aria-current');
    }
    const count = plan.reduce((n,i) => n+i.qty,0);
    $('plan-nav-count').textContent = count; $('plan-top-count').textContent = count;
    renderCategories(); renderTray();
  }
  function syncInputs() {
    for(const key of ['budget','calories','protein','distance']) $(key).value = state[key];
    $('budget-label').textContent = `$${state.budget}`; $('calories-label').textContent = `${state.calories} cal`;
    $('protein-label').textContent = `${state.protein}g`; $('distance-label').textContent = `${state.distance} mi`;
    for(const key of discovery.dietKeys) $(key).checked = state[key];
    $('search').value = state.search; $('sort').value = state.sort;
  }
  function clearFilters(keepDiet = false) {
    const preferences = Object.fromEntries(discovery.dietKeys.map(key=>[key,state[key]]));
    Object.assign(state,defaults);
    if(keepDiet === true) Object.assign(state,preferences);
    if(state.view === 'saved') Object.assign(state,{budget:25,calories:1200,distance:10,category:'All saved'});
    if(state.view === 'drinks') Object.assign(state,{budget:10,calories:400,category:'All drinks'});
    syncInputs(); render();
  }
  function changeView(view,scroll = true) {
    setFiltersOpen(false);
    state.view = view; clearFilters(true);
    if(scroll) $('results-heading').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function saveMeal(id) {
    if(!byId.has(id)) return;
    if(saved.has(id)) saved.delete(id); else saved.add(id);
    try { localStorage.setItem('macromap-favorites-v1',JSON.stringify([...saved])); toast(saved.has(id) ? 'Saved for next time.' : 'Removed from saved items.'); }
    catch { toast('Saved for this visit. This browser could not store favorites.'); }
    render();
    if(detailId === id && $('detail-dialog').open) renderDetail(id);
    if($('compare-dialog').open) renderComparison();
  }
  function toggleCompare(id) {
    if(state.compare.includes(id)) state.compare = state.compare.filter(x => x !== id);
    else if(state.compare.length >= 3) { toast('Compare up to three items. Remove one to add another.'); return; }
    else state.compare.push(id);
    render();
    if(detailId === id && $('detail-dialog').open) renderDetail(id);
    if($('compare-dialog').open) { if(state.compare.length >= 2) renderComparison(); else $('compare-dialog').close(); }
  }
  function renderTray() {
    const count = state.compare.length; $('compare-tray').hidden = !count;
    $('compare-count').textContent = `${count} ${count === 1 ? 'item' : 'items'} selected`;
    $('open-compare').disabled = count < 2;
    $('open-compare').title = count < 2 ? 'Choose one more item to compare' : 'Compare selected items';
    $('compare-mini').innerHTML = state.compare.map(id => {const m = byId.get(id); return `<img src="assets/${m.art}.svg" alt="${m.name}">`;}).join('');
    document.body.classList.toggle('has-comparison',count > 0);
  }
  function renderDetail(id) {
    const m = byId.get(id); if(!m) return; detailId = id;
    const quantity = plan.find(i => i.id === id)?.qty || 0;
    $('detail-content').innerHTML = `<div class="detail-art" style="background:${m.accent}"><img src="assets/${m.art}.svg" alt="Illustration of ${m.name}"></div><div class="detail-text"><div class="detail-restaurant">${m.restaurant} · ${m.distance.toFixed(1)} mi from University of Houston <span class="sample-tag">Fictional listing</span></div><h2 id="detail-title">${m.name}</h2><p class="detail-description">${m.description}</p>${fitHTML(m,true)}<div class="detail-value-row"><span>Sample protein value</span><strong>${discovery.proteinValue(m).toFixed(1)}g per $1</strong></div>${dietHTML(m)}<div class="detail-stats"><div class="stat-box"><strong>${m.calories}</strong><span>calories</span></div><div class="stat-box"><strong>${m.protein}g</strong><span>protein</span></div><div class="stat-box"><strong>${m.carbs}g</strong><span>carbs</span></div><div class="stat-box"><strong>${m.fat}g</strong><span>fat</span></div></div>${m.kind === 'drink' ? `<div class="drink-caffeine">${svg('cup')} Sample caffeine: <strong>${m.caffeine}mg per serving</strong></div>` : ''}<h3 class="detail-subheading">What is in this ${m.kind === 'drink' ? 'drink' : 'meal'}?</h3><p class="detail-ingredients">${m.ingredients}</p><h3 class="detail-subheading">Illustrative serving</h3><p class="detail-ingredients">${m.serving}</p><div class="source-box"><strong>Sample source record · ${m.source}</strong><p>This fictional entry demonstrates a source and portion record. Nutrition, caffeine, serving size, price and distance are illustrative. A real listing would need a current documented source.</p></div><div class="detail-actions"><div class="detail-price">${money(m.price)}<span>Illustrative item price</span></div><button class="primary-button" data-add="${id}">${svg('plus')}${quantity ? `In my meal (${quantity}) · Add another` : 'Add to my meal'}</button></div><div class="detail-utility"><button class="secondary-button" data-save="${id}" aria-pressed="${saved.has(id)}">${svg('heart')}${saved.has(id) ? 'Saved item' : 'Save for later'}</button><button class="secondary-button" data-compare="${id}" aria-pressed="${state.compare.includes(id)}">${state.compare.includes(id) ? '✓ In comparison' : '+ Compare'}</button>${quantity ? '<button class="text-button" data-open-plan>Review my meal →</button>' : ''}</div></div>`;
  }
  function openDetail(id) {renderDetail(id); if(!$('detail-dialog').open) $('detail-dialog').showModal();}
  function renderComparison() {
    const selected = state.compare.map(id => ({...byId.get(id),proteinValue:discovery.proteinValue(byId.get(id))})); if(selected.length < 2) return;
    const rows = [['Price','price',money,'min'],['Protein per $1','proteinValue',v=>`${v.toFixed(1)}g`,'max'],['Calories','calories',v=>`${v} cal`,null],['Protein','protein',v=>`${v}g`,'max'],['Carbs','carbs',v=>`${v}g`,null],['Fat','fat',v=>`${v}g`,null],['Distance','distance',v=>`${v.toFixed(1)} mi`,'min']];
    if(selected.some(m => m.kind === 'drink')) rows.push(['Caffeine','caffeine',v => v === undefined ? '—' : `${v}mg`,null]);
    $('comparison-content').innerHTML = `<div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th scope="col">Sample items</th>${selected.map(m=>`<th scope="col"><img src="assets/${m.art}.svg" alt=""><strong>${m.name}</strong><span>${m.restaurant}</span></th>`).join('')}</tr></thead><tbody>${rows.map(([name,key,format,mode])=>{const best = mode ? (mode === 'max' ? Math.max(...selected.map(m=>m[key])) : Math.min(...selected.map(m=>m[key]))) : null;return `<tr><th scope="row">${name}</th>${selected.map(m=>`<td class="${mode && m[key] === best ? 'winner' : ''}">${format(m[key])}</td>`).join('')}</tr>`;}).join('')}<tr><th scope="row">Make it a meal</th>${selected.map(m=>`<td><button class="secondary-button" style="margin:auto" data-add="${m.id}">+ Add item</button></td>`).join('')}</tr><tr><th scope="row">Save for later</th>${selected.map(m=>`<td><button class="text-button" data-save="${m.id}">${saved.has(m.id) ? '✓ Saved' : 'Save item'}</button></td>`).join('')}</tr><tr><th scope="row"></th>${selected.map(m=>`<td><button class="text-button" data-remove-comparison="${m.id}">Remove</button></td>`).join('')}</tr></tbody></table></div>`;
  }
  function addToPlan(id) {
    if(!byId.has(id)) return;
    const item = plan.find(i => i.id === id);
    if(item && item.qty >= 9) {toast('You can add up to nine of each item.'); return;}
    if(item) item.qty++; else plan.push({id,qty:1});
    const stored = persistPlan(); render();
    if(detailId && $('detail-dialog').open) renderDetail(detailId);
    if($('plan-dialog').open) renderPlan();
    toast(stored ? `${byId.get(id).name} added to your meal.` : 'Added for this visit. Your browser could not save the meal plan.');
  }
  function planTotals() {
    return plan.reduce((t,item)=>{const m=byId.get(item.id); t.cents += Math.round(m.price*100)*item.qty; for(const k of ['calories','protein','carbs','fat']) t[k] += m[k]*item.qty; t.caffeine += (m.caffeine||0)*item.qty; return t;},{cents:0,calories:0,protein:0,carbs:0,fat:0,caffeine:0});
  }
  function renderPlan() {
    $('plan-status').textContent = ''; $('copy-plan-output').hidden = true;
    if(!plan.length) { $('plan-content').innerHTML = '<div class="empty-state"><div class="empty-symbol">✳</div><h3>A good meal starts with one pick.</h3><p>Add a meal or drink with the + button.<br>Then compare your combined price and nutrition.</p><div class="empty-actions"><button class="primary-button" data-browse="discover">Find a meal</button><button class="secondary-button" data-browse="drinks">Find a drink</button></div></div>'; return; }
    const t = planTotals(), remaining = goals.budget - t.cents/100, hasFood = plan.some(i=>byId.get(i.id).kind==='food');
    const pairingKind = hasFood ? 'drink' : 'food';
    const suggestions = meals.filter(m => m.kind === pairingKind && discovery.matchesDiet(m,state) && !plan.some(i=>i.id===m.id) && m.price <= remaining + .001 && m.calories <= Math.max(0,goals.calories-t.calories)).sort((a,b)=>a.price-b.price).slice(0,3);
    const preferences = discovery.dietKeys.filter(key=>state[key]).map(key=>dietLabels[key]);
    const outsidePreferences = plan.filter(i=>!discovery.matchesDiet(byId.get(i.id),state)).map(i=>byId.get(i.id).name);
    const preferenceNote = preferences.length ? `<div class="plan-diet-note ${outsidePreferences.length?'has-mismatch':''}"><strong>Your preferences: ${preferences.map(escape).join(' · ')}</strong><p>${outsidePreferences.length ? `Already in your meal and outside these preferences: ${outsidePreferences.map(escape).join(', ')}. Review these items before continuing.` : 'All items in your meal match the selected sample recipe tags.'}</p></div>` : '';
    const first = byId.get(plan.find(i=>byId.get(i.id).kind==='food')?.id || plan[0].id);
    const pickupURL = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${first.name} near University of Houston Houston Texas`);
    $('plan-content').innerHTML = `${preferenceNote}<div class="plan-items">${plan.map(i=>{const m=byId.get(i.id);return `<div class="plan-item"><img src="assets/${m.art}.svg" alt=""><div class="plan-item-name"><strong>${m.name}</strong><span>${m.restaurant} · Sample listing</span><button class="text-button" data-remove-plan="${m.id}" aria-label="Remove ${m.name} from my meal">Remove</button></div><div class="quantity-control"><button data-quantity="${m.id}" data-delta="-1" aria-label="Decrease ${m.name} quantity">−</button><span aria-label="Quantity">${i.qty}</span><button data-quantity="${m.id}" data-delta="1" aria-label="Increase ${m.name} quantity" ${i.qty>=9?'disabled':''}>+</button></div><strong class="line-price">${money(m.price*i.qty)}</strong></div>`;}).join('')}</div><div class="plan-goals"><label>Meal budget <input type="number" min="1" max="100" step="0.5" value="${goals.budget}" data-goal="budget" aria-label="Whole meal budget"></label><label>Calorie limit <input type="number" min="0" max="3000" step="50" value="${goals.calories}" data-goal="calories" aria-label="Whole meal calorie limit"></label><label>Protein target <input type="number" min="0" max="200" step="5" value="${goals.protein}" data-goal="protein" aria-label="Whole meal protein target"></label></div><div class="goal-apply-row"><span>Edit targets, then update your goals.</span><button class="secondary-button" data-apply-goals>Update goals</button></div><div class="plan-totals"><div class="${remaining<-.001?'over-goal':''}"><span>Sample subtotal</span><strong>${money(t.cents/100)}</strong><small>${remaining>=-.001 ? `${money(Math.max(0,remaining))} left in your budget` : `${money(-remaining)} above your budget`}</small></div><div class="${t.calories>goals.calories?'over-goal':''}"><span>Combined calories</span><strong>${t.calories}<em> cal</em></strong><small>${t.calories<=goals.calories ? 'Within your calorie limit' : `${t.calories-goals.calories} above your calorie limit`}</small></div><div><span>Combined protein</span><strong>${t.protein}<em>g</em></strong><small>${t.protein>=goals.protein ? 'Your protein target is met' : `${goals.protein-t.protein}g to your protein target`}</small></div></div><p class="totals-footnote">Sample subtotal before tax, delivery fees and tips. ${t.caffeine ? `Combined sample caffeine: ${t.caffeine}mg.` : ''}</p><div class="pairing-heading"><h3>${hasFood?'Add a little refreshment.':'Make room for a good meal.'}</h3><button class="text-button" data-browse="${pairingKind==='drink'?'drinks':'discover'}">Browse ${pairingKind==='drink'?'drinks':'meals'} →</button></div>${suggestions.length ? `<p class="pairing-caption">These sample picks fit your remaining budget and calorie limit.</p><div class="pairing-grid">${suggestions.map(m=>`<div class="pairing-card"><img src="assets/${m.art}.svg" alt=""><div><strong>${m.name}</strong><span>${money(m.price)} · ${m.calories} cal</span></div><button data-add="${m.id}" aria-label="Add ${m.name} to my meal">+</button></div>`).join('')}</div>` : `<p class="pairing-caption">${preferences.length ? 'No extra item matches your selected preferences and remaining limits.' : 'No extra item fits both remaining limits.'} Browse more options or adjust your meal goals.</p>`}<section class="order-options" aria-labelledby="order-options-title"><span class="eyebrow">TAKE THE NEXT STEP</span><h3 id="order-options-title">Find the real thing.</h3><p>Copy your plan, then explore similar meals from real restaurants. Confirm menus, nutrition, availability and final prices with your chosen service.</p><div class="provider-links"><a class="provider-link doordash-link" href="https://www.doordash.com/food-delivery/houston-tx-restaurants/" target="_blank" rel="noopener noreferrer"><span class="provider-mark">D</span><strong>DoorDash<span>Browse Houston restaurants ↗</span></strong></a><a class="provider-link" href="https://www.ubereats.com/city/houston-tx" target="_blank" rel="noopener noreferrer"><span class="provider-mark uber-mark">UE</span><strong>Uber Eats<span>Explore delivery options ↗</span></strong></a><a class="provider-link" href="${escape(pickupURL)}" target="_blank" rel="noopener noreferrer"><span class="provider-mark pickup-mark">${svg('pin')}</span><strong>Nearby pickup<span>Search similar food on Maps ↗</span></strong></a></div><p class="handoff-note">Opens a separate service. Your sample items are not transferred and no order is placed by MacroMap.</p><button class="secondary-button copy-plan-button" data-copy-plan>Copy my meal plan</button></section>`;
  }
  function openPlan() {
    for(const id of ['detail-dialog','compare-dialog']) if($(id).open) $(id).close();
    renderPlan(); if(!$('plan-dialog').open) $('plan-dialog').showModal();
  }
  function changeQuantity(id,delta) {
    const item = plan.find(i => i.id === id); if(!item) return;
    item.qty = Math.min(9,item.qty+delta); if(item.qty<=0) plan=plan.filter(i=>i.id!==id);
    persistPlan(); render(); renderPlan();
  }
  async function copyPlan() {
    const t=planTotals();
    const text=['MacroMap sample meal plan',...plan.map(i=>{const m=byId.get(i.id);return `${i.qty} x ${m.name}: ${money(m.price*i.qty)} (sample), ${m.calories*i.qty} cal, ${m.protein*i.qty}g protein`;}),`Sample subtotal: ${money(t.cents/100)} before tax, fees and tips`,`Combined nutrition: ${t.calories} cal, ${t.protein}g protein`,`Meal goals: ${money(goals.budget)}, at most ${goals.calories} cal, at least ${goals.protein}g protein`,'All items and figures are fictional. Use this as a search idea, not an actual restaurant order.'].join('\n');
    try {await navigator.clipboard.writeText(text);$('plan-status').textContent='Meal plan copied. You can use it while browsing real menus.';}
    catch {$('copy-plan-output').value=text;$('copy-plan-output').hidden=false;$('copy-plan-output').focus();$('copy-plan-output').select();$('plan-status').textContent='Select and copy the meal plan below.';}
  }
  document.addEventListener('click',event => {
    const target = event.target;
    const alternative = target.closest('[data-suggestion]');
    if(alternative) {
      const suggestion = activeSuggestions[Number(alternative.dataset.suggestion)]; if(!suggestion) return;
      Object.assign(state,suggestion.patch);setFiltersOpen(false);syncInputs();render();
      $('results-heading').focus({preventScroll:true});document.querySelector('.results').scrollIntoView({behavior:'smooth',block:'start'});
      toast('Filters updated. Your dietary choices are kept.');return;
    }
    const close=target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
    const add=target.closest('[data-add]');if(add){addToPlan(add.dataset.add);return;}
    const detail=target.closest('[data-detail]');if(detail){openDetail(detail.dataset.detail);return;}
    const save=target.closest('[data-save]');if(save){saveMeal(save.dataset.save);return;}
    const compare=target.closest('[data-compare]');if(compare){toggleCompare(compare.dataset.compare);return;}
    const remove=target.closest('[data-remove-comparison]');if(remove){toggleCompare(remove.dataset.removeComparison);return;}
    const category=target.closest('[data-category]');if(category){state.category=category.dataset.category;render();return;}
    const quantity=target.closest('[data-quantity]');if(quantity){changeQuantity(quantity.dataset.quantity,Number(quantity.dataset.delta));return;}
    const removePlan=target.closest('[data-remove-plan]');if(removePlan){plan=plan.filter(i=>i.id!==removePlan.dataset.removePlan);persistPlan();render();renderPlan();return;}
    const browse=target.closest('[data-browse]');if(browse){$('plan-dialog').close();changeView(browse.dataset.browse);return;}
    if(target.closest('[data-apply-goals]')){
      const next={};
      for(const el of $('plan-content').querySelectorAll('[data-goal]')) {
        const key=el.dataset.goal,value=Number(el.value),min=Number(el.min),max=Number(el.max);
        if(!el.value.trim() || !Number.isFinite(value) || value<min || value>max){$('plan-status').textContent=`Please enter a ${key} value from ${min} to ${max}.`;el.focus();return;}
        next[key]=value;
      }
      Object.assign(goals,next);persistPlan();renderPlan();$('plan-status').textContent='Meal goals updated.';return;
    }
    if(target.closest('[data-copy-plan]')){copyPlan();return;}
    if(target.closest('[data-open-plan]')){openPlan();return;}
    if(target.closest('[data-about]')) $('about-dialog').showModal();
    if(target.closest('[data-clear]')) clearFilters();
    if(target.closest('[data-discover]')) changeView('discover');
  });
  document.addEventListener('input',event => {
    if(event.target.closest('[data-goal]')) $('plan-status').textContent='Select Update goals to apply your changes.';
  });
  for(const key of ['budget','calories','protein','distance']) $(key).addEventListener('input',()=>{state[key]=Number($(key).value);syncInputs();render();});
  for(const key of discovery.dietKeys) $(key).addEventListener('change',()=>{state[key]=$(key).checked;render();});
  $('search').addEventListener('input',()=>{state.search=$('search').value;render();});
  $('sort').addEventListener('change',()=>{state.sort=$('sort').value;render();});
  $('filter-form').addEventListener('submit',event=>event.preventDefault());
  $('clear-filters').addEventListener('click',clearFilters);
  $('mobile-filter-toggle').addEventListener('click',()=>setFiltersOpen($('mobile-filter-toggle').getAttribute('aria-expanded') !== 'true'));
  $('mobile-filter-done').addEventListener('click',()=>{setFiltersOpen(false,true);document.querySelector('.results').scrollIntoView({behavior:'smooth',block:'start'});});
  for(const [id,view] of [['discover-nav','discover'],['drinks-nav','drinks'],['saved-nav','saved']]) $(id).addEventListener('click',()=>changeView(view));
  $('meal-plan-nav').addEventListener('click',openPlan);$('meal-plan-top').addEventListener('click',openPlan);
  $('try-scenario').addEventListener('click',()=>{
    setFiltersOpen(false);
    const preferences = Object.fromEntries(discovery.dietKeys.map(key=>[key,state[key]]));
    Object.assign(state,defaults,preferences,{view:'discover',budget:15,calories:700,protein:40,distance:5});
    Object.assign(goals,{budget:15,calories:700,protein:40});persistPlan();syncInputs();render();
    $('results-heading').scrollIntoView({behavior:'smooth',block:'start'});toast('Student lunch: $15 max, 700 cal max, at least 40g protein.');
  });
  $('reset-demo').addEventListener('click',()=>{setFiltersOpen(false);state.view='discover';state.compare=[];plan=[];goals={budget:20,calories:900,protein:40};persistPlan();clearFilters();document.querySelectorAll('dialog[open]').forEach(d=>d.close());toast('Demo reset. Saved favorites are kept.');window.scrollTo({top:0,behavior:'smooth'});});
  $('about-button').addEventListener('click',()=>$('about-dialog').showModal());
  $('open-compare').addEventListener('click',()=>{if(state.compare.length>=2){renderComparison();$('compare-dialog').showModal();}});
  $('clear-compare').addEventListener('click',()=>{state.compare=[];render();});
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}}));
  $('detail-dialog').addEventListener('close',()=>detailId=null);
  for(const selector of ['.brand','.footer-brand']) document.querySelector(selector).addEventListener('click',event=>{event.preventDefault();changeView('discover',false);window.scrollTo({top:0,behavior:'smooth'});});
  syncInputs();render();
})();
