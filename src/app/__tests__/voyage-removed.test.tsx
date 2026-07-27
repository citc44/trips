import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';

import { useRemovalNotice } from '@/shared/hooks/use-removal-notice';

import VoyageRemovedScreen from '../voyage-removed';

jest.mock('@/shared/hooks/use-removal-notice', () => ({
  useRemovalNotice: jest.fn(),
}));

const mockUseRemovalNotice = useRemovalNotice as jest.MockedFunction<typeof useRemovalNotice>;
const mockAcknowledge = jest.fn<() => Promise<void>>();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRemovalNotice.mockReturnValue({
    removalNotice: { voyageId: 'voyage-1', destination: 'Lake Tahoe' },
    isLoading: false,
    hasError: false,
    acknowledge: mockAcknowledge,
  });
});

test('shows the calm, no-justification copy', async () => {
  const { getByText, queryByText } = await render(<VoyageRemovedScreen />);

  expect(getByText("You've left this Voyage.")).toBeTruthy();
  // No blame, no explanation, no destination-specific drama -- EXPERIENCE.md:
  // "Calm, no red, no justification text."
  expect(queryByText(/Lake Tahoe/)).toBeNull();
});

test('tapping Continue calls acknowledge', async () => {
  const { getByTestId } = await render(<VoyageRemovedScreen />);

  await act(async () => {
    fireEvent.press(getByTestId('voyage-removed-continue-button'));
  });

  expect(mockAcknowledge).toHaveBeenCalledTimes(1);
});
