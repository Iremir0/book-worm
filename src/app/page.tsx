import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/navbar'
import { ActivityFeed } from '@/components/activity-feed'
import { TrendingBooks } from '@/components/trending-books'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-2">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-slate-900">Your Feed</h1>
              <p className="text-slate-600 mt-1">See what your friends are reading</p>
            </div>
            <ActivityFeed userId={user.id} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <TrendingBooks />
          </div>
        </div>
      </main>
    </div>
  )
}