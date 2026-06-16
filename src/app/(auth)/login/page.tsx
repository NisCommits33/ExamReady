import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gray-100 px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-base font-bold tracking-tight">ER</span>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900 leading-tight">ExamReady</p>
          <p className="text-xs text-gray-400 leading-tight">Smart exam prep, powered by AI</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h1 className="text-base font-semibold text-gray-900 mb-1">Sign in</h1>
        <p className="text-sm text-gray-500 mb-6">
          Continue to your exam prep dashboard
        </p>

        <LoginForm />
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-gray-400 text-center">
        Track your progress · drill smarter · ace the exam
      </p>
    </div>
  )
}
