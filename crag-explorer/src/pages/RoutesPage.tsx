import React from 'react';
import { MdArrowDownward, MdArrowUpward, MdVideocam } from 'react-icons/md';
import { Link } from 'react-router';
import { canEditCrag } from '../api/permissions';
import { Pager, RoutesFilter } from '../components';
import RouteRating from '../components/RouteRating';
import { useCrag } from '../context/CragContext';
import { useFilter } from '../context/FilterContext';
import { Sector, Route } from '../types';
import {
  sortRouteRows,
  type RouteListRow,
  type SortField,
} from '../utils/routesSort';
import RoutesPageListOptionsMenu from '../components/RoutesPageListOptionsMenu';
import useDetailsEditors from './useDetailsEditors';
import './RoutesPage.scss';

const MISSING_SECTOR_MESSAGE = 'This sector could not be found.';
const MISSING_ROUTE_MESSAGE = 'This route could not be found.';

interface RoutesPageProps {
  sectors: Sector[];
}

function sectorNamed(sectors: readonly Sector[], name: string): Sector | undefined {
  const key = name.toLowerCase();
  return sectors.find((sector) => sector.name.toLowerCase() === key);
}

const RoutesPage: React.FC<RoutesPageProps> = ({ sectors }) => {
  const { crag, getUrl } = useCrag();
  const canEdit = canEditCrag(crag);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const editors = useDetailsEditors({
    sectors,
    onNotice: setActionError,
  });
  const { sortField, setSortField, sortDirection, setSortDirection } = useFilter();
  const [filteredRoutes, setFilteredRoutes] = React.useState<Route[]>(
    () => sectors.flatMap((sector) => sector.routes)
  );
  const [filteredSectors, setFilteredSectors] = React.useState<Sector[]>(sectors);

  // Sorting logic (client-side)
  const [sortedRoutes, setSortedRoutes] = React.useState<RouteListRow[]>([]);
  const [pagedRoutes, setPagedRoutes] = React.useState<RouteListRow[]>([]);

  React.useEffect(() => {
    setSortedRoutes(
      sortRouteRows(filteredRoutes, filteredSectors, sortField, sortDirection),
    );
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

  const openSectorDetails = (row: RouteListRow) => {
    const sector = sectorNamed(sectors, row.sectorName);
    if (!sector) {
      setActionError(MISSING_SECTOR_MESSAGE);
      return;
    }
    editors.openSector(sector);
  };

  const openRouteDetails = (row: RouteListRow) => {
    const sector = sectorNamed(sectors, row.sectorName);
    if (!sector) {
      setActionError(MISSING_SECTOR_MESSAGE);
      return;
    }
    const index = sector.routes.findIndex((item) => item.id === row.id);
    if (index < 0) {
      setActionError(MISSING_ROUTE_MESSAGE);
      return;
    }
    editors.openRoute(sector, index);
  };

  return (
    <div className="routes-page page">
      {/* Route Filter Section */}
      <RoutesFilter
        sectors={sectors}
        onFilteredRoutesChange={setFilteredRoutes}
        onFilteredSectorsChange={setFilteredSectors}
      />

      {actionError ? (
        <p className="routes-page__alert" role="alert">{actionError}</p>
      ) : null}

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
              {canEdit ? <th className="options-header" aria-label="Options" /> : null}
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
                  {canEdit ? (
                    <td className="options-cell">
                      <RoutesPageListOptionsMenu
                        label={
                          isEmptySectorRow
                            ? `Options for ${route.sectorName}`
                            : `Options for ${route.name}`
                        }
                        disabled={editors.saving}
                        onEditRoute={isEmptySectorRow ? undefined : () => openRouteDetails(route)}
                        onEditSector={() => openSectorDetails(route)}
                      />
                    </td>
                  ) : null}
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
      {editors.dialogs}
    </div>
  );
};

export default RoutesPage;
