import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { getCurrentUserNotifications } from '@/lib/notifications'
import { redirect } from 'next/navigation'
import TopBar from '@/components/top-bar'

type ExpenseSplit = {
  id: string
  expense_id: string
  member_id: string
  amount: number
}

type Expense = {
  id: string
  title: string
  amount: number
  paid_by: string
  category: string
  split_type: string
  date: string
  notes: string | null
  created_by: string
  created_at: string
  expense_splits: ExpenseSplit[]
}

type Settlement = {
  id: string
  from_member_id: string
  to_member_id: string
  amount: number
  date: string
}

type FamilyMember = {
  id: string
  full_name: string
  household_id: string | null
}

type Household = {
  id: string
  name: string
}

type DebtTransaction = {
  from: string
  to: string
  amount: number
}

function getCategoryLabel(cat: string) {
  switch (cat) {
    case 'food': return 'אוכל'
    case 'utilities': return 'חשבונות'
    case 'maintenance': return 'תחזוקה'
    case 'cleaning': return 'ניקיון'
    case 'pool': return 'בריכה'
    case 'garden': return 'גינה'
    default: return 'אחר'
  }
}

function getCategoryStyle(cat: string) {
  switch (cat) {
    case 'food':        return 'bg-[#f5f0de] text-[#7a6b3a]'
    case 'utilities':   return 'bg-[#e8eef5] text-[#3a5a7a]'
    case 'maintenance': return 'bg-[#f5eede] text-[#8b6b3a]'
    case 'cleaning':    return 'bg-[#e8f0f5] text-[#3a657a]'
    case 'pool':        return 'bg-[#e4f0f5] text-[#2e6b80]'
    case 'garden':      return 'bg-[#eef2e8] text-[#4a6b3a]'
    default:            return 'bg-[#ede7d8] text-[#6c7664]'
  }
}

function getSplitTypeLabel(splitType: string) {
  switch (splitType) {
    case 'equal': return 'חלוקה שווה'
    case 'custom': return 'חלוקה מותאמת'
    case 'per_family': return 'לפי בית אב'
    default: return splitType
  }
}

