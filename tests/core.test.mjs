// Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { transmute, computePeriod, computeFinal, collegePoint, PRESETS, transmutationRows } from '../www/js/grading.js';
import { evaluate, stats, truthTable, nCr, normalCdf, factorString } from '../www/js/mathcore.js';
import { GENERATORS, buildQuiz } from '../www/js/quizgen.js';

test('DepEd transmutation table boundaries', () => {
  assert.equal(transmute(100), 100);
  assert.equal(transmute(99.99), 99);
  assert.equal(transmute(98.4), 99);
  assert.equal(transmute(98.39), 98);
  assert.equal(transmute(61.6), 76);
  assert.equal(transmute(60), 75);
  assert.equal(transmute(59.99), 74);
  assert.equal(transmute(56), 74);
  assert.equal(transmute(3.99), 60);
  assert.equal(transmute(0), 60);
  // every row of the reference table agrees with the function
  for (const r of transmutationRows()) {
    assert.equal(transmute(r.from), r.tg, `from ${r.from}`);
    assert.equal(transmute(r.to), r.tg, `to ${r.to}`);
  }
});

test('computePeriod: JHS weights 40/40/20', () => {
  const cls = {
    scale: 'deped', ...structuredClone(PRESETS.jhs),
    assessments: [
      { id: 'a', period: 'Q1', comp: 'WW', max: 20 },
      { id: 'b', period: 'Q1', comp: 'PT', max: 50 },
      { id: 'c', period: 'Q1', comp: 'QA', max: 40 },
    ],
    scores: { a: { s1: 16 }, b: { s1: 40 }, c: { s1: 30 } },
  };
  const r = computePeriod(cls, 's1', 'Q1');
  // WW 80% * .4 = 32, PT 80% * .4 = 32, QA 75% * .2 = 15 → 79 → transmuted 86
  assert.equal(r.initial, 79);
  assert.equal(r.grade, 86);
  assert.equal(r.descriptor, 'Very Satisfactory');
  assert.equal(r.partial, false);
  // blank score counts as zero
  const r2 = computePeriod(cls, 's2', 'Q1');
  assert.equal(r2.initial, 0);
  assert.equal(r2.grade, 60);
});

test('computePeriod: partial components re-scale weights', () => {
  const cls = {
    scale: 'deped', ...structuredClone(PRESETS.jhs),
    assessments: [{ id: 'a', period: 'Q1', comp: 'WW', max: 10 }],
    scores: { a: { s1: 9 } },
  };
  const r = computePeriod(cls, 's1', 'Q1');
  assert.equal(r.initial, 90);
  assert.equal(r.partial, true);
});

test('college scale and base-50', () => {
  assert.equal(collegePoint(97), '1.00');
  assert.equal(collegePoint(75), '3.00');
  assert.equal(collegePoint(74.4), '5.00');
  const cls = {
    scale: 'college', collegeBase: 50, ...structuredClone(PRESETS.college), scale2: 1,
    assessments: [{ id: 'a', period: 'Prelim', comp: 'QZ', max: 10 }],
    scores: { a: { s1: 5 } },
  };
  cls.scale = 'college';
  const r = computePeriod(cls, 's1', 'Prelim');
  assert.equal(r.initial, 75); // 5/10*50+50
  assert.equal(r.display, '3.00');
  const f = computeFinal(cls, 's1');
  assert.equal(f.complete, false);
  assert.equal(f.display, '3.00');
});

test('expression parser', () => {
  assert.equal(evaluate('2x^2+3x-1', { x: 2 }), 13);
  assert.equal(evaluate('-x^2', { x: 3 }), -9);
  assert.equal(evaluate('2(3+4)'), 14);
  assert.equal(evaluate('5!'), 120);
  assert.ok(Math.abs(evaluate('sin(30)', {}, { deg: true }) - 0.5) < 1e-12);
  assert.ok(Math.abs(evaluate('sqrt(2)^2') - 2) < 1e-12);
  assert.ok(Math.abs(evaluate('2pi') - 2 * Math.PI) < 1e-12);
  assert.equal(evaluate('log(1000)'), 3);
  assert.equal(evaluate('2^3^2'), 512);
  assert.throws(() => evaluate('2+'));
  assert.throws(() => evaluate('alert(1)'));
});

test('statistics', () => {
  const s = stats([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(s.mean, 5);
  assert.equal(s.median, 4.5);
  assert.deepEqual(s.mode, [4]);
  assert.equal(s.popSD, 2);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-4);
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-12);
  assert.equal(nCr(10, 3), 120);
  assert.equal(factorString(360), '2³ × 3² × 5');
});

test('truth tables', () => {
  const t = truthTable('p -> q');
  assert.deepEqual(t.rows.map((r) => r.cols.at(-1)), [true, false, true, true]);
  assert.equal(truthTable('p v ~p').kind, 'Tautology');
  assert.equal(truthTable('p ∧ ¬p').kind, 'Contradiction');
  assert.equal(truthTable('(p ∧ q) → r').rows.length, 8);
});

test('every quiz generator produces items', () => {
  for (const g of GENERATORS) {
    for (let i = 0; i < 200; i++) {
      const it = g.gen();
      assert.ok(typeof it.q === 'string' && it.q.length > 5, g.id);
      assert.ok(typeof it.a === 'string' && it.a.length > 0, g.id);
      assert.ok(!/undefined|NaN|Infinity/.test(it.q + it.a), `${g.id}: ${it.q} => ${it.a}`);
    }
  }
  const q = buildQuiz({ [GENERATORS[0].id]: 5, [GENERATORS[5].id]: 3 });
  assert.equal(q.length, 8);
});
