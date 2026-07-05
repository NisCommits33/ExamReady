import { getActiveExam } from '@/lib/exam'
import { MockExamClient } from '@/components/mock/MockExamClient'

export const dynamic = 'force-dynamic'

export default async function MockExamPage() {
  const active = await getActiveExam()

  if (!active) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Mock Exam</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Enrol in an exam first to run a mock.</p>
      </div>
    )
  }

  const cfg = active.exam.config ?? {}
  return (
    <div className="max-w-2xl mx-auto">
      <MockExamClient
        examId={active.exam.id}
        examName={active.exam.name}
        negativeMarking={typeof cfg.negative_marking === 'number' ? cfg.negative_marking : 0.2}
        passMark={typeof cfg.pass_mark === 'number' ? cfg.pass_mark : 40}
        secondsPerQuestion={typeof cfg.mcq_time_limit_s === 'number' && cfg.mcq_time_limit_s > 0 ? cfg.mcq_time_limit_s : 54}
      />
    </div>
  )
}
