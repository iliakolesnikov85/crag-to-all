import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DescriptionSection } from '../types';
import DescriptionPage from './DescriptionPage';

const sections: DescriptionSection[] = [
  {
    subheader: 'Access',
    paragraphs: ['<strong>Park</strong> at the lot.', 'Walk ten minutes.'],
  },
  {
    subheader: 'Season',
    paragraphs: ['Best in autumn.'],
  },
];

describe('DescriptionPage', () => {
  it('renders every section and HTML paragraph', () => {
    render(<DescriptionPage description={sections} />);

    expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument();
    expect(screen.getByText('Park')).toBeInTheDocument();
    expect(screen.getByText('Walk ten minutes.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Season' })).toBeInTheDocument();
    expect(screen.getByText('Best in autumn.')).toBeInTheDocument();
  });

  it('shows a loading message when description is empty', () => {
    render(<DescriptionPage description={[]} />);
    expect(screen.getByText('Loading description...')).toBeInTheDocument();
  });
});
