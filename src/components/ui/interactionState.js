const ARROW_DIRECTIONS = Object.freeze({
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
});

export const canActivateControl = ({ disabled = false, isBusy = false }) => !disabled && !isBusy;

export function nextSegmentedIndex({ currentIndex, key, optionCount }) {
  const direction = ARROW_DIRECTIONS[key];
  if (
    direction === undefined
    || !Number.isInteger(currentIndex)
    || !Number.isInteger(optionCount)
    || optionCount <= 0
    || currentIndex < 0
    || currentIndex >= optionCount
  ) {
    return null;
  }

  return (currentIndex + direction + optionCount) % optionCount;
}
