import React from 'react';
import { MdClose, MdPlayArrow } from 'react-icons/md';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import './RoutesFilter.scss';
import { Route, Sector } from '../types';
import { useFilter } from '../context/FilterContext';
import { applyRouteFilters } from '../utils/routesFilter';
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

  const {
    availableGrades,
    showGradeSlider,
    isGradeRangeSet,
    filteredRoutes,
    filteredSectors,
  } = React.useMemo(
    () =>
      applyRouteFilters(sectors, {
        gradeRange,
        textFilter,
        hideUnknownGrades,
        hideSectorsWithoutRoutes,
      }),
    [sectors, gradeRange, textFilter, hideUnknownGrades, hideSectorsWithoutRoutes],
  );

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
