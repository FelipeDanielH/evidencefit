import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders the EvidenceFit heading', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { name: 'Matching explicable, desde la evidencia.' }),
    ).toBeInTheDocument();
  });
});
