const SECONDS_TO_MS = 1000

/**
 * A submit-now/validate-later store: submit() stores a
 * { username, txnId, rows } submission and returns a receipt number
 * immediately, then classifies each row against the causes table after a
 * random delay (simulating the real CTS async proving turnaround) so
 * retrieveResults() only returns results once that delay has elapsed. The
 * same class backs both births and movements - just constructed with a
 * different causes table.
 */
export class Store {
  /**
   * @param {{code: string, desc: string, sev: string, field: string, validate: (row: Record<string, string>, rows: Record<string, string>[]) => boolean}[]} causes
   * @param {number} maxDelaySeconds - upper bound (inclusive) of the random
   *   delay, in seconds, before a submission's results become available.
   */
  constructor(causes, maxDelaySeconds) {
    this.causes = causes
    this.maxDelaySeconds = maxDelaySeconds
    this.submissions = new Map()
    this.submittedTxnIds = new Set()
    this.nextReceiptNum = 1
  }

  /**
   * The real TxnId uniqueness rule is "unique per user", not global - see
   * the Full Proving Facility spec's note on Register_* responses
   * ("Request rejected (submitted already)"). Callers should check this
   * before submit() and reject accordingly; Store only tracks the fact,
   * since it has no CTWS-specific error codes to raise itself.
   *
   * @param {string} username
   * @param {string} txnId
   * @returns {boolean}
   */
  hasSubmission(username, txnId) {
    return this.submittedTxnIds.has(`${username}::${txnId}`)
  }

  /**
   * @param {{username: string, txnId: string, rows: {rowNum: number, attributes: Record<string, string>}[]}} submission
   * @returns {number} the receipt number to poll via retrieveResults
   */
  submit(submission) {
    const receiptNum = this.nextReceiptNum
    this.nextReceiptNum += 1

    this.submittedTxnIds.add(`${submission.username}::${submission.txnId}`)
    this.submissions.set(receiptNum, { submission, ready: false })

    // Not a security control - just simulating the real CTS async turnaround.
    // eslint-disable-next-line sonarjs/pseudo-random
    const delayMs = Math.random() * this.maxDelaySeconds * SECONDS_TO_MS

    setTimeout(() => {
      const entry = this.submissions.get(receiptNum)
      const results = this.#classify(entry.submission)

      this.submissions.set(receiptNum, { submission, ready: true, results })
    }, delayMs)

    return receiptNum
  }

  /**
   * @param {number} receiptNum
   * @returns {{ready: false} | {ready: true, results: any} | undefined}
   *   undefined if the receipt number is unknown.
   */
  retrieveResults(receiptNum) {
    const entry = this.submissions.get(receiptNum)

    if (!entry) {
      return undefined
    }

    return entry.ready
      ? { ready: true, results: entry.results }
      : { ready: false }
  }

  #classifyRow(row, allAttributes) {
    return this.causes
      .filter((cause) => cause.validate(row.attributes, allAttributes))
      .map(({ code, desc, sev, field }) => ({ code, desc, sev, field }))
  }

  #classify(submission) {
    const accepted = []
    const rejected = []
    const allAttributes = submission.rows.map((row) => row.attributes)

    for (const row of submission.rows) {
      const rowCauses = this.#classifyRow(row, allAttributes)

      if (rowCauses.length) {
        rejected.push({ attributes: row.attributes, causes: rowCauses })
      } else {
        accepted.push(row.rowNum)
      }
    }

    return { txnId: submission.txnId, accepted, rejected }
  }
}
