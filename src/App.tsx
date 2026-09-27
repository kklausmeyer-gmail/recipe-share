import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Spinner from './components/Spinner'
import { AuthProvider, DataProvider, useAuth, useData } from './lib/store'
import { isConfigured } from './lib/supabase'
import AddRecipe from './pages/AddRecipe'
import Browse from './pages/Browse'
import CookMode from './pages/CookMode'
import Grocery from './pages/Grocery'
import Login from './pages/Login'
import NotInvited from './pages/NotInvited'
import Plan from './pages/Plan'
import RecipeDetail from './pages/RecipeDetail'
import RecipeEdit from './pages/RecipeEdit'
import Settings from './pages/Settings'
import SetupNeeded from './pages/SetupNeeded'

function Gate() {
  const { session, member, loading, isOwner } = useAuth()
  const { loaded, error } = useData()
  if (loading) return <Spinner />
  if (!session) return <Login />
  if (!member) return <NotInvited />
  if (!loaded) return <Spinner label="Opening the recipe box…" />
  if (error) return <p className="p-6 text-red-700">Couldn't load recipes: {error}</p>

  return (
    <Routes>
      <Route path="/r/:id/cook" element={<CookMode />} />
      <Route element={<Layout />}>
        <Route index element={<Browse />} />
        <Route path="/r/:id" element={<RecipeDetail />} />
        <Route path="/r/:id/edit" element={<RecipeEdit />} />
        <Route path="/add" element={<AddRecipe />} />
        {isOwner && <Route path="/plan" element={<Plan />} />}
        {isOwner && <Route path="/grocery" element={<Grocery />} />}
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  if (!isConfigured) return <SetupNeeded />
  return (
    <AuthProvider>
      <DataProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </DataProvider>
    </AuthProvider>
  )
}
