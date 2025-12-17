'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Navbar } from '@/components/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Users, UserPlus, UserMinus, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database.types'
import Link from 'next/link'

export default function UsersPage() {
  const t = useTranslations('common')
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const supabase = createClient()

  const [query, setQuery] = useState(initialQuery)
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [followStatus, setFollowStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [supabase])

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery)
    }
  }, [initialQuery])

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query
    if (!q.trim()) return

    setLoading(true)
    setSearched(true)

    try {
      // Search users by username or full name
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(50)

      if (!error && usersData) {
        setUsers(usersData)

        // Check follow status for all users if logged in
        if (currentUserId) {
          const { data: followsData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUserId)
            .in('following_id', usersData.map(u => u.id))

          const followStatusMap: Record<string, boolean> = {}
          followsData?.forEach(follow => {
            followStatusMap[follow.following_id] = true
          })
          setFollowStatus(followStatusMap)
        }
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch()
  }

  const toggleFollow = async (userId: string) => {
    if (!currentUserId) return

    const isFollowing = followStatus[userId]

    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId)

        setFollowStatus(prev => ({ ...prev, [userId]: false }))
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: userId
          })

        // Create activity
        await supabase.from('activities').insert({
          user_id: currentUserId,
          activity_type: 'follow',
          target_user_id: userId
        })

        setFollowStatus(prev => ({ ...prev, [userId]: true }))
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Find Friends
            </h1>
            <p className="text-slate-600">
              Search for users by username or name to connect with fellow readers
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mb-8">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by username or name..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 h-12 text-lg"
                />
              </div>
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('loading')}
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    {t('search')}
                  </>
                )}
              </Button>
            </div>
          </form>

          {loading && (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-slate-600">{t('loading')}</p>
            </div>
          )}

          {!loading && searched && users.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No users found
                </h3>
                <p className="text-slate-600">
                  Try adjusting your search terms
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && users.length > 0 && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Found {users.length} user{users.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-4">
                {users.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    currentUserId={currentUserId}
                    isFollowing={followStatus[user.id] || false}
                    onToggleFollow={() => toggleFollow(user.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

interface UserCardProps {
  user: Profile
  currentUserId: string | null
  isFollowing: boolean
  onToggleFollow: () => void
}

function UserCard({ user, currentUserId, isFollowing, onToggleFollow }: UserCardProps) {
  const [stats, setStats] = useState({ books: 0, followers: 0, following: 0 })
  const supabase = createClient()

  useEffect(() => {
    const fetchStats = async () => {
      // Get book count
      const { count: booksCount } = await supabase
        .from('user_books')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      // Get followers count
      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id)

      // Get following count
      const { count: followingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id)

      setStats({
        books: booksCount || 0,
        followers: followersCount || 0,
        following: followingCount || 0
      })
    }

    fetchStats()
  }, [user.id, supabase])

  const isOwnProfile = currentUserId === user.id

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Link href={`/profile/${user.username}`}>
            <Avatar className="h-16 w-16 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="text-xl">
                {user.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <Link href={`/profile/${user.username}`}>
              <h3 className="text-lg font-semibold text-slate-900 hover:text-primary transition-colors">
                {user.full_name || user.username}
              </h3>
            </Link>
            <p className="text-sm text-slate-600 mb-2">@{user.username}</p>

            {user.bio && (
              <p className="text-sm text-slate-700 mb-3 line-clamp-2">
                {user.bio}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm mb-3">
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4 text-slate-500" />
                <span className="font-semibold text-slate-900">{stats.books}</span>
                <span className="text-slate-600">books</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="font-semibold text-slate-900">{stats.followers}</span>
                <span className="text-slate-600">followers</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-900">{stats.following}</span>
                <span className="text-slate-600">following</span>
              </div>
            </div>
          </div>

          {!isOwnProfile && currentUserId && (
            <Button
              onClick={onToggleFollow}
              variant={isFollowing ? 'outline' : 'default'}
              size="sm"
              className="flex-shrink-0"
            >
              {isFollowing ? (
                <>
                  <UserMinus className="mr-2 h-4 w-4" />
                  Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Follow
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
