type NotificationsBellProps = {
  unreadCount: number
  href?: string
}

export default function NotificationsBell({
  unreadCount,
  href = '/notifications',
}: NotificationsBellProps) {
  return (
    <a
      href={href}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl text-white transition hover:bg-white/20"
      aria-label="התראות"
      title="התראות"
    >
      🔔

      {unreadCount > 0 && (
        <span className="absolute -left-1 -top-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#d96c4f] px-1 text-xs font-bold text-white shadow">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </a>
  )
}