import { render } from '@testing-library/react-native';
import { expect, test } from '@jest/globals';

import { MemoryLaneShareCard } from '@/shared/components/memory-lane-share-card';
import type { MemoryLaneData } from '@/repositories/memory-lane-composer';

const data: MemoryLaneData = {
  voyageId: 'voyage-1',
  destination: 'Big Sur',
  createdAt: '2026-08-11T10:00:00.000Z',
  endedAt: '2026-08-11T16:42:00.000Z',
  durationMs: (6 * 60 + 42) * 60 * 1000,
  voyagers: [
    { userId: 'user-1', displayName: 'Chintan', playerColor: 'teal', role: 'organizer', joinedAt: '2026-08-11T10:00:00.000Z', spotCount: 1 },
    { userId: 'user-2', displayName: 'Sam', playerColor: 'coral', role: 'voyager', joinedAt: '2026-08-11T10:42:00.000Z', spotCount: 0 },
  ],
  lateJoiner: null,
  lateJoinDelayMs: null,
  totalSpotCount: 1,
  topSpotter: null,
};

test('renders the destination, voyager count, and stats from composer data', async () => {
  const { getByText } = await render(<MemoryLaneShareCard data={data} />);

  expect(getByText('Big Sur')).toBeTruthy();
  expect(getByText('2 voyagers')).toBeTruthy();
  expect(getByText('6h 42m')).toBeTruthy();
  expect(getByText('1')).toBeTruthy();
  expect(getByText('Voylo')).toBeTruthy();
});

test('caps rendered avatars for a large crew and shows a +N overflow chip', async () => {
  const bigCrew: MemoryLaneData = {
    ...data,
    voyagers: Array.from({ length: 8 }, (_, i) => ({
      userId: `user-${i + 1}`,
      displayName: `Voyager ${i + 1}`,
      playerColor: 'teal',
      role: i === 0 ? 'organizer' : 'voyager',
      joinedAt: '2026-08-11T10:00:00.000Z',
      spotCount: 0,
    })),
  };

  const { getByText, queryByText, getAllByText } = await render(<MemoryLaneShareCard data={bigCrew} />);

  expect(getByText('8 voyagers')).toBeTruthy();
  expect(getByText('+2')).toBeTruthy();
  // 6 visible avatars (all share the same initial "V") + the overflow chip.
  expect(getAllByText('V')).toHaveLength(6);
  expect(queryByText('+3')).toBeNull();
});
