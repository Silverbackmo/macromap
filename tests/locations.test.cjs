const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = {window:{}};
vm.createContext(context);
for(const file of ['meals.js','locations.js','discovery.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
const {MACROMAP_MEALS:source,MACROMAP_LOCATIONS:locations,MACROMAP_DISCOVERY:discovery} = context.window;
const before = JSON.stringify(source);
const filters = {view:'discover',budget:20,calories:900,protein:0,distance:5,vegetarian:false,porkFree:false,vegan:false,dairyFree:false,search:'',category:'All meals',sort:'recommended'};
assert.equal(locations.areas.length,5);
assert.equal(new Set(locations.areas.map(area=>area.id)).size,5);
assert.equal(locations.get('invalid-area').id,locations.defaultId);
assert.equal(locations.get(null).id,locations.defaultId);
const baseline = locations.catalogFor(source,locations.defaultId);
assert.equal(discovery.filter(baseline,{...filters,budget:15,calories:700,protein:40}).length,10,'Original student lunch results stay the same');
let alternatives = 0;
for(const area of locations.areas) {
  const catalog = locations.catalogFor(source,area.id);
  assert.equal(catalog.length,source.length,'Switching area retains every saved and planned item ID');
  for(const [index,meal] of catalog.entries()) {
    for(const key of Object.keys(source[index]).filter(key=>key!=='distance')) assert.equal(meal[key],source[index][key],`${area.id}: ${meal.id}: ${key} stays unchanged`);
    assert.ok(Number.isFinite(meal.distance) && meal.distance>0 && meal.distance<=10);
    if(area.id===locations.defaultId) assert.equal(meal.distance,source[index].distance);
    else assert.notEqual(meal.distance,source[index].distance,'Every area has its own explicit sample distances');
    if(area.id!==locations.defaultId) assert.equal(meal.distance,catalog.find(item=>item.restaurant===meal.restaurant).distance,'New area presets use consistent distances across a restaurant menu');
  }
  const closest = discovery.filter(catalog,{...filters,sort:'distance'});
  for(let i=1;i<closest.length;i++) assert.ok(closest[i-1].distance<=closest[i].distance);
  for(let i=0;i<48;i++) {
    const selected = {...filters,budget:[1,8,12,20][i%4],protein:[0,30,40,70][Math.floor(i/4)%4],distance:i%2?1:5,vegan:i%3===0,porkFree:i%3===1,search:i%11===0?'nomatch':''};
    for(const suggestion of discovery.suggestions(catalog,selected)) {
      const matches = discovery.filter(catalog,{...selected,...suggestion.patch});
      assert.equal(matches.length,suggestion.count);
      assert.ok(matches.length>0);
      for(const meal of matches) assert.ok(meal.distance<=(suggestion.patch.distance??selected.distance) && discovery.matchesDiet(meal,selected));
      alternatives++;
    }
  }
}
const campusNearby = discovery.filter(baseline,{...filters,distance:1});
const galleria = locations.catalogFor(source,'galleria');
const galleriaNearby = discovery.filter(galleria,{...filters,distance:1});
assert.ok(campusNearby.length>0 && galleriaNearby.length>0);
assert.ok(campusNearby.every(meal=>meal.restaurant==='Campus Kitchen'));
assert.ok(galleriaNearby.every(meal=>meal.restaurant==='Nori House'),'Radius results actually change with the selected area');
assert.equal(discovery.filter(galleria,{...filters,sort:'distance'})[0].id,'tuna-bowl');
assert.equal(JSON.stringify(source),before,'Area projection never mutates the original catalog');
console.log(`Location checks passed: five areas, catalog preservation, radius results, closest sorting and ${alternatives} accurate alternatives.`);
