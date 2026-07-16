import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOUNT_MENU_CLOSE_DELAY_MS,
  createDashboardAccountMenuState,
  dashboardAccountMenuReducer,
  isDashboardAccountMenuOpen,
  shouldUseHoverPreview,
} from '../src/components/dashboardAccountMenuState.js';

test('hover preview opens, survives re-entry, and closes only after expiry', () => {
  let state = createDashboardAccountMenuState();
  state = dashboardAccountMenuReducer(state, { type: 'hover-enter' });
  assert.equal(isDashboardAccountMenuOpen(state), true);
  state = dashboardAccountMenuReducer(state, { type: 'hover-close-expired' });
  assert.equal(isDashboardAccountMenuOpen(state), false);
  assert.equal(ACCOUNT_MENU_CLOSE_DELAY_MS, 180);
});

test('pinning is independent from hover and notifications return to actions', () => {
  let state = dashboardAccountMenuReducer(createDashboardAccountMenuState(), { type: 'toggle-pin' });
  state = dashboardAccountMenuReducer(state, { type: 'hover-close-expired' });
  assert.equal(isDashboardAccountMenuOpen(state), true);
  state = dashboardAccountMenuReducer(state, { type: 'show-notifications' });
  assert.equal(state.view, 'notifications');
  state = dashboardAccountMenuReducer(state, { type: 'show-actions' });
  assert.equal(state.view, 'actions');
  state = dashboardAccountMenuReducer(state, { type: 'focus-enter' });
  state = dashboardAccountMenuReducer(state, { type: 'toggle-pin' });
  assert.deepEqual(state, createDashboardAccountMenuState());
});

test('Escape and outside dismissal clear every open source', () => {
  const open = { focusWithin: true, hoverPreview: true, pinned: true, view: 'notifications' };
  assert.deepEqual(
    dashboardAccountMenuReducer(open, { type: 'dismiss' }),
    createDashboardAccountMenuState()
  );
});

test('hover preview accepts only hover-capable mouse input', () => {
  assert.equal(shouldUseHoverPreview({ hoverCapable: true, pointerType: 'mouse' }), true);
  assert.equal(shouldUseHoverPreview({ hoverCapable: false, pointerType: 'mouse' }), false);
  assert.equal(shouldUseHoverPreview({ hoverCapable: true, pointerType: 'touch' }), false);
  assert.equal(shouldUseHoverPreview({ hoverCapable: true, pointerType: 'pen' }), false);
});
