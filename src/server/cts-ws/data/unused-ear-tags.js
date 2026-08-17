import unusedEarTagsByCph from '../../../../data/fixtures/cts-unused-ear-tags.json' with { type: 'json' }

/**
 * @param {string} cph
 * @param {string} earTag
 * @returns {boolean}
 */
export function isIssuedAndUnused(cph, earTag) {
  return (unusedEarTagsByCph[cph] ?? []).includes(earTag)
}
