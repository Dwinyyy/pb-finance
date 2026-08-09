import assert from 'node:assert/strict';
import test from 'node:test';

import * as accountMenuState from '../src/components/dashboardAccountMenuState.js';

const {
  ACCOUNT_MENU_CLOSE_DELAY_MS,
  ACCOUNT_MENU_VIEWPORT_INSET_PX,
  createDashboardAccountMenuState,
  dashboardAccountMenuReducer,
  getDashboardAccountMenuPanelMaxHeight,
  getDashboardAccountMenuTriggerLabel,
  isDashboardAccountMenuOpen,
  shouldUseHoverPreview,
} = accountMenuState;

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

test('preview state announces the pin action while pinned state announces close', () => {
  assert.equal(typeof getDashboardAccountMenuTriggerLabel, 'function');
  const focused = dashboardAccountMenuReducer(createDashboardAccountMenuState(), { type: 'focus-enter' });
  const hovered = dashboardAccountMenuReducer(createDashboardAccountMenuState(), { type: 'hover-enter' });
  const pinned = dashboardAccountMenuReducer(focused, { type: 'toggle-pin' });

  assert.equal(isDashboardAccountMenuOpen(focused), true);
  assert.equal(getDashboardAccountMenuTriggerLabel(focused, 'Aldwin Gotingco'), 'Open account menu for Aldwin Gotingco');
  assert.equal(getDashboardAccountMenuTriggerLabel(hovered, 'Aldwin Gotingco'), 'Open account menu for Aldwin Gotingco');
  assert.equal(getDashboardAccountMenuTriggerLabel(pinned, 'Aldwin Gotingco'), 'Close account menu for Aldwin Gotingco');
});

test('panel height reserves the full bottom inset outside the pointer bridge', () => {
  assert.equal(ACCOUNT_MENU_VIEWPORT_INSET_PX, 18);
  assert.equal(typeof getDashboardAccountMenuPanelMaxHeight, 'function');
  assert.equal(getDashboardAccountMenuPanelMaxHeight({ panelTop: 55, viewportHeight: 320 }), 247);
  assert.equal(55 + 247, 320 - ACCOUNT_MENU_VIEWPORT_INSET_PX);
  assert.equal(getDashboardAccountMenuPanelMaxHeight({ panelTop: 400, viewportHeight: 320 }), 0);
});
