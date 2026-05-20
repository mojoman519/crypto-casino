'use client'

import { useCallback } from 'react'
import { audioManager, type SoundName } from '@/lib/audio-manager'

export function useSounds() {
  const play = useCallback((name: SoundName) => {
    audioManager.unlock()
    audioManager.play(name)
  }, [])

  const playAt = useCallback((name: SoundName, delaySeconds: number) => {
    audioManager.unlock()
    audioManager.playAt(name, delaySeconds)
  }, [])

  return {
    play,
    playAt,
    playWin:          () => play('win'),
    playBigWin:       () => play('bigWin'),
    playLose:         () => play('lose'),
    playCoinFlip:     () => play('coinFlip'),
    playCrashTick:    () => play('tick'),
    playCrashBoom:    () => play('lose'),
    playCashout:      () => play('cashout'),
    playRouletteSpin: () => play('rouletteSpin'),
    playDiceRoll:     () => play('diceRoll'),
    playNearWin:      () => play('nearWin'),
    playTension:      () => play('tension'),
    playDeposit:      () => play('deposit'),
    playClick:        () => play('click'),
    playModalOpen:    () => play('modalOpen'),
    playModalClose:   () => play('modalClose'),
    playBet:          () => play('click'),
    playJackpotSpin:  () => play('jackpotSpin'),
  }
}
