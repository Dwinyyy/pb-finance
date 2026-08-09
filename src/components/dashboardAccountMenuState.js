export const ACCOUNT_MENU_CLOSE_DELAY_MS = 180;
export const ACCOUNT_MENU_VIEWPORT_INSET_PX = 18;

export const createDashboardAccountMenuState = () => ({
  focusWithin: false,
  hoverPreview: false,
  pinned: false,
  view: 'actions',
});

export const isDashboardAccountMenuOpen = (state) => Boolean(
  state?.focusWithin || state?.hoverPreview || state?.pinned
);

export const shouldUseHoverPreview = ({ hoverCapable, pointerType }) => (
  hoverCapable === true && pointerType === 'mouse'
);

export const getDashboardAccountMenuTriggerLabel = (state, name) => (
  `${state?.pinned ? 'Close' : 'Open'} account menu for ${String(name || '').trim()}`
);

export const getDashboardAccountMenuPanelMaxHeight = ({ panelTop, viewportHeight }) => {
  const normalizedTop = Math.round(Number(panelTop));
  const normalizedViewportHeight = Math.floor(Number(viewportHeight));

  if (!Number.isFinite(normalizedTop) || !Number.isFinite(normalizedViewportHeight)) return 0;

  return Math.max(0, normalizedViewportHeight - normalizedTop - ACCOUNT_MENU_VIEWPORT_INSET_PX);
};

export const dashboardAccountMenuReducer = (state, action) => {
  switch (action.type) {
    case 'hover-enter':
      return { ...state, hoverPreview: true };
    case 'hover-close-expired':
      return { ...state, hoverPreview: false };
    case 'toggle-pin':
      return state.pinned
        ? createDashboardAccountMenuState()
        : { ...state, pinned: true };
    case 'focus-enter':
      return { ...state, focusWithin: true };
    case 'focus-leave':
      return { ...state, focusWithin: false };
    case 'show-notifications':
      return { ...state, pinned: true, view: 'notifications' };
    case 'show-actions':
      return { ...state, view: 'actions' };
    case 'dismiss':
      return createDashboardAccountMenuState();
    default:
      return state;
  }
};
