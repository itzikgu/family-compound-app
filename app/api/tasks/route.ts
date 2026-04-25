import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { notifyTaskAssigned, notifyTaskCompleted } from '@/lib/notify'

export async function POST(request: Request) {
  const supabase = await createClient()

  const formData = await request.formData()
  const action = String(formData.get('action') ?? 'create')

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.email) {
    return NextResponse.redirect(
      new URL('/tasks?error=not-authenticated', request.url)
    )
  }

  const { data: familyMember, error: memberError } = await supabase
    .from('family_members')
    .select('id, full_name')
    .eq('email', user.email)
    .single()

  if (memberError || !familyMember) {
    return NextResponse.redirect(
      new URL('/tasks?error=not-authenticated', request.url)
    )
  }

  if (action === 'complete' || action === 'reopen') {
    const taskId = String(formData.get('taskId') ?? '')
    if (!taskId) {
      return NextResponse.redirect(
        new URL('/tasks?error=missing-task', request.url)
      )
    }

    if (action === 'complete') {
      // Fetch task details to notify the creator if different from completer
      const { data: task } = await supabase
        .from('tasks')
        .select('title, created_by, assigned_to')
        .eq('id', taskId)
        .maybeSingle()

      await supabase
        .from('tasks')
        .update({ status: 'done' })
        .eq('id', taskId)

      // Notify the task creator that it was completed (if someone else completed it)
      if (task && task.created_by && task.created_by !== familyMember.id) {
        await notifyTaskCompleted({
          recipientId: task.created_by,
          completerName: familyMember.full_name,
          taskTitle: task.title,
        })
      }
    } else {
      await supabase
        .from('tasks')
        .update({ status: 'open' })
        .eq('id', taskId)
    }

    return NextResponse.redirect(new URL('/tasks', request.url))
  }

  // create
  const title = String(formData.get('title') ?? '').trim()
  const descriptionRaw = String(formData.get('description') ?? '').trim()
  const description = descriptionRaw || null
  const assignedToRaw = String(formData.get('assigned_to') ?? '').trim()
  const assignedTo = assignedToRaw || null
  const category = String(formData.get('category') ?? 'general')
  const dueDateRaw = String(formData.get('due_date') ?? '').trim()
  const dueDate = dueDateRaw || null

  if (!title) {
    return NextResponse.redirect(
      new URL('/tasks?error=missing-title', request.url)
    )
  }

  const { error: insertError } = await supabase.from('tasks').insert({
    title,
    description,
    assigned_to: assignedTo,
    created_by: familyMember.id,
    status: 'open',
    category,
    due_date: dueDate,
  })

  if (insertError) {
    return NextResponse.redirect(
      new URL('/tasks?error=insert-failed', request.url)
    )
  }

  if (assignedTo && assignedTo !== familyMember.id) {
    await notifyTaskAssigned({
      recipientId: assignedTo,
      assignerName: familyMember.full_name,
      taskTitle: title,
    })
  }

  return NextResponse.redirect(new URL('/tasks', request.url))
}
