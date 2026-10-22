/* Area presets for the fictional demo catalog. These are sample distances,
   not restaurant addresses, measured routes or a visitor's device location. */
(() => {
  'use strict';
  const areas = [
    {id:'uh',label:'University of Houston',search:'University of Houston, Houston, Texas'},
    {id:'downtown',label:'Downtown Houston',search:'Downtown Houston, Texas'},
    {id:'midtown',label:'Midtown',search:'Midtown, Houston, Texas'},
    {id:'montrose',label:'Montrose',search:'Montrose, Houston, Texas'},
    {id:'galleria',label:'The Galleria',search:'The Galleria, Houston, Texas'}
  ];
  const distances = {
    downtown:{'Bayou Bowl Co.':2.1,'Campus Kitchen':4.8,'Coast & Grain':1.2,'Green Table':3.3,'Pita Grove':2.9,'Rice District':.9,'Nori House':3.8,'Pasta Field':1.5,'Cullen Taco House':5.7,'Parkside Grill':4.4,'Campus Coffee':4.6},
    midtown:{'Bayou Bowl Co.':2.4,'Campus Kitchen':4.1,'Coast & Grain':2.7,'Green Table':1.4,'Pita Grove':2.2,'Rice District':2.9,'Nori House':4.8,'Pasta Field':1,'Cullen Taco House':5.2,'Parkside Grill':1.8,'Campus Coffee':3.8},
    montrose:{'Bayou Bowl Co.':4.7,'Campus Kitchen':7.3,'Coast & Grain':3.4,'Green Table':1.1,'Pita Grove':2.5,'Rice District':5.6,'Nori House':2.8,'Pasta Field':1.7,'Cullen Taco House':7.6,'Parkside Grill':1.3,'Campus Coffee':6.9},
    galleria:{'Bayou Bowl Co.':8.2,'Campus Kitchen':9.6,'Coast & Grain':2.2,'Green Table':5.8,'Pita Grove':4.1,'Rice District':7.9,'Nori House':1,'Pasta Field':4.6,'Cullen Taco House':9.8,'Parkside Grill':3.5,'Campus Coffee':9.3}
  };
  const defaultId = 'uh';
  const get = id => areas.find(area=>area.id===id) || areas[0];
  function catalogFor(catalog,id) {
    const profile = distances[get(id).id];
    return catalog.map(meal=>({...meal,distance:profile && Number.isFinite(profile[meal.restaurant]) ? profile[meal.restaurant] : meal.distance}));
  }
  window.MACROMAP_LOCATIONS = {areas,defaultId,get,catalogFor};
})();
