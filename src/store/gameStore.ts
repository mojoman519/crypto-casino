'use client'

import { create } from 'zustand'
import type { CrashRound, CrashBet, JackpotRound, LiveBetEvent } from '@/types'

interface CrashState {
  currentRound: CrashRound | null
  currentMultiplier: number
  myBet: CrashBet | null
  bets: CrashBet[]
  hasCashedOut: boolean
  phase: 'waiting' | 'flying' | 'crashed'
  history: { crashPoint: number; id: string }[]
}

interface JackpotState {
  currentRound: JackpotRound | null
  spinning: boolean
  winner: { username: string; winAmount: number } | null
}

interface GameStoreState {
  liveFeed: LiveBetEvent[]
  crash: CrashState
  jackpot: JackpotState
  addLiveBet: (bet: LiveBetEvent) => void
  setCrashRound: (round: CrashRound | null) => void
  setCrashMultiplier: (multiplier: number) => void
  setCrashPhase: (phase: CrashState['phase']) => void
  setMyCrashBet: (bet: CrashBet | null) => void
  setCashedOut: (value: boolean) => void
  addCrashHistory: (entry: { crashPoint: number; id: string }) => void
  setJackpotRound: (round: JackpotRound | null) => void
  setJackpotWinner: (winner: { username: string; winAmount: number } | null) => void
  setJackpotSpinning: (spinning: boolean) => void
}

export const useGameStore = create<GameStoreState>((set) => ({
  liveFeed: [],
  crash: {
    currentRound: null,
    currentMultiplier: 1.0,
    myBet: null,
    bets: [],
    hasCashedOut: false,
    phase: 'waiting',
    history: [],
  },
  jackpot: {
    currentRound: null,
    spinning: false,
    winner: null,
  },

  addLiveBet: (bet) =>
    set((state) => ({
      liveFeed: [bet, ...state.liveFeed].slice(0, 50),
    })),

  setCrashRound: (round) =>
    set((state) => ({ crash: { ...state.crash, currentRound: round } })),

  setCrashMultiplier: (multiplier) =>
    set((state) => ({ crash: { ...state.crash, currentMultiplier: multiplier } })),

  setCrashPhase: (phase) =>
    set((state) => ({ crash: { ...state.crash, phase } })),

  setMyCrashBet: (bet) =>
    set((state) => ({ crash: { ...state.crash, myBet: bet } })),

  setCashedOut: (value) =>
    set((state) => ({ crash: { ...state.crash, hasCashedOut: value } })),

  addCrashHistory: (entry) =>
    set((state) => ({
      crash: {
        ...state.crash,
        history: [entry, ...state.crash.history].slice(0, 20),
      },
    })),

  setJackpotRound: (round) =>
    set((state) => ({ jackpot: { ...state.jackpot, currentRound: round } })),

  setJackpotWinner: (winner) =>
    set((state) => ({ jackpot: { ...state.jackpot, winner } })),

  setJackpotSpinning: (spinning) =>
    set((state) => ({ jackpot: { ...state.jackpot, spinning } })),
}))
