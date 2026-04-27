import NotificationsBell from './notifications-bell'

type TopBarProps = {
  title: string
  subtitle?: string
  currentUserName: string
  unreadCount: number
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return parts[0].slice(0, 2)
}

export default function TopBar({
  title,
  subtitle,
  currentUserName,
  unreadCount,
}: TopBarProps) {
  return (
    <header className="rounded-3xl bg-[#2f3a2c] p-5 text-white shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight md:text-3xl" style={{ fontFamily: '"Gveret Levin", cursive', fontWeight: 400 }}>{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-white/60 leading-relaxed">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-bold tracking-wide"
            title={currentUserName}
          >
            {getInitials(currentUserName)}
          </div>

          <NotificationsBell unreadCount={unreadCount} href="/notifications" />
        </div>
      </div>
    </header>
  )
}
