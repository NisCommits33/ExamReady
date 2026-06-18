'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, LifeBuoy } from 'lucide-react'
import { toast } from 'sonner'
import type { Topic } from '@/types/database'
import { daysToExam } from '@/lib/utils'

interface RescueCardProps {
  topics: Pick<Topic, 'id' | 'name' | 'ai_priority'>[]
}

export function RescueCard({ topics }: RescueCardProps) {
  const router = useRouter()
  const days = daysToExam()
  const top = topics[0]
  const [generating, setGenerating] = useState(false)

  async function getRescuePlan() {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/rescue-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: top.id }),
      })
      const json = await res.json()
      if (json.ok) {
        toast.success(`Rescue plan ready for ${top.name} · ${json.mcqCount} MCQs + sessions added`)
        router.refresh()
      } else {
        toast.error('Failed to generate rescue plan')
      }
    } catch {
      toast.error('Failed to generate rescue plan')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#161B22] rounded-xl p-4 border-l-danger border border-gray-200 dark:border-[#30363D]">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-danger-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold text-danger-400 bg-danger-50 px-2 py-0.5 rounded-full uppercase tracking-wide">AI Rescue</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{topics.length} topic{topics.length > 1 ? 's' : ''} at risk</span>
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{top.name}</p>
          <p className="text-xs text-danger-400 mt-0.5">Not started · {days} days left · <strong>High risk</strong></p>
        </div>
        <button
          onClick={getRescuePlan}
          disabled={generating}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-danger-400 rounded-lg hover:bg-danger-800 transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : <LifeBuoy size={13} />}
          Get plan
        </button>
      </div>
    </div>
  )
}
