import { useNavigate } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold text-neutral-900">🍴 Spork</h1>
      <p className="text-neutral-500">Log meals, share with friends, build your streak.</p>
      <button
        onClick={() => navigate('/sign-in')}
        className="w-full rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white"
      >
        Get Started
      </button>
    </div>
  )
}
