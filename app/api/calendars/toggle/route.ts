import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  try {
    const { calendarId, is_included } = await request.json()

    if (!calendarId || typeof is_included !== 'boolean') {
      return NextResponse.json(
        { error: 'Calendar ID and is_included status are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the calendar belongs to the user (via account ownership)
    const { data: calendar, error: fetchError } = await supabase
      .from('calendars')
      .select('id, account_id, calendar_accounts(user_id)')
      .eq('id', calendarId)
      .single()

    if (fetchError || !calendar) {
      return NextResponse.json(
        { error: 'Calendar not found' },
        { status: 404 }
      )
    }

    // Type assertion for the nested account data
    const account = calendar.calendar_accounts as unknown as { user_id: string } | null
    if (!account || account.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Calendar not found or unauthorized' },
        { status: 404 }
      )
    }

    // Update the calendar
    const { error: updateError } = await supabase
      .from('calendars')
      .update({ is_included })
      .eq('id', calendarId)

    if (updateError) {
      console.error('Failed to update calendar:', updateError)
      return NextResponse.json(
        { error: 'Failed to update calendar' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, is_included })
  } catch (error) {
    console.error('Error in toggle calendar:', error)
    return NextResponse.json(
      { error: 'Failed to update calendar' },
      { status: 500 }
    )
  }
}
