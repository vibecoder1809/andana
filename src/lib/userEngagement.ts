'use client'

import { useState, useEffect, useCallback } from 'react'

const KEY_TUTORIAL = 'andana-tutorial-completed'
const KEY_FIRST_SEEN = 'andana-first-seen'
const KEY_DONATION_SNOOZED = 'andana-donation-snoozed-until'

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
const DEFAULT_SNOOZE_DAYS = 14
const SUPPORT_SNOOZE_DAYS = 90
const NEVER_SNOOZE_DAYS = 3650

export function useUserEngagement() {
  const [showTutorial, setShowTutorial] = useState(false)
  const [showDonationPrompt, setShowDonationPrompt] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const now = Date.now()

    // 1. First seen timestamp
    let firstSeenStr = window.localStorage.getItem(KEY_FIRST_SEEN)
    if (!firstSeenStr) {
      firstSeenStr = String(now)
      try { window.localStorage.setItem(KEY_FIRST_SEEN, firstSeenStr) } catch {}
    }
    const firstSeen = parseInt(firstSeenStr, 10) || now

    // 2. Tutorial check
    const tutorialCompleted = window.localStorage.getItem(KEY_TUTORIAL) === 'true'
    if (!tutorialCompleted) {
      setShowTutorial(true)
    }

    // 3. Donation prompt check (only if tutorial is already completed, to not stack modals)
    if (tutorialCompleted) {
      const snoozedUntilStr = window.localStorage.getItem(KEY_DONATION_SNOOZED)
      const snoozedUntil = snoozedUntilStr ? parseInt(snoozedUntilStr, 10) || 0 : 0

      if (now - firstSeen >= TWO_DAYS_MS && now >= snoozedUntil) {
        setShowDonationPrompt(true)
      }
    }

    setIsHydrated(true)
  }, [])

  const dismissTutorial = useCallback(() => {
    setShowTutorial(false)
    try { window.localStorage.setItem(KEY_TUTORIAL, 'true') } catch {}

    // Check donation prompt after completing tutorial (if applicable)
    if (typeof window !== 'undefined') {
      const now = Date.now()
      const firstSeen = parseInt(window.localStorage.getItem(KEY_FIRST_SEEN) || '0', 10) || now
      const snoozedUntil = parseInt(window.localStorage.getItem(KEY_DONATION_SNOOZED) || '0', 10) || 0
      if (now - firstSeen >= TWO_DAYS_MS && now >= snoozedUntil) {
        setShowDonationPrompt(true)
      }
    }
  }, [])

  const openTutorial = useCallback(() => {
    setShowTutorial(true)
  }, [])

  const snoozeDonation = useCallback((days: number = DEFAULT_SNOOZE_DAYS) => {
    setShowDonationPrompt(false)
    if (typeof window === 'undefined') return
    const target = Date.now() + days * 24 * 60 * 60 * 1000
    try { window.localStorage.setItem(KEY_DONATION_SNOOZED, String(target)) } catch {}
  }, [])

  const openDonation = useCallback(() => {
    setShowDonationPrompt(true)
  }, [])

  return {
    isHydrated,
    showTutorial,
    openTutorial,
    dismissTutorial,
    showDonationPrompt,
    openDonation,
    snoozeDonation,
    DEFAULT_SNOOZE_DAYS,
    SUPPORT_SNOOZE_DAYS,
    NEVER_SNOOZE_DAYS,
  }
}
