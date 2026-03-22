import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const variants = {
  success: {
    container: 'bg-green-50 border-green-200 text-green-800',
    icon: CheckCircle2,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: AlertTriangle,
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: XCircle,
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: Info,
  },
} as const

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: keyof typeof variants
  children: React.ReactNode
}

export function Alert({ variant, className, children, ...props }: AlertProps) {
  const { container, icon: Icon } = variants[variant]

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg border text-sm animate-slide-in',
        container,
        className
      )}
      {...props}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  )
}
