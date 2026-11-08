'use client'
import { Chessboard } from 'react-chessboard'

export default function ShowcaseBoard({ position, id }: { position: string; id: string }) {
  return (
    <Chessboard
      options={{
        id,
        position,
        allowDragging: false,
        showNotation: false,
        lightSquareStyle: { backgroundColor: 'var(--board-l)' },
        darkSquareStyle: { backgroundColor: 'var(--board-d)' },
        boardStyle: { borderRadius: 8, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.14)' },
      }}
    />
  )
}
