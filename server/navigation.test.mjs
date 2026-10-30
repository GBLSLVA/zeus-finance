import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationItems, mobileNavItems } from '../src/features/navigation/navigation.ts';

test('Navegação: seções são únicas, completas e acessíveis por texto', () => {
  const keys = navigationItems.map(item => item.key);
  assert.deepEqual(keys, [
    'overview', 'incomes', 'transactions', 'budgets',
    'recurring', 'debts', 'goals', 'categories',
  ]);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(navigationItems.every(item => item.label.trim().length > 0 && item.icon));
});

test('Navegação mobile: atalhos pertencem ao menu principal e não se duplicam', () => {
  const all = new Set(navigationItems.map(item => item.key));
  const mobileKeys = mobileNavItems.map(item => item.key);
  assert.deepEqual(mobileKeys, ['overview', 'incomes', 'transactions', 'goals']);
  assert.ok(mobileKeys.every(key => all.has(key)));
  assert.equal(new Set(mobileKeys).size, mobileKeys.length);
});
