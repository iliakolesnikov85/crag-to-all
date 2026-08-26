import React from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import Button from './Button';
import './Pager.scss';

export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 500;
export const PAGE_SIZE_STEP = 100;

interface PagerProps<T> {
  items: T[];
  onPageItemsChange: (pagedItems: T[]) => void;
  initialPageSize?: number;
  maxPageSize?: number;
  pageSizeStep?: number;
}

type PageItem = number | 'ellipsis';

function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
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

function Pager<T>({
  items,
  onPageItemsChange,
  initialPageSize = DEFAULT_PAGE_SIZE,
  maxPageSize = MAX_PAGE_SIZE,
  pageSizeStep = PAGE_SIZE_STEP,
}: PagerProps<T>) {
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [currentPage, setCurrentPage] = React.useState(1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const canSeeMore = pageSize < maxPageSize && pageSize < totalItems;
  const canGoPrev = safePage > 1;
  const canGoNext = safePage < totalPages;
  const pageItems = buildPageItems(safePage, totalPages);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [items]);

  React.useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  React.useLayoutEffect(() => {
    onPageItemsChange(items.slice((safePage - 1) * pageSize, safePage * pageSize));
  }, [items, safePage, pageSize, onPageItemsChange]);

  const handleSeeMore = () => {
    if (!canSeeMore) return;
    setPageSize((size) => Math.min(size + pageSizeStep, maxPageSize));
    setCurrentPage(1);
  };

  if (totalItems === 0 || (totalPages <= 1 && !canSeeMore)) {
    return null;
  }

  return (
    <nav className="pager" aria-label="Pagination">
      <Button
        variant="primary"
        size="md"
        className="pager-see-more"
        onClick={handleSeeMore}
        disabled={!canSeeMore}
      >
        See More
      </Button>

      <Button
        variant="secondary"
        size="md"
        iconOnly
        onClick={() => setCurrentPage(safePage - 1)}
        disabled={!canGoPrev}
        aria-label="Previous page"
      >
        <MdChevronLeft aria-hidden="true" />
      </Button>

      {pageItems.map((item, index) =>
        item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="pager-ellipsis" aria-hidden="true">
            …
          </span>
        ) : (
          <Button
            key={item}
            variant="secondary"
            size="md"
            active={item === safePage}
            onClick={() => setCurrentPage(item)}
            aria-label={`Page ${item}`}
            aria-current={item === safePage ? 'page' : undefined}
          >
            {item}
          </Button>
        )
      )}

      <Button
        variant="secondary"
        size="md"
        iconOnly
        onClick={() => setCurrentPage(safePage + 1)}
        disabled={!canGoNext}
        aria-label="Next page"
      >
        <MdChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}

export default Pager;
