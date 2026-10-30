import { describe, expect, it } from 'vitest'

import { placementText } from '../wording'

function flower(perPlacement: number[], ranges: { from: number; to: number; stems: number }[]) {
  return { perPlacement, ranges }
}

describe('placementText', () => {
  it('gives the plain count for a single placement', () => {
    expect(placementText(flower([5], [{ from: 1, to: 1, stems: 5 }]))).toBe('5')
  })

  it('says each when every placement matches', () => {
    expect(placementText(flower([4, 4, 4], [{ from: 1, to: 3, stems: 4 }]))).toBe('4 each')
  })

  it('words the plan’s scabious example', () => {
    expect(
      placementText(
        flower(
          [2, 2, 2, 1, 1, 1, 1],
          [
            { from: 1, to: 3, stems: 2 },
            { from: 4, to: 7, stems: 1 },
          ],
        ),
      ),
    ).toBe('2 each for 1 to 3, 1 each for 4 to 7')
  })

  it('words a wrapped range and single placements', () => {
    expect(
      placementText(
        flower(
          [1, 2, 2, 1],
          [
            { from: 1, to: 1, stems: 1 },
            { from: 2, to: 3, stems: 2 },
            { from: 4, to: 4, stems: 1 },
          ],
        ),
      ),
    ).toBe('1 for 1, 2 each for 2 to 3, 1 for 4')
  })

  it('leaves out placements with no stems', () => {
    expect(
      placementText(
        flower(
          [1, 1, 0, 0, 0],
          [
            { from: 1, to: 2, stems: 1 },
            { from: 3, to: 5, stems: 0 },
          ],
        ),
      ),
    ).toBe('1 each for 1 to 2')
  })

  it('handles one stem in one of several placements', () => {
    expect(
      placementText(
        flower(
          [0, 0, 1],
          [
            { from: 1, to: 2, stems: 0 },
            { from: 3, to: 3, stems: 1 },
          ],
        ),
      ),
    ).toBe('1 for 3')
  })
})
