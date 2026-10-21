const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = {window:{}};
vm.createContext(context);
for(const file of ['meals.js','discovery.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
const meals = context.window.MACROMAP_MEALS;
const discovery = context.window.MACROMAP_DISCOVERY;
const defaults = {view:'discover',budget:20,calories:900,protein:0,distance:5,vegetarian:false,porkFree:false,vegan:false,dairyFree:false,search:'',category:'All meals',sort:'recommended'};
const saved = new Set(['chicken-bowl','tofu-bowl','lentil-soup','viet-coffee','matcha-latte']);
const find = id=>meals.find(m=>m.id===id);
assert.equal(new Set(meals.map(m=>m.id)).size,meals.length);
for(const m of meals) {
  for(const key of discovery.dietKeys) assert.equal(typeof m[key],'boolean',`${m.id}: ${key}`);
  if(m.vegan) assert.ok(m.vegetarian && m.dairyFree && m.porkFree,`${m.id}: vegan tags agree`);
  assert.ok(Number.isFinite(discovery.proteinValue(m)));
}
assert.ok(discovery.filter(meals,defaults).some(m=>m.id==='pork-bowl'));
assert.ok(!discovery.filter(meals,{...defaults,porkFree:true}).some(m=>m.id==='pork-bowl'));
assert.equal(discovery.filter(meals,{...defaults,vegan:true}).length,3);
assert.ok(!discovery.filter(meals,{...defaults,view:'drinks',category:'All drinks',dairyFree:true}).some(m=>m.id==='viet-coffee'));
const bestValue = discovery.filter(meals,{...defaults,sort:'value'});
assert.equal(bestValue[0].id,'breakfast-burrito');
for(let i=1;i<bestValue.length;i++) assert.ok(discovery.proteinValue(bestValue[i-1])>=discovery.proteinValue(bestValue[i]));
const budgetSuggestion = discovery.suggestions(meals,{...defaults,budget:8,protein:40}).find(s=>s.patch.budget===9 && Object.keys(s.patch).length===1);
assert.ok(budgetSuggestion,'A $1 price adjustment reveals a high protein breakfast');
const veganSuggestion = discovery.suggestions(meals,{...defaults,vegan:true,protein:40})[0];
assert.equal(veganSuggestion.patch.protein,30);
assert.equal(veganSuggestion.count,1);
const noSearch = discovery.suggestions(meals,{...defaults,vegan:true,search:'zznothingmatches'})[0];
assert.equal(noSearch.patch.search,'');
assert.equal(noSearch.count,3);
assert.equal(discovery.suggestions(meals,{...defaults,view:'saved',category:'All saved'},new Set()).length,0);
let checked = 0;
for(let i=0;i<192;i++) {
  const view = ['discover','drinks','saved'][i%3];
  const filters = {...defaults,view,category:view==='drinks'?'All drinks':view==='saved'?'All saved':'All meals',budget:[1,8,12,20][i%4],calories:[0,400,700,900][Math.floor(i/4)%4],protein:[0,30,40,70][Math.floor(i/16)%4],distance:i%5?5:1,search:i%11===0?'nomatch':''};
  for(let j=0;j<discovery.dietKeys.length;j++) filters[discovery.dietKeys[j]]=Boolean(i & (1<<j));
  if(i%7===0 && view==='discover') filters.category='Bowls';
  if(discovery.filter(meals,filters,saved).length) continue;
  for(const suggestion of discovery.suggestions(meals,filters,saved)) {
    assert.ok(Object.keys(suggestion.patch).every(key=>['budget','calories','protein','distance','search','category'].includes(key)),'Suggestions never change dietary choices');
    const updated = {...filters,...suggestion.patch};
    const matches = discovery.filter(meals,updated,saved);
    assert.equal(matches.length,suggestion.count,'Every proposed result count is accurate');
    assert.ok(matches.length>0,'Every proposed action reveals a match');
    for(const m of matches) {
      assert.ok(discovery.matchesDiet(m,filters),'Original dietary choices remain satisfied');
      if(view==='drinks') assert.equal(m.kind,'drink');
      if(view==='discover') assert.equal(m.kind,'food');
      if(view==='saved') assert.ok(saved.has(m.id));
    }
    assert.ok(updated.budget>=1 && updated.budget<=25 && Number.isInteger(updated.budget));
    assert.ok(updated.calories>=0 && updated.calories<=1200 && updated.calories%50===0);
    assert.ok(updated.protein>=0 && updated.protein<=70 && updated.protein%5===0);
    assert.ok(updated.distance>=1 && updated.distance<=10 && Number.isInteger(updated.distance));
    checked++;
  }
}
console.log(`Discovery checks passed: dietary tags, protein value sorting, explicit alternatives, and ${checked} constrained suggestions.`);
