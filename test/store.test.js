const assert = require('node:assert/strict');
const test = require('node:test');
const { filterMenu, updateCart, cartTotal } = require('../src/store');

const menu = [
  { id: 'latte', name: 'มะลิลาเต้', english: 'Mali latte', detail: 'นมสด', category: 'กาแฟ', price: 95 },
  { id: 'tea', name: 'ชาไทย', english: 'Thai tea', detail: 'ชาเข้ม', category: 'ชา', price: 80 },
];

test('menu filtering combines Thai search text and category', () => {
  assert.deepEqual(filterMenu(menu, 'กาแฟ', '').map((item) => item.id), ['latte']);
  assert.deepEqual(filterMenu(menu, 'ทั้งหมด', 'THAI').map((item) => item.id), ['tea']);
  assert.deepEqual(filterMenu(menu, 'ชา', 'ลาเต้'), []);
});

test('cart quantities increment, decrement, and remove zero-quantity lines', () => {
  const one = updateCart({}, 'latte', 1);
  assert.deepEqual(one, { latte: 1 });
  const two = updateCart(one, 'latte', 1);
  assert.deepEqual(two, { latte: 2 });
  assert.deepEqual(updateCart(two, 'latte', -1), { latte: 1 });
  assert.deepEqual(updateCart(one, 'latte', -1), {});
  assert.deepEqual(updateCart({}, 'unknown', -1), {});
});

test('cart totals use menu prices and ignore unknown products', () => {
  assert.equal(cartTotal(menu, { latte: 2, tea: 1 }), 270);
  assert.equal(cartTotal(menu, { unknown: 5 }), 0);
});