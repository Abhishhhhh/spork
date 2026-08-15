import { Navigate, Route, Routes } from 'react-router-dom'
import Welcome from './screens/onboarding/Welcome'
import SignIn from './screens/onboarding/SignIn'
import ProfileSetup from './screens/onboarding/ProfileSetup'
import CalorieGoal from './screens/onboarding/CalorieGoal'
import PrivacyDefault from './screens/onboarding/PrivacyDefault'
import AddFirstFriends from './screens/onboarding/AddFirstFriends'
import FeedPlaceholder from './screens/feed/FeedPlaceholder'
import LogPlaceholder from './screens/log/LogPlaceholder'
import RewardsPlaceholder from './screens/rewards/RewardsPlaceholder'
import ProfileScreen from './screens/profile/ProfileScreen'
import FriendsPlaceholder from './screens/friends/FriendsPlaceholder'
import { HomeShell } from './screens/home/HomeShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RequireOnboarded } from './components/RequireOnboarded'
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
          path="/home"
          element={
            <ProtectedRoute>
              <RequireOnboarded>
                <HomeShell />
              </RequireOnboarded>
            </ProtectedRoute>
          }
        >
          <Route path="feed" element={<FeedPlaceholder />} />
          <Route path="log" element={<LogPlaceholder />} />
          <Route path="rewards" element={<RewardsPlaceholder />} />
          <Route path="friends" element={<FriendsPlaceholder />} />
          <Route path="profile" element={<ProfileScreen />} />
        </Route>

        <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
    </div>
  )
}
