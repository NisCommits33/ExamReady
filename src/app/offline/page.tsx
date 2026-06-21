import { Logo } from '@/components/ui/Logo'

export const dynamic = 'force-static'

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center bg-gray-50 dark:bg-[#0D1117]">
      <Logo size={56} />
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">You&apos;re offline</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
          LOKAI needs a connection for this page. Reconnect and try again.
        </p>
      </div>
    </div>
  )
}
