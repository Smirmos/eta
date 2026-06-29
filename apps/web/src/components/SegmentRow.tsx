import type { WorkoutSegment } from '@eta/shared-types';
import { formatDuration } from '../lib/format.js';

export function SegmentRow({ segment }: { segment: WorkoutSegment }): JSX.Element {
  return (
    <li className="segment">
      <span className="seg-label">{segment.label}</span>
      <span className="seg-dur">{formatDuration(segment.durationSeconds)}</span>
      <span className="seg-zone">{segment.zone}</span>
    </li>
  );
}
