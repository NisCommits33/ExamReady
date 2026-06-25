'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/**
 * Floating "go to top" button. Appears once the user has scrolled past the
 * fold and smooth-scrolls the window back to the top. Sits above the bottom
 * nav / floating action bar so it never overlaps them.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Go to top"
      className="fixed bottom-28 md:bottom-20 right-4 z-40 p-2.5 rounded-full bg-white dark:bg-[#161B22] border border-gray-200 dark:border-[#30363D] shadow-md text-gray-600 dark:text-gray-300 hover:text-brand-600 hover:border-brand-400 dark:hover:border-brand-700 transition-all duration-150 active:scale-95"
    >
      <ArrowUp size={18} />
    </button>
  )
}
