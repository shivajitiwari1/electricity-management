/** An unpaid bill considered for carry-forward, oldest first. */
export interface OpenBill {
  id: string;
  balance: number; // totalAmount - paidAmount
}

/**
 * Given the previousDues amount rolled into a new bill, decide which of the
 * connection's still-open older bills that amount fully covers.
 *
 * Oldest first, and only bills whose whole balance fits inside the remaining
 * carried amount — a partially covered bill stays open so the resident is never
 * shown as owing less than they do.
 */
export function selectCarriedForwardBills(previousDues: number, openBills: OpenBill[]): string[] {
  let remaining = previousDues;
  const covered: string[] = [];
  for (const bill of openBills) {
    if (bill.balance <= 0) continue;
    // 1 paisa tolerance for Decimal -> number rounding
    if (bill.balance - remaining > 0.01) break;
    remaining -= bill.balance;
    covered.push(bill.id);
  }
  return covered;
}
