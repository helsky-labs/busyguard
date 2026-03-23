import { Link2, CalendarDays, Shield } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const steps = [
  {
    step: 1,
    icon: Link2,
    title: 'Connect your calendar',
    description: 'Link your Google Calendar account to get started',
    active: true,
  },
  {
    step: 2,
    icon: CalendarDays,
    title: 'Pick calendars to sync',
    description: 'Choose which calendars should share availability',
    active: false,
  },
  {
    step: 3,
    icon: Shield,
    title: 'Automatic busy blocks',
    description: 'BusyGuard keeps your calendars in sync automatically',
    active: false,
  },
]

export function OnboardingEmptyState() {
  return (
    <Card>
      <CardContent className="py-10">
        <h2 className="font-display text-xl font-bold text-gray-900 text-center mb-2">
          Get started with BusyGuard
        </h2>
        <p className="text-gray-500 text-sm text-center mb-8 max-w-md mx-auto">
          Three steps to never double-book again
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          {steps.map(({ step, icon: Icon, title, description, active }) => (
            <div
              key={step}
              className={`text-center ${active ? '' : 'opacity-40'}`}
            >
              <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl mb-3 ${
                active ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <Icon className="h-6 w-6" />
              </div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                Step {step}
              </p>
              <p className="font-medium text-gray-900 text-sm mb-1">{title}</p>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <a
            href="/dashboard/accounts"
            className="inline-flex items-center px-5 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-xs"
          >
            Connect your first account
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