function getErrorMessage(errorCode?: string) {
  switch (errorCode) {
    case 'not-authenticated': return 'יש להתחבר מחדש.'
    case 'missing-fields': return 'יש למלא כותרת וסכום תקין.'
    case 'no-participants': return 'יש לבחור לפחות משתתף אחד.'
    case 'insert-failed': return 'אירעה שגיאה בשמירת ההוצאה. נסו שוב.'
    case 'missing-expense': return 'לא נמצאה הוצאה למחיקה.'
    default: return null
  }
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatAmount(amount: number) {
  return `₪${amount.toFixed(2).replace(/\.00$/, '')}`
}

type GroupedDebt = {
  fromLabel: string
  toLabel: string
  amount: number
  /** Individual transactions within this group — used to build settle form inputs */
  transactions: DebtTransaction[]
}

type GroupedSettlement = {
  fromLabel: string
  toLabel: string
  amount: number
  date: string
}

/**
 * Return a display label for a household.
 * - Unique household name  → use the name (e.g. "אנקרי")
 * - Duplicate name across households → join member first names with ו (e.g. "שושן וללי")
 * - No household → member's full name
 */
function householdLabel(
  memberId: string,
  members: FamilyMember[],
  households: Household[]
): string {
  const member = members.find((m) => m.id === memberId)
  if (!member) return 'לא ידוע'

  if (!member.household_id) return member.full_name

  const hh = households.find((h) => h.id === member.household_id)
  if (!hh) return member.full_name

  // Check if any other household shares the same name
  const sameName = households.filter((h) => h.name === hh.name)
  if (sameName.length === 1) {
    // Unique name — use it
    return hh.name
  }

  // Duplicate name — list first names of members in this specific household
  const hhMembers = members.filter((m) => m.household_id === member.household_id)
  const firstNames = hhMembers.map((m) => m.full_name.split(' ')[0])
  if (firstNames.length === 0) return hh.name
  if (firstNames.length === 1) return firstNames[0]
  if (firstNames.length === 2) return `${firstNames[0]} ו${firstNames[1]}`
  return firstNames.slice(0, -1).join(', ') + ' ו' + firstNames[firstNames.length - 1]
}

/**
 * Collapse individual debt transactions into household-pair groups.
 * Labels use the household name (e.g. "אנקרי") rather than member names.
 */
function groupDebtsByHousehold(
  transactions: DebtTransaction[],
  members: FamilyMember[],
  households: Household[]
): GroupedDebt[] {
  const memberHousehold: Record<string, string | null> = {}
  for (const m of members) memberHousehold[m.id] = m.household_id ?? null

  const groups: Record<string, {
    amount: number
    transactions: DebtTransaction[]
    fromMemberId: string
    toMemberId: string
  }> = {}

  for (const t of transactions) {
    const fromKey = memberHousehold[t.from] ?? t.from
    const toKey = memberHousehold[t.to] ?? t.to
    const key = `${fromKey}|${toKey}`

    if (!groups[key]) {
      groups[key] = { amount: 0, transactions: [], fromMemberId: t.from, toMemberId: t.to }
    }
    groups[key].amount = Math.round((groups[key].amount + t.amount) * 100) / 100
    groups[key].transactions.push(t)
  }

  return Object.values(groups).map((g) => ({
    fromLabel: householdLabel(g.fromMemberId, members, households),
    toLabel: householdLabel(g.toMemberId, members, households),
    amount: g.amount,
    transactions: g.transactions,
  }))
}

function computeSimplifiedDebts(
  expenses: Expense[],
  settlements: Settlement[],
  members: FamilyMember[]
): DebtTransaction[] {
  const balances: Record<string, number> = {}
  for (const m of members) balances[m.id] = 0

  // Add expense splits
  for (const expense of expenses) {
    for (const split of expense.expense_splits ?? []) {
      if (split.member_id === expense.paid_by) continue
      balances[split.member_id] = (balances[split.member_id] ?? 0) - split.amount
      balances[expense.paid_by] = (balances[expense.paid_by] ?? 0) + split.amount
    }
  }

  // Subtract settlements (payments already made)
  for (const s of settlements) {
    balances[s.from_member_id] = (balances[s.from_member_id] ?? 0) + s.amount
    balances[s.to_member_id] = (balances[s.to_member_id] ?? 0) - s.amount
  }

  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0.01)
    .map(([id, amount]) => ({ id, amount }))
    .sort((a, b) => b.amount - a.amount)

  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -0.01)
    .map(([id, amount]) => ({ id, amount: Math.abs(amount) }))
    .sort((a, b) => b.amount - a.amount)

  const transactions: DebtTransaction[] = []
  const cred = creditors.map((c) => ({ ...c }))
  const debt = debtors.map((d) => ({ ...d }))
  let ci = 0
  let di = 0

  while (ci < cred.length && di < debt.length) {
    const c = cred[ci]
    const d = debt[di]
    const amount = Math.min(c.amount, d.amount)
    transactions.push({ from: d.id, to: c.id, amount })
    c.amount = Math.round((c.amount - amount) * 100) / 100
    d.amount = Math.round((d.amount - amount) * 100) / 100
    if (c.amount < 0.01) ci++
    if (d.amount < 0.01) di++
  }

  return transactions
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const errorMessage = getErrorMessage(resolvedSearchParams.error)

  const currentUser = await getAuthenticatedFamilyMember()
  if (!currentUser) redirect('/login')

  const { unreadCount } = await getCurrentUserNotifications()
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: expensesData, error: expensesError },
    { data: settlementsData },
    { data: membersData },
    { data: householdsData },
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('*, expense_splits(*)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('settlements')
      .select('id, from_member_id, to_member_id, amount, date')
      .order('date', { ascending: false }),
    supabase
      .from('family_members')
      .select('id, full_name, household_id')
      .order('full_name', { ascending: true }),
    supabase
      .from('households')
      .select('id, name')
      .order('created_at', { ascending: true }),
  ])

  const expenses = (expensesData ?? []) as Expense[]
  const settlements = (settlementsData ?? []) as Settlement[]
  const members = (membersData ?? []) as FamilyMember[]
  const households = (householdsData ?? []) as Household[]

  // Group members by household for the form
  const membersByHousehold: Record<string, FamilyMember[]> = {}
  for (const m of members) {
    if (!m.household_id) continue
    if (!membersByHousehold[m.household_id]) membersByHousehold[m.household_id] = []
    membersByHousehold[m.household_id].push(m)
  }

  const householdsWithMembers = households.filter(
    (h) => (membersByHousehold[h.id] ?? []).length > 0
  )

  const getMemberName = (id: string | null) => {
    if (!id) return 'לא ידוע'
    return members.find((m) => m.id === id)?.full_name ?? 'לא ידוע'
  }

  const simplifiedDebts = computeSimplifiedDebts(expenses, settlements, members)
  const groupedDebts = groupDebtsByHousehold(simplifiedDebts, members, households)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Group settlement history by (date, from-household, to-household) — one line per family pair
  const groupedSettlements: GroupedSettlement[] = (() => {
    const map: Record<string, GroupedSettlement> = {}
    for (const s of settlements) {
      const fromLabel = householdLabel(s.from_member_id, members, households)
      const toLabel = householdLabel(s.to_member_id, members, households)
      const key = `${s.date}|${fromLabel}|${toLabel}`
      if (!map[key]) {
        map[key] = { fromLabel, toLabel, amount: 0, date: s.date }
      }
      map[key].amount = Math.round((map[key].amount + s.amount) * 100) / 100
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
  })()

  return (
    <main dir="rtl" className="min-h-screen bg-[#f6f3ea] p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <TopBar
          title="הוצאות משותפות"
          subtitle="ניהול הוצאות, חלוקת עלויות וחישוב מי חייב למי"
          currentUserName={currentUser.full_name}
          unreadCount={unreadCount}
        />

        {errorMessage && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        {/* Balance summary */}
        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2f3a2c]">מי חייב למי</h2>
              <p className="mt-1 text-sm text-[#6c7664]">
                סיכום מאוחד — לחצו על &quot;שולם&quot; כשהכסף עבר
              </p>
            </div>
            <div className="rounded-full bg-[#eef2e8] px-4 py-2 text-sm text-[#5c694f]">
              סה&quot;כ: {formatAmount(totalExpenses)}
            </div>
          </div>

          {groupedDebts.length === 0 ? (
            <div className="rounded-2xl border border-[#c8d8a8] bg-[#f4f8ee] p-4 text-sm font-medium text-[#4a6b3a]">
              הכול מאוזן! אין חובות פתוחים כרגע. 🎉
            </div>
          ) : (
            <ul className="space-y-3">
              {groupedDebts.map((g, i) => (
                <li
                  key={i}
                  className="flex flex-col gap-3 rounded-2xl border border-[#e4dece] bg-[#fcfaf4] px-5 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-[#384332]">{g.fromLabel}</span>
                    <span className="text-[#6c7664]">חייבים ל</span>
                    <span className="font-semibold text-[#384332]">{g.toLabel}</span>
                    <span className="rounded-full bg-[#a67c52]/10 px-4 py-1 text-sm font-bold text-[#a67c52]">
                      {formatAmount(g.amount)}
                    </span>
                  </div>

                  {/* One form per group — submits all individual pair settlements at once */}
                  <form action="/api/expenses/settle" method="POST" className="shrink-0">
                    {g.transactions.map((t, ti) => (
                      <span key={ti}>
                        <input type="hidden" name="from[]" value={t.from} />
                        <input type="hidden" name="to[]" value={t.to} />
                        <input type="hidden" name="amount[]" value={t.amount} />
                      </span>
                    ))}
                    <button
                      type="submit"
                      className="rounded-xl border border-[#c8d8a8] bg-[#f4f8ee] px-4 py-2 text-xs font-semibold text-[#4a6b3a] transition hover:bg-[#e2ecd4]"
                    >
                      ✓ שולם
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {/* Settlement history — one line per family pair per date */}
          {groupedSettlements.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-[#7a8471] hover:text-[#5f6b58]">
                היסטוריית תשלומים ({groupedSettlements.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {groupedSettlements.map((s, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl border border-[#e4dece] bg-[#f8fdf4] px-4 py-2 text-xs text-[#5f6b58]">
                    <span>
                      <span className="font-medium">{s.fromLabel}</span>
                      {' שילמו ל'}
                      <span className="font-medium">{s.toLabel}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold text-[#4a6b3a]">{formatAmount(s.amount)}</span>
                      <span className="text-[#a0a89a]">{formatDate(s.date)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* Add expense form */}
        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2f3a2c]">הוצאה חדשה</h2>
              <p className="mt-1 text-sm text-[#6c7664]">
                תעדו מי שילם, כמה, ואיך לחלק
              </p>
            </div>
            <a
              href="/"
              className="rounded-xl border border-[#d8d1c2] px-4 py-2 text-sm text-[#5f6b58] hover:bg-[#f6f3ea]"
            >
              חזרה לדף הבית
            </a>
          </div>

          <form action="/api/expenses" method="POST" className="space-y-5" id="expense-form">
            {/* Title + Amount */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  תיאור ההוצאה
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="לדוגמה: כלים לבריכה"
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  סכום (₪)
                </label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                />
              </div>
            </div>

            {/* Paid by + Category + Date */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  מי שילם
                </label>
                <select
                  name="paid_by"
                  defaultValue={currentUser.id}
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  קטגוריה
                </label>
                <select
                  name="category"
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                >
                  <option value="food">אוכל</option>
                  <option value="utilities">חשבונות</option>
                  <option value="maintenance">תחזוקה</option>
                  <option value="cleaning">ניקיון</option>
                  <option value="pool">בריכה</option>
                  <option value="garden">גינה</option>
                  <option value="other">אחר</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  תאריך
                </label>
                <input
                  name="date"
                  type="date"
                  defaultValue={today}
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                />
              </div>
            </div>

            {/* Split type */}
            <div>
              <label className="mb-3 block text-sm font-medium text-[#384332]">
                סוג חלוקה
              </label>
              <div className="flex flex-wrap gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm">
                  <input
                    type="radio"
                    name="split_type"
                    value="equal"
                    defaultChecked
                    className="accent-[#6f7f57]"
                  />
                  חלוקה שווה בין אנשים
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm">
                  <input
                    type="radio"
                    name="split_type"
                    value="per_family"
                    className="accent-[#6f7f57]"
                  />
                  חלוקה שווה לפי בית אב
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm">
                  <input
                    type="radio"
                    name="split_type"
                    value="custom"
                    className="accent-[#6f7f57]"
                  />
                  חלוקה מותאמת
                </label>
              </div>
            </div>

            {/* Section: by person (equal / custom) */}
            <div id="section-by-person">
              <label className="mb-3 block text-sm font-medium text-[#384332]">
                משתתפים
                <span className="mr-2 text-xs font-normal text-[#6c7664]">
                  (בחלוקה מותאמת — הזינו סכום לכל משתתף)
                </span>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                {members.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 rounded-2xl border border-[#e4dece] bg-[#fcfaf4] px-4 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="participants"
                      value={m.id}
                      defaultChecked
                      className="h-4 w-4 accent-[#6f7f57]"
                    />
                    <span className="flex-1 font-medium text-[#384332]">
                      {m.full_name}
                    </span>
                    <input
                      type="number"
                      name={`custom_amount_${m.id}`}
                      step="0.01"
                      min="0"
                      placeholder="₪0"
                      className="w-20 rounded-xl border border-[#d8d1c2] bg-white px-3 py-1 text-xs outline-none focus:border-[#6f7f57]"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Section: by family */}
            <div id="section-by-family">
              <label className="mb-3 block text-sm font-medium text-[#384332]">
                בתי אב משתתפים
                <span className="mr-2 text-xs font-normal text-[#6c7664]">
                  כל בית משלם חלק שווה; בתוך הבית — חלוקה שווה בין חבריו
                </span>
              </label>

              {householdsWithMembers.length === 0 ? (
                <div className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] p-4 text-sm text-[#7a8471]">
                  לא נמצאו בתי אב עם חברים מקושרים.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {householdsWithMembers.map((h) => {
                    const hMembers = membersByHousehold[h.id] ?? []
                    return (
                      <label
                        key={h.id}
                        className="flex items-start gap-3 rounded-2xl border border-[#e4dece] bg-[#fcfaf4] px-4 py-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="family_participants"
                          value={h.id}
                          defaultChecked
                          className="mt-0.5 h-4 w-4 accent-[#6f7f57]"
                        />
                        <div>
                          <div className="font-medium text-[#384332]">
                            {h.name}
                          </div>
                          <div className="mt-0.5 text-xs text-[#7a8471]">
                            {hMembers.map((m) => m.full_name).join(', ')}
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="mb-2 block text-sm font-medium text-[#384332]">
                הערות (אופציונלי)
              </label>
              <textarea
                name="notes"
                rows={2}
                placeholder="פרטים נוספים..."
                className="w-full resize-none rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-[#2f3a2c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#232b20]"
            >
              שמירת הוצאה
            </button>

            {/* CSS-only toggle — no JS, no hydration mismatch */}
            <style dangerouslySetInnerHTML={{ __html: `
              #expense-form:has(input[name="split_type"][value="per_family"]:checked) #section-by-person { display: none; }
              #expense-form:not(:has(input[name="split_type"][value="per_family"]:checked)) #section-by-family { display: none; }
            `}} />
          </form>
        </section>

        {/* Expense list */}
        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2f3a2c]">
                הוצאות אחרונות
              </h2>
              <p className="mt-1 text-sm text-[#6c7664]">50 ההוצאות האחרונות</p>
            </div>
            <div className="rounded-full bg-[#eef2e8] px-4 py-2 text-sm text-[#5c694f]">
              {expenses.length} הוצאות
            </div>
          </div>

          {expensesError && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
              שגיאה בטעינת הנתונים: {expensesError.message}
            </p>
          )}

          {!expensesError && expenses.length === 0 && (
            <div className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] p-4 text-sm text-[#6c7664]">
              אין הוצאות עדיין. הוסיפו את ההוצאה הראשונה בטופס למעלה.
            </div>
          )}

          {!expensesError && expenses.length > 0 && (
            <ul className="space-y-3">
              {expenses.map((expense) => {
                const splits = expense.expense_splits ?? []
                const participantNames = splits
                  .map((s) => getMemberName(s.member_id))
                  .join(', ')
                const isCreator = expense.created_by === currentUser.id

                return (
                  <li
                    key={expense.id}
                    className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-[#384332]">
                            {expense.title}
                          </span>
                          <span className="text-sm font-bold text-[#a67c52]">
                            {formatAmount(expense.amount)}
                          </span>
                        </div>

                        <p className="text-sm text-[#5f6b58]">
                          שילם/ה:{' '}
                          <span className="font-medium">
                            {getMemberName(expense.paid_by)}
                          </span>
                          {' · '}
                          {formatDate(expense.date)}
                        </p>

                        {splits.length > 0 && (
                          <p className="text-xs text-[#7a8471]">
                            משתתפים: {participantNames}
                          </p>
                        )}

                        {expense.notes && (
                          <p className="text-xs text-[#7a8471]">{expense.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getCategoryStyle(expense.category)}`}
                        >
                          {getCategoryLabel(expense.category)}
                        </span>

                        {expense.split_type && (
                          <span className="rounded-full bg-[#eef2e8] px-3 py-1 text-xs font-medium text-[#5c694f]">
                            {getSplitTypeLabel(expense.split_type)}
                          </span>
                        )}

                        {isCreator && (
                          <form action="/api/expenses" method="POST">
                            <input type="hidden" name="action" value="delete" />
                            <input
                              type="hidden"
                              name="expenseId"
                              value={expense.id}
                            />
                            <button
                              type="submit"
                              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100"
                            >
                              מחיקה
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
