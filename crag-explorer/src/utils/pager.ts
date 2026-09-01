export type PagerItem = number | 'ellipsis';

export function buildPagerItems(currentPage: number, totalPages: number): PagerItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const showLeftEllipsis = currentPage > 4;
  const showRightEllipsis = currentPage < totalPages - 3;

  if (!showLeftEllipsis) {
    return [...Array.from({ length: 6 }, (_, i) => i + 1), 'ellipsis', totalPages];
  }

  if (!showRightEllipsis) {
    return [1, 'ellipsis', ...Array.from({ length: 6 }, (_, i) => totalPages - 5 + i)];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}
