import { Navigate, Route, Routes } from 'react-router-dom'
import Welcome from './screens/onboarding/Welcome'
import SignIn from './screens/onboarding/SignIn'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RequireNotOnboarded } from './components/RequireNotOnboarded'

export default function App() {
  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-white">
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route
          path="/onboarding/profile"
          element={
            <ProtectedRoute>
              <RequireNotOnboarded>
                <div className="p-6 text-center text-neutral-400">Profile setup — coming in the next task</div>
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </div>
  )
}
