import React from 'react';
import { MdArrowDownward, MdArrowUpward, MdVideocam } from 'react-icons/md';
import { Sector, Route } from '../types';
import './RoutesPage.scss';
import { Link } from 'react-router';
import { useCrag } from '../context/CragContext';
import { useFilter } from '../context/FilterContext';
import { getBaseGrade } from '../utils/grades';
import { Pager, RoutesFilter } from '../components';
import RouteRating from '../components/RouteRating';

interface RoutesPageProps {
  sectors: Sector[];
}

type SortField = 'name' | 'grade' | 'rating' | 'sectorName';

/** Routes list row: real routes, or UI placeholders for empty sectors. */
type RouteListRow = Route & { isEmptySector?: boolean };

const createEmptySectorRoute = (sectorName: string): RouteListRow => ({
  name: '',
  grade: '',
  sectorName,
  description: '',
  tags: [],
  images: [],
  isEmptySector: true,
});

const isNullOrEmpty = (value: any): boolean => value === null || value === undefined || value === '';

const RoutesPage: React.FC<RoutesPageProps> = ({ sectors }) => {
  const { getUrl } = useCrag();
  const { sortField, setSortField, sortDirection, setSortDirection } = useFilter();
  const [filteredRoutes, setFilteredRoutes] = React.useState<Route[]>(
    () => sectors.flatMap((sector) => sector.routes)
  );
  const [filteredSectors, setFilteredSectors] = React.useState<Sector[]>(sectors);

  // Sorting logic (client-side)
  const [sortedRoutes, setSortedRoutes] = React.useState<RouteListRow[]>([]);
  const [pagedRoutes, setPagedRoutes] = React.useState<RouteListRow[]>([]);

  // Helper function to compare values for sorting
  const compareValues = (a: any, b: any, field: string, direction: 'asc' | 'desc'): number => {
    let aValue = a[field];
    let bValue = b[field];
    let multiplier = direction === 'asc' ? 1 : -1;

    // Empty values always sink to the bottom, regardless of sort direction
    if (isNullOrEmpty(aValue) && isNullOrEmpty(bValue)) return 0;
    if (isNullOrEmpty(aValue)) return 1;
    if (isNullOrEmpty(bValue)) return -1;

    if (field === 'rating') {
      const aRating = a.rating ?? 0;
      const bRating = b.rating ?? 0;
      return multiplier * (aRating - bRating);
    }

    // Special handling for grades
    if (field === 'grade') {
      // Handle unknown grades - always put them at the end
      if (aValue === '?' && bValue === '?') return 0;
      if (aValue === '?') return 1;  // '?' always goes to the end
      if (bValue === '?') return -1; // '?' always goes to the end

      aValue = getBaseGrade(aValue) + (aValue.includes('+') ? '1' : '0');
      bValue = getBaseGrade(bValue) + (bValue.includes('+') ? '1' : '0');

      // Compare base grades numerically
      return multiplier * aValue.localeCompare(bValue, undefined, { numeric: true });
    }

    // String comparison (case-insensitive)
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return multiplier * aValue.toLowerCase().localeCompare(bValue.toLowerCase());
    }

    // Default comparison
    if (aValue < bValue) return multiplier * -1;
    if (aValue > bValue) return multiplier * 1;
    return 0;
  };

  React.useEffect(() => {
    // Placeholder rows so empty sectors still appear in the route list
    const artificialRoutes = filteredSectors
      .filter((sector) => sector.routes.length === 0)
      .map((sector) => createEmptySectorRoute(sector.name));

    const sorted = [...filteredRoutes, ...artificialRoutes].sort((a, b) => compareValues(a, b, sortField, sortDirection));
    setSortedRoutes(sorted);
  }, [filteredRoutes, filteredSectors, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    const newDirection = field === sortField && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc'
      ? <MdArrowUpward className="sort-icon" aria-hidden="true" />
      : <MdArrowDownward className="sort-icon" aria-hidden="true" />;
  };

  return (
    <div className="routes-page page">
      {/* Route Filter Section */}
      <RoutesFilter
        sectors={sectors}
        onFilteredRoutesChange={setFilteredRoutes}
        onFilteredSectorsChange={setFilteredSectors}
      />

      <div className="routes-grid-container">
        <table className="routes-grid">
          <thead>
            <tr>
              <th
                className="sortable-header"
                onClick={() => handleSort('name')}
              >
                Name {getSortIcon('name')}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort('grade')}
              >
                Grade {getSortIcon('grade')}
              </th>
              <th
                className="sortable-header rating-header"
                onClick={() => handleSort('rating')}
              >
                Rating {getSortIcon('rating')}
              </th>
              <th
                className="sortable-header"
                onClick={() => handleSort('sectorName')}
              >
                Sector {getSortIcon('sectorName')}
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedRoutes.map((route) => {
              const isEmptySectorRow = Boolean(route.isEmptySector);
              return (
                <tr
                  key={
                    isEmptySectorRow
                      ? `empty:${route.sectorName}`
                      : `${route.sectorName}/${route.name}`
                  }
                >
                  <td className="name-cell">
                    <div className="route-name-row">
                      <Link
                        className={isEmptySectorRow ? 'link empty-sector-label' : 'link'}
                        to={
                          isEmptySectorRow
                            ? getUrl(`sector/${encodeURIComponent(route.sectorName.toLowerCase())}`)
                            : getUrl(`sector/${encodeURIComponent(route.sectorName.toLowerCase())}/${encodeURIComponent(route.name.toLowerCase())}`)
                        }
                      >
                        {isEmptySectorRow ? `(no routes)` : route.name}
                      </Link>
                      {(route.videos?.length ?? 0) > 0 && (
                        <Link
                          className="link"
                          to={getUrl(`beta-videos/${encodeURIComponent(route.sectorName.toLowerCase())}/${encodeURIComponent(route.name.toLowerCase())}`)}
                          title="Watch beta videos"
                        >
                          <MdVideocam className="beta-video-icon" aria-hidden="true" />
                        </Link>
                      )}
                      <RouteRating
                        className="route-rating--inline"
                        rating={route.rating}
                        ratingVotes={route.ratingVotes}
                      />
                    </div>
                  </td>
                  <td className="grade-cell">
                    {isEmptySectorRow ? '-' : route.grade || '?'}
                  </td>
                  <td className="rating-cell">
                    <RouteRating rating={route.rating} ratingVotes={route.ratingVotes} />
                  </td>
                  <td>{
                    <Link className='link' to={getUrl(`sector/${encodeURIComponent(route.sectorName.toLowerCase())}`)}>{route.sectorName}</Link>
                  }</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedRoutes.length === 0 && (
          <div className="no-routes">No routes found</div>
        )}
        <Pager items={sortedRoutes} onPageItemsChange={setPagedRoutes} />
      </div>
    </div>
  );
};

export default RoutesPage;
