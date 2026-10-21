/* Simple, local rules for the illustrative catalog. No external service is used. */
(() => {
  'use strict';
  const dietKeys = ['vegetarian','porkFree','vegan','dairyFree'];
  const limits = {
    budget:{min:1,max:25,step:1,accepts:(m,v)=>m.price<=v,target:m=>Math.ceil(m.price)},
    calories:{min:0,max:1200,step:50,accepts:(m,v)=>m.calories<=v,target:m=>Math.ceil(m.calories/50)*50},
    protein:{min:0,max:70,step:5,accepts:(m,v)=>m.protein>=v,target:m=>Math.floor(m.protein/5)*5},
    distance:{min:1,max:10,step:1,accepts:(m,v)=>m.distance<=v,target:m=>Math.ceil(m.distance)}
  };
  const proteinValue = meal => meal.price > 0 ? meal.protein/meal.price : 0;
  const matchesDiet = (meal,filters) => dietKeys.every(key=>!filters[key] || meal[key] === true);
  function matchesContext(meal,filters,saved) {
    const inView = filters.view === 'saved' ? saved.has(meal.id) : meal.kind === (filters.view === 'drinks' ? 'drink' : 'food');
    return inView && matchesDiet(meal,filters) &&
      (filters.category.startsWith('All ') || meal.category === filters.category) &&
      `${meal.name} ${meal.restaurant} ${meal.ingredients}`.toLowerCase().includes(filters.search.toLowerCase().trim());
  }
  function filter(meals,filters,saved = new Set()) {
    const sorters = {
      price:(a,b)=>a.price-b.price,
      protein:(a,b)=>b.protein-a.protein,
      distance:(a,b)=>a.distance-b.distance,
      calories:(a,b)=>a.calories-b.calories,
      value:(a,b)=>proteinValue(b)-proteinValue(a) || a.price-b.price,
      recommended:(a,b)=>a.rank-b.rank
    };
    return meals.filter(m=>matchesContext(m,filters,saved) && Object.entries(limits).every(([key,rule])=>rule.accepts(m,filters[key])))
      .sort((a,b)=>(sorters[filters.sort] || sorters.recommended)(a,b) || a.rank-b.rank);
  }
  function suggestions(meals,filters,saved = new Set()) {
    const allCategory = filters.view === 'drinks' ? 'All drinks' : filters.view === 'saved' ? 'All saved' : 'All meals';
    const scopes = [{}];
    if(filters.search.trim()) scopes.push({search:''});
    if(!filters.category.startsWith('All ')) scopes.push({category:allCategory});
    if(filters.search.trim() && !filters.category.startsWith('All ')) scopes.push({search:'',category:allCategory});
    const best = new Map();
    const compare = (a,b)=>a.changes-b.changes || a.score-b.score || b.count-a.count || a.rank-b.rank;
    for(const scope of scopes) {
      const scoped = {...filters,...scope};
      for(const meal of meals.filter(m=>matchesContext(m,scoped,saved))) {
        const patch = {...scope}; let score = 0, valid = true;
        for(const [key,rule] of Object.entries(limits)) {
          if(rule.accepts(meal,scoped[key])) continue;
          const next = rule.target(meal);
          if(next<rule.min || next>rule.max) { valid = false; break; }
          patch[key] = next;
          score += Math.abs(next-filters[key])/(rule.max-rule.min);
        }
        const keys = Object.keys(patch).sort();
        if(!valid || !keys.length) continue;
        const count = filter(meals,{...filters,...patch},saved).length;
        if(!count) continue;
        const candidate = {patch,count,changes:keys.length,score,rank:meal.rank};
        const signature = keys.join(',');
        if(!best.has(signature) || compare(candidate,best.get(signature))<0) best.set(signature,candidate);
      }
    }
    return [...best.values()].sort(compare).slice(0,3);
  }
  window.MACROMAP_DISCOVERY = {dietKeys,proteinValue,matchesDiet,filter,suggestions};
})();
