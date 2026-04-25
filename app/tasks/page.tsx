import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedFamilyMember } from '@/lib/auth'
import { getCurrentUserNotifications } from '@/lib/notifications'
import { redirect } from 'next/navigation'
import TopBar from '@/components/top-bar'

type Task = {
  id: string
  title: string
  description: string | null
  assigned_to: string | null
  created_by: string
  status: 'open' | 'done'
  category: string
  due_date: string | null
  created_at: string
}

type FamilyMember = {
  id: string
  full_name: string
}

function getCategoryLabel(category: string) {
  switch (category) {
    case 'general':
      return 'כללי'
    case 'cleaning':
      return 'ניקיון'
    case 'garden':
      return 'גינה'
    case 'weekend':
      return 'סוף שבוע'
    case 'maintenance':
      return 'תחזוקה'
    case 'shopping':
      return 'קניות'
    default:
      return category
  }
}

function getCategoryStyle(category: string) {
  switch (category) {
    case 'general':
      return 'bg-[#ede7d8] text-[#6c7664]'
    case 'cleaning':
      return 'bg-[#e8eef5] text-[#3a5a7a]'
    case 'garden':
      return 'bg-[#eef2e8] text-[#4a6b3a]'
    case 'weekend':
      return 'bg-[#ede8f5] text-[#6b5a80]'
    case 'maintenance':
      return 'bg-[#f5eede] text-[#8b6b3a]'
    case 'shopping':
      return 'bg-[#f5f0de] text-[#7a6b3a]'
    default:
      return 'bg-[#ede7d8] text-[#6c7664]'
  }
}

