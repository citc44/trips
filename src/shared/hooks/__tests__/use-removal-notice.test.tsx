import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { RemovalNoticeProvider, useRemovalNotice } from '@/shared/hooks/use-removal-notice';

const mockUseAuth = jest.fn<(...args: any[]) => any>();
jest.mock('@/shared/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockGetRemovalNotice = jest.fn<(...args: any[]) => Promise<any>>();
const mockAcknowledgeRemoval = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('@/repositories/voyage-repository', () => ({
  voyageRepository: {
    getRemovalNotice: (...args: unknown[]) => mockGetRemovalNotice(...args),
    acknowledgeRemoval: (...args: unknown[]) => mockAcknowledgeRemoval(...args),
  },
}));

const noticeFixture = { voyageId: 'voyage-1', destination: 'Lake Tahoe' };

function Probe() {
  const { removalNotice, isLoading, hasError } = useRemovalNotice();
  return <Text testID="probe">{isLoading ? 'loading' : removalNotice ? removalNotice.destination : hasError ? 'error' : 'none'}</Text>;
}

function AcknowledgeProbe() {
  const { acknowledge } = useRemovalNotice();
  return <Text testID="acknowledge" onPress={() => acknowledge()} />;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('resolves to none (not loading) when there is no session', async () => {
  mockUseAuth.mockReturnValue({ session: null });

  const { getByTestId } = await render(
    <RemovalNoticeProvider>
      <Probe />
    </RemovalNoticeProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));
  expect(mockGetRemovalNotice).not.toHaveBeenCalled();
});

test('fetches and exposes the removal notice when a session exists', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetRemovalNotice.mockResolvedValue({ data: noticeFixture, error: null });

  const { getByTestId } = await render(
    <RemovalNoticeProvider>
      <Probe />
    </RemovalNoticeProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('Lake Tahoe'));
});

test('resolves to none when there is nothing to acknowledge', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetRemovalNotice.mockResolvedValue({ data: null, error: null });

  const { getByTestId } = await render(
    <RemovalNoticeProvider>
      <Probe />
    </RemovalNoticeProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));
});

test('exposes hasError (not stuck loading) when the fetch rejects', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetRemovalNotice.mockRejectedValue(new Error('network error'));

  const { getByTestId } = await render(
    <RemovalNoticeProvider>
      <Probe />
    </RemovalNoticeProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('error'));
});

test('acknowledge calls the repository with the Voyage id and clears the local notice', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetRemovalNotice.mockResolvedValue({ data: noticeFixture, error: null });
  mockAcknowledgeRemoval.mockResolvedValue({ error: null });

  const { getByTestId } = await render(
    <RemovalNoticeProvider>
      <AcknowledgeProbe />
      <Probe />
    </RemovalNoticeProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('Lake Tahoe'));

  await act(async () => {
    await getByTestId('acknowledge').props.onPress();
  });

  expect(mockAcknowledgeRemoval).toHaveBeenCalledWith('voyage-1');
  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));
});

test('acknowledge clears the local notice even if the repository call fails (fails open)', async () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: 'user-1' } } });
  mockGetRemovalNotice.mockResolvedValue({ data: noticeFixture, error: null });
  mockAcknowledgeRemoval.mockRejectedValue(new Error('network error'));

  const { getByTestId } = await render(
    <RemovalNoticeProvider>
      <AcknowledgeProbe />
      <Probe />
    </RemovalNoticeProvider>,
  );

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('Lake Tahoe'));

  await act(async () => {
    await getByTestId('acknowledge').props.onPress();
  });

  await waitFor(() => expect(getByTestId('probe').props.children).toBe('none'));
});
