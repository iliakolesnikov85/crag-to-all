import { createContext, useContext, useState } from 'react';

export interface FilterContextType {
  gradeRange: [number, number];
  setGradeRange: (range: [number, number]) => void;
  textFilter: string;
  setTextFilter: (text: string) => void;
  hideUnknownGrades: boolean;
  setHideUnknownGrades: (hide: boolean) => void;
  hideSectorsWithoutRoutes: boolean;
  setHideSectorsWithoutRoutes: (hide: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  sortField: 'name' | 'grade' | 'rating' | 'sectorName';
  setSortField: (field: 'name' | 'grade' | 'rating' | 'sectorName') => void;
  sortDirection: 'asc' | 'desc';
  setSortDirection: (direction: 'asc' | 'desc') => void;
}

export const FilterContext = createContext<FilterContextType>({
  gradeRange: [0, 0],
  setGradeRange: () => { },
  textFilter: '',
  setTextFilter: () => { },
  hideUnknownGrades: false,
  setHideUnknownGrades: () => { },
  hideSectorsWithoutRoutes: false,
  setHideSectorsWithoutRoutes: () => { },
  isExpanded: false,
  setIsExpanded: () => { },
  sortField: 'grade',
  setSortField: () => { },
  sortDirection: 'desc',
  setSortDirection: () => { },
});

export const useFilter = () => useContext(FilterContext);

export const useFilterState = (): FilterContextType => {
  const [gradeRange, setGradeRange] = useState<[number, number]>([0, 0]);
  const [textFilter, setTextFilter] = useState('');
  const [hideUnknownGrades, setHideUnknownGrades] = useState(false);
  const [hideSectorsWithoutRoutes, setHideSectorsWithoutRoutes] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'grade' | 'rating' | 'sectorName'>('grade');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  return {
    gradeRange,
    setGradeRange,
    textFilter,
    setTextFilter,
    hideUnknownGrades,
    setHideUnknownGrades,
    hideSectorsWithoutRoutes,
    setHideSectorsWithoutRoutes,
    isExpanded,
    setIsExpanded,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
  };
};
