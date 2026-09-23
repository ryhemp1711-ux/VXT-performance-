const {test}=require('node:test');const assert=require('node:assert/strict');const P=require('../screenshot-parser.js');const V=require('../model.js');
const text=`100 Meters
2015 Outdoor 9 10.85
2016 Outdoor 10 10.70 *
2017 Outdoor 11 10.88
2018 Outdoor 12 10.42 (0.4) PB*
2022 Outdoor Sr 9.95 (1.5) *
2024 Outdoor 7 9.82 (3.0) *
2025 Outdoor 8 9.79 (1.8) PB*
2026 Outdoor 9 9.72 (2.4) PB*
200 Meters
2015 Indoor 9 23.09
2015 Outdoor 9 21.57 *
2016 Indoor 10 22.22
2016 Outdoor 10 21.24 *
2017 Indoor 11 22.51
2017 Outdoor 11 21.34 *
2018 Indoor 12 21.91
2018 Outdoor 12 20.43 (0.4) PB *`;
test('screenshot season table keeps year, event, wind and unknown timing',()=>{const rows=P.parse(text);assert.equal(rows.length,16);assert.equal(rows[7].time,9.72);assert.equal(rows[7].date,'2026');assert.equal(rows[7].method,'Unknown');assert.match(rows[7].notes,/Wind: 2.4/);assert.equal(rows[8].event,'200m');assert.equal(rows[15].time,20.43);});
test('55m, 60m, grade column and negative wind',()=>{const rows=P.parse('55 Meter\n2026 Indoor 10 6.17 PB *\n60 Meter\n2026 Indoor 10 6.59 PB *\n200 Meters\n2021 Outdoor 5 27.41 (-2.1) PB *');assert.deepEqual(rows.map(r=>r.time),[6.17,6.59,27.41]);assert.match(rows[2].notes,/Wind: -2.1/);});
test('unsupported headings do not inherit previous event',()=>{assert.equal(P.parse('100 Meters\n2026 Outdoor 9 10.00\n800 Meters\n2026 Outdoor 9 2:01.20').length,1);});
test('rows lacking event or a decimal time are not guessed',()=>{assert.equal(P.parse('2026 Outdoor 10 10.55\n100 Meters\n2026 Outdoor 10').length,0);});
test('append preserves other athlete records and skips exact duplicates',()=>{const base={version:1,athletes:[{id:'a',name:'A'}],results:[],predictions:[]};let i=0;const first=P.merge(base,'a',P.parse(text),()=>String(++i));V.validateData(first.data);assert.equal(first.added,16);assert.equal(base.results.length,0);const second=P.merge(first.data,'a',P.parse(text),()=>String(++i));assert.equal(second.added,0);assert.equal(second.duplicates,16);});
test('backup accepts year-only 55m record and still accepts exact dates',()=>{const base={version:1,athletes:[{id:'a',name:'A'}],results:[{id:'r',athleteId:'a',event:'55m',date:'2026',time:6.17}],predictions:[]};V.validateData(base);base.results[0].date='2026-09-22';V.validateData(base);base.results[0].date='bad';assert.throws(()=>V.validateData(base));});