function getErrorMessage(errorCode?: string) {
  switch (errorCode) {
    case 'not-authenticated':
      return 'יש להתחבר מחדש.'
    case 'missing-title':
      return 'יש להזין כותרת למשימה.'
    case 'insert-failed':
      return 'אירעה שגיאה בשמירת המשימה. נסו שוב.'
    case 'missing-task':
      return 'לא נמצאה משימה לעדכון.'
    default:
      return null
  }
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export default async function TasksPage({
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

  const { data: openTasksData, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  const { data: doneTasksData } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: membersData } = await supabase
    .from('family_members')
    .select('id, full_name')
    .order('full_name', { ascending: true })

  const openTasks = (openTasksData ?? []) as Task[]
  const doneTasks = (doneTasksData ?? []) as Task[]
  const members = (membersData ?? []) as FamilyMember[]

  const getMemberName = (id: string | null) => {
    if (!id) return null
    return members.find((m) => m.id === id)?.full_name ?? 'לא ידוע'
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f6f3ea] p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <TopBar
          title="משימות"
          subtitle="תורנויות, ניקיון, גינה וסידורים שוטפים"
          currentUserName={currentUser.full_name}
          unreadCount={unreadCount}
        />

        {errorMessage && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        {/* Add task form */}
        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2f3a2c]">משימה חדשה</h2>
              <p className="mt-1 text-sm text-[#6c7664]">
                הוסיפו משימה והקצו אותה לאחד מבני המשפחה
              </p>
            </div>
            <a
              href="/"
              className="rounded-xl border border-[#d8d1c2] px-4 py-2 text-sm text-[#5f6b58] hover:bg-[#f6f3ea]"
            >
              חזרה לדף הבית
            </a>
          </div>

          <form action="/api/tasks" method="POST" className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#384332]">
                כותרת המשימה
              </label>
              <input
                name="title"
                type="text"
                required
                placeholder="לדוגמה: לנקות את בריכת השחייה"
                className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  קטגוריה
                </label>
                <select
                  name="category"
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                >
                  <option value="general">כללי</option>
                  <option value="cleaning">ניקיון</option>
                  <option value="garden">גינה</option>
                  <option value="weekend">סוף שבוע</option>
                  <option value="maintenance">תחזוקה</option>
                  <option value="shopping">קניות</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  הקצאה לאדם
                </label>
                <select
                  name="assigned_to"
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                >
                  <option value="">ללא הקצאה</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#384332]">
                  תאריך יעד (אופציונלי)
                </label>
                <input
                  name="due_date"
                  type="date"
                  className="w-full rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#384332]">
                פרטים נוספים (אופציונלי)
              </label>
              <textarea
                name="description"
                rows={2}
                placeholder="הסבר קצר..."
                className="w-full resize-none rounded-2xl border border-[#d8d1c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#6f7f57]"
              />
            </div>

            <button
              type="submit"
              className="rounded-2xl bg-[#2f3a2c] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#232b20]"
            >
              הוספת משימה
            </button>
          </form>
        </section>

        {/* Open tasks */}
        <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#2f3a2c]">
                משימות פתוחות
              </h2>
              <p className="mt-1 text-sm text-[#6c7664]">
                משימות שממתינות לטיפול
              </p>
            </div>
            <div className="rounded-full bg-[#eef2e8] px-4 py-2 text-sm text-[#5c694f]">
              {openTasks.length} משימות
            </div>
          </div>

          {tasksError && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
              שגיאה בטעינת הנתונים: {tasksError.message}
            </p>
          )}

          {!tasksError && openTasks.length === 0 && (
            <div className="rounded-2xl border border-[#e4dece] bg-[#fcfaf4] p-4 text-sm text-[#6c7664]">
              אין משימות פתוחות כרגע. מעולה!
            </div>
          )}

          {!tasksError && openTasks.length > 0 && (
            <ul className="space-y-3">
              {openTasks.map((task) => {
                const assigneeName = getMemberName(task.assigned_to)
                const creatorName = getMemberName(task.created_by)
                const isAssignedToMe = task.assigned_to === currentUser.id
                const isOverdue =
                  task.due_date !== null && task.due_date < new Date().toISOString().split('T')[0]

                return (
                  <li
                    key={task.id}
                    className={`rounded-2xl border p-4 ${
                      isOverdue
                        ? 'border-red-200 bg-red-50'
                        : isAssignedToMe
                          ? 'border-[#c8d8a8] bg-[#f4f8ee]'
                          : 'border-[#e4dece] bg-[#fcfaf4]'
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-[#384332]">
                          {task.title}
                        </p>

                        {task.description && (
                          <p className="text-sm text-[#6c7664]">
                            {task.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#5f6b58]">
                          {assigneeName && (
                            <span>
                              הוקצה ל:{' '}
                              <span className="font-medium">{assigneeName}</span>
                            </span>
                          )}
                          {creatorName && (
                            <span className="text-[#7a8471]">
                              נוצר ע"י: {creatorName}
                            </span>
                          )}
                          {task.due_date && (
                            <span
                              className={
                                isOverdue ? 'font-semibold text-red-600' : ''
                              }
                            >
                              יעד: {formatDate(task.due_date)}
                              {isOverdue && ' (באיחור)'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${getCategoryStyle(task.category)}`}
                        >
                          {getCategoryLabel(task.category)}
                        </span>

                        <form action="/api/tasks" method="POST">
                          <input
                            type="hidden"
                            name="action"
                            value="complete"
                          />
                          <input
                            type="hidden"
                            name="taskId"
                            value={task.id}
                          />
                          <button
                            type="submit"
                            className="rounded-xl bg-[#6f7f57] px-4 py-2 text-sm font-semibold text-white hover:bg-[#556343]"
                          >
                            סיימתי ✓
                          </button>
                        </form>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Recently completed */}
        {doneTasks.length > 0 && (
          <section className="rounded-3xl border border-[#d8d1c2] bg-[#fffdf8] p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-[#2f3a2c]">
                משימות שהושלמו לאחרונה
              </h2>
              <p className="mt-1 text-sm text-[#6c7664]">10 האחרונות</p>
            </div>

            <ul className="space-y-2">
              {doneTasks.map((task) => {
                const assigneeName = getMemberName(task.assigned_to)
                return (
                  <li
                    key={task.id}
                    className="flex items-center justify-between rounded-2xl border border-[#e4dece] bg-[#f8f6f0] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-green-600">✓</span>
                      <div>
                        <p className="text-sm font-medium text-[#6c7664] line-through">
                          {task.title}
                        </p>
                        {assigneeName && (
                          <p className="text-xs text-[#9a9e93]">{assigneeName}</p>
                        )}
                      </div>
                    </div>

                    <form action="/api/tasks" method="POST">
                      <input type="hidden" name="action" value="reopen" />
                      <input type="hidden" name="taskId" value={task.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-[#d8d1c2] px-3 py-1 text-xs text-[#6c7664] hover:bg-[#f6f3ea]"
                      >
                        פתח מחדש
                      </button>
                    </form>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
