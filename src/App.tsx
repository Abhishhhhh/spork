import { Navigate, Route, Routes } from 'react-router-dom'
import Welcome from './screens/onboarding/Welcome'
import SignIn from './screens/onboarding/SignIn'
import ProfileSetup from './screens/onboarding/ProfileSetup'
import CalorieGoal from './screens/onboarding/CalorieGoal'
import PrivacyDefault from './screens/onboarding/PrivacyDefault'
import AddFirstFriends from './screens/onboarding/AddFirstFriends'
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
                <ProfileSetup />
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/goal"
          element={
            <ProtectedRoute>
              <RequireNotOnboarded>
                <CalorieGoal />
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/privacy"
          element={
            <ProtectedRoute>
              <RequireNotOnboarded>
                <PrivacyDefault />
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/friends"
          element={
            <ProtectedRoute>
              <RequireNotOnboarded>
                <AddFirstFriends />
              </RequireNotOnboarded>
            </ProtectedRoute>
          }
        />
        <Route
          path="/home/feed"
          element={
            <ProtectedRoute>
              <div className="p-6 text-center text-neutral-400">Welcome! Home shell coming in the next task.</div>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </div>
  )
}
