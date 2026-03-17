import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListingFilters } from '../listing-filters';

const mockPush = vi.fn();
let currentParams: string = '';

const mockRouter = { push: mockPush, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(currentParams),
}));

beforeEach(() => {
  mockPush.mockClear();
  currentParams = '';
});

describe('ListingFilters', () => {
  it('renders search input and submit button', () => {
    render(<ListingFilters />);
    expect(screen.getByPlaceholderText('Search listings...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('pressing Enter in search input triggers search', async () => {
    const user = userEvent.setup();
    render(<ListingFilters />);
    const input = screen.getByPlaceholderText('Search listings...');
    await user.type(input, 'beach apartment{Enter}');
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('q=beach+apartment'));
  });

  it('clicking Search button triggers search', async () => {
    const user = userEvent.setup();
    render(<ListingFilters />);
    const input = screen.getByPlaceholderText('Search listings...');
    await user.type(input, 'villa');
    await user.click(screen.getByRole('button', { name: /search/i }));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('q=villa'));
  });

  it('price validation: shows error when min > max', async () => {
    render(<ListingFilters />);
    const minInput = screen.getByPlaceholderText('Min');
    const maxInput = screen.getByPlaceholderText('Max');

    // Set max first, then set a higher min
    await act(async () => {
      fireEvent.change(maxInput, { target: { value: '500' } });
    });
    await act(async () => {
      fireEvent.change(minInput, { target: { value: '1000' } });
    });

    // Error should appear immediately (synchronous validation)
    expect(screen.getByText(/min must be less than max/i)).toBeInTheDocument();
  });

  it('price validation: no error when min < max', () => {
    render(<ListingFilters />);
    const minInput = screen.getByPlaceholderText('Min');
    const maxInput = screen.getByPlaceholderText('Max');

    fireEvent.change(minInput, { target: { value: '500' } });
    fireEvent.change(maxInput, { target: { value: '1000' } });

    expect(screen.queryByText(/min must be less than max/i)).not.toBeInTheDocument();
  });

  it('price validation: no error when only min is set', () => {
    render(<ListingFilters />);
    const minInput = screen.getByPlaceholderText('Min');

    fireEvent.change(minInput, { target: { value: '500' } });

    expect(screen.queryByText(/min must be less than max/i)).not.toBeInTheDocument();
  });

  it('clear all filters button resets URL params', async () => {
    currentParams = 'type=rent&district=limassol';
    render(<ListingFilters />);
    const clearBtn = screen.getByText('Clear all');
    fireEvent.click(clearBtn);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('active filter chip appears for type filter', () => {
    currentParams = 'type=rent';
    render(<ListingFilters />);
    expect(screen.getByLabelText('Remove Rent filter')).toBeInTheDocument();
  });

  it('removing a chip calls router with param deleted', () => {
    currentParams = 'type=rent&district=limassol';
    render(<ListingFilters />);
    const removeBtn = screen.getByLabelText('Remove Rent filter');
    fireEvent.click(removeBtn);
    expect(mockPush).toHaveBeenCalled();
    const calledWith = mockPush.mock.calls[0][0];
    expect(calledWith).not.toContain('type=rent');
    expect(calledWith).toContain('district=limassol');
  });

  it('price preset applies correct min/max values', () => {
    render(<ListingFilters />);
    // Price presets are in the filter panel - need to make them visible on desktop
    const presetBtn = screen.getByText('Under \u20AC500');
    fireEvent.click(presetBtn);
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('max_price=500'));
  });
});
