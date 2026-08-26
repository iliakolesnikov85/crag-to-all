import React from 'react';
import { MdClose, MdPlayArrow } from 'react-icons/md';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import './RoutesFilter.scss';
import { getBaseGrade } from '../utils/grades';
import { Route, Sector } from '../types';
import { useFilter } from '../context/FilterContext';
import Button from './Button';

interface RoutesFilterProps {
  sectors: Sector[];
  onFilteredRoutesChange?: (filteredRoutes: Route[]) => void;
  onFilteredSectorsChange?: (filteredSectors: Sector[]) => void;
}

const RoutesFilter: React.FC<RoutesFilterProps> = ({
  sectors,
  onFilteredRoutesChange,
  onFilteredSectorsChange,
}) => {
  // Use shared filter state from context
  const {
    gradeRange,
    setGradeRange,
    textFilter,
    setTextFilter,
    hideUnknownGrades,
    setHideUnknownGrades,
    hideSectorsWithoutRoutes,
    setHideSectorsWithoutRoutes,
    isExpanded,
    setIsExpanded
  } = useFilter();

  const routes = React.useMemo(
    () => sectors.flatMap((sector) => sector.routes),
    [sectors]
  );

  // Get all available grades for the slider
  const availableGrades = React.useMemo(() => {
    const grades = new Set<string>();
    routes.forEach(route => {
      if (route.grade && route.grade !== '?') {
        grades.add(getBaseGrade(route.grade));
      }
    });
    return Array.from(grades).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [routes]);

  const showGradeSlider = availableGrades.length > 1;

  // Initialize grade range when the slider becomes usable; reset if out of bounds
  React.useEffect(() => {
    if (!showGradeSlider) return;
    const max = availableGrades.length - 1;
    const outOfBounds =
      gradeRange[0] < 0 ||
      gradeRange[1] < 0 ||
      gradeRange[0] > max ||
      gradeRange[1] > max;
    if (outOfBounds || (gradeRange[0] === 0 && gradeRange[1] === 0)) {
      setGradeRange([0, max]);
    }
  }, [availableGrades, showGradeSlider, gradeRange, setGradeRange]);

  const isGradeRangeSet =
    showGradeSlider &&
    (gradeRange[0] > 0 || gradeRange[1] < availableGrades.length - 1);

  // Helper function to check if a grade is within the filter range
  const isGradeInRange = React.useCallback((grade?: string): boolean => {
    if (!grade || grade === '?') {
      return hideUnknownGrades || isGradeRangeSet ? false : true;
    }

    if (!showGradeSlider) return true;

    const baseGrade = getBaseGrade(grade);
    const gradeIndex = availableGrades.indexOf(baseGrade);

    if (gradeIndex === -1) return true; // Include grades not in available grades

    return gradeIndex >= gradeRange[0] && gradeIndex <= gradeRange[1];
  }, [availableGrades, gradeRange, hideUnknownGrades, isGradeRangeSet, showGradeSlider]);

  const isTextFilterActive = textFilter.trim().length > 1;

  // Helper function to check if a route matches the text filter
  const matchesTextFilter = React.useCallback((route: Route): boolean => {
    if (!isTextFilterActive) return true;

    const searchTerm = textFilter.toLowerCase().trim();
    const routeName = route.name.toLowerCase();
    const sectorName = route.sectorName.toLowerCase();

    return routeName.includes(searchTerm) || sectorName.includes(searchTerm);
  }, [textFilter, isTextFilterActive]);

  // Helper function to check if an empty sector matches the text filter
  const matchesEmptySectorTextFilter = React.useCallback((sector: Sector): boolean => {
    if (!isTextFilterActive) return true;
    const searchTerm = textFilter.toLowerCase().trim();
    return sector.name.toLowerCase().includes(searchTerm);
  }, [textFilter, isTextFilterActive]);

  // Compute filtered routes and notify parent component
  const filteredRoutes = React.useMemo(() => {
    return routes.filter(route =>
      isGradeInRange(route.grade) && matchesTextFilter(route)
    );
  }, [routes, isGradeInRange, matchesTextFilter]);

  const filteredSectors = React.useMemo(() => {
    const filteredRouteIds = new Set(
      filteredRoutes.map(route => `${route.name.toLowerCase()}-${route.sectorName.toLowerCase()}`)
    );

    return sectors.flatMap((sector) => {
      const hadNoRoutes = sector.routes.length === 0;
      const sectorRoutes = sector.routes.filter((route) =>
        filteredRouteIds.has(`${route.name.toLowerCase()}-${sector.name.toLowerCase()}`)
      );

      // Drop sectors emptied by the route filter.
      if (sectorRoutes.length === 0 && !hadNoRoutes) return [];

      // Empty sectors: respect text filter by sector name.
      if (hadNoRoutes && !matchesEmptySectorTextFilter(sector)) return [];

      // Hide empty sectors when the grade slider is narrowed or the checkbox is on.
      // "Hide ? grade" does not apply — empty sectors have no grades.
      if (sectorRoutes.length === 0 && (hideSectorsWithoutRoutes || isGradeRangeSet)) return [];

      return [{ ...sector, routes: sectorRoutes }];
    });
  }, [sectors, filteredRoutes, hideSectorsWithoutRoutes, matchesEmptySectorTextFilter, isGradeRangeSet]);

  // Notify parent of filtered routes changes
  React.useEffect(() => {
    onFilteredRoutesChange?.(filteredRoutes);
  }, [filteredRoutes, onFilteredRoutesChange]);

  // Notify parent of filtered sectors changes
  React.useEffect(() => {
    onFilteredSectorsChange?.(filteredSectors);
  }, [filteredSectors, onFilteredSectorsChange]);

  const handleGradeRangeChange = (value: number | number[]) => {
    if (Array.isArray(value)) {
      setGradeRange([value[0], value[1]]);
    }
  };

  const clearTextFilter = () => {
    setTextFilter('');
  };

  // Create marks for the slider
  const marks = React.useMemo(() => {
    const markObj: { [key: number]: string } = {};
    availableGrades.forEach((grade, index) => {
      markObj[index] = grade;
    });
    return markObj;
  }, [availableGrades]);

  const expandableFilterCount =
    Number(hideUnknownGrades) +
    Number(hideSectorsWithoutRoutes) +
    Number(isGradeRangeSet);

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="routes-filter">
      <div className="filter-header">
        <div className="text-filter-container">
          <input
            type="text"
            placeholder="Search routes or sectors..."
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            className="text-filter-input"
            aria-label="Search routes or sectors"
          />
          {textFilter && (
            <Button
              variant="danger"
              size="sm"
              iconOnly
              className="clear-text-btn"
              onClick={clearTextFilter}
              title="Clear search"
              aria-label="Clear search"
            >
              <MdClose aria-hidden="true" />
            </Button>
          )}
        </div>
        <Button
          variant={expandableFilterCount > 0 ? 'danger' : 'primary'}
          size="md"
          className={`expand-control ${isExpanded ? 'expanded' : 'collapsed'}`}
          onClick={handleToggleExpanded}
          aria-expanded={isExpanded}
        >
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
            <MdPlayArrow aria-hidden="true" />
          </span>
          <span className="filter-label">
            Filters{expandableFilterCount > 0 ? ` (${expandableFilterCount})` : ''}
          </span>
        </Button>
      </div>

      <div className={`filter-content ${isExpanded ? 'expanded' : ''}`}>
        {showGradeSlider && (
          <div className="grade-slider-container">
            <div className="slider-wrapper">
              <Slider
                range
                min={0}
                max={availableGrades.length - 1}
                value={gradeRange}
                onChange={handleGradeRangeChange}
                marks={marks}
                step={null}
                allowCross={false}
                className="grade-slider"
                ariaLabelForHandle={['Minimum grade', 'Maximum grade']}
                ariaValueTextFormatterForHandle={[
                  (value) => availableGrades[value] ?? String(value),
                  (value) => availableGrades[value] ?? String(value),
                ]}
              />
            </div>
          </div>
        )}

        <div className="hide-unknown-grades">
          <div className="checkbox-row">
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={hideSectorsWithoutRoutes}
                  onChange={(e) => setHideSectorsWithoutRoutes(e.target.checked)}
                  className="checkbox-input"
                />
                <span className="checkbox-text">Hide sectors without routes</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={hideUnknownGrades}
                  onChange={(e) => setHideUnknownGrades(e.target.checked)}
                  className="checkbox-input"
                />
                <span className="checkbox-text">Hide ? grade</span>
              </label>
            </div>

            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (showGradeSlider) {
                  setGradeRange([0, availableGrades.length - 1]);
                }
                setHideUnknownGrades(false);
                setHideSectorsWithoutRoutes(false);
                clearTextFilter();
              }}
              disabled={expandableFilterCount === 0 && !textFilter.trim()}
              title="Reset filters"
            >
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoutesFilter;
