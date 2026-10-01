/** /home is the scaffold's default signed-in destination; the game lives at /play. */
import { Navigate } from 'react-router-dom'

export default function HomePage() {
  return <Navigate to="/play" replace />
}
