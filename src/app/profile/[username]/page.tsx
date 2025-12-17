'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  Loader2, 
  UserPlus, 
  UserMinus, 
  BookOpen,
  Star,
  List as ListIcon,
  Calendar
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserBook, Review, List } from '@/types/database.types'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default function ProfilePage() {
  const params = useParams()
  const username = params.username as string
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [userBooks, setUserBooks] = useState<UserBook[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    read: 0,
    currentlyReading: 0,
    wantToRead: 0
  })

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single()

      if (!profileData) {
        setLoading(false)
        return
      }

      setProfile(profileData)

      // Fetch follow stats
      const { count: followers } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profileData.id)

      const { count: following } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profileData.id)

      setFollowerCount(followers || 0)
      setFollowingCount(following || 0)

      // Check if current user follows this profile
      if (user) {
        const { data: followData } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', profileData.id)
          .single()

        setIsFollowing(!!followData)
      }

      // Fetch user books with book details
      const { data: booksData } = await supabase
        .from('user_books')
        .select('*, book:books(*)')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false })

      setUserBooks(booksData || [])

      // Calculate stats
      const read = booksData?.filter(b => b.shelf === 'read').length || 0
      const currentlyReading = booksData?.filter(b => b.shelf === 'currently_reading').length || 0
      const wantToRead = booksData?.filter(b => b.shelf === 'want_to_read').length || 0

      setStats({ read, currentlyReading, wantToRead })

      // Fetch reviews
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, book:books(*)')
        .eq('user_id', profileData.id)
        .order('created_at', { ascending: false })

      setReviews(reviewsData || [])

      // Fetch lists
      const { data: listsData } = await supabase
        .from('lists')
        .select(`
          *,
          list_items(count)
        `)
        .eq('user_id', profileData.id)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      setLists(listsData || [])

      setLoading(false)
    }

    fetchProfile()
  }, [username, supabase])

  const handleFollow = async () => {
    if (!currentUserId || !profile) return

    if (isFollowing) {
      // Unfollow
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profile.id)

      setIsFollowing(false)
      setFollowerCount(prev => prev - 1)
    } else {
      // Follow
      await supabase
        .from('follows')
        .insert({
          follower_id: currentUserId,
          following_id: profile.id
        })

      // Create activity
      await supabase.from('activities').insert({
        user_id: currentUserId,
        activity_type: 'follow',
        target_user_id: profile.id
      })

      setIsFollowing(true)
      setFollowerCount(prev => prev + 1)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        </main>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold text-slate-900">User not found</h3>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const isOwnProfile = currentUserId === profile.id

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Profile Header */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-4xl">
                    {profile.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                      <h1 className="text-3xl font-bold text-slate-900 mb-1">
                        {profile.full_name || profile.username}
                      </h1>
                      <p className="text-slate-600">@{profile.username}</p>
                    </div>

                    {!isOwnProfile && currentUserId && (
                      <Button
                        onClick={handleFollow}
                        variant={isFollowing ? 'outline' : 'default'}
                        className="mt-4 md:mt-0"
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

                  {profile.bio && (
                    <p className="text-slate-700 mb-4">{profile.bio}</p>
                  )}

                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="font-semibold text-slate-900">{followerCount}</span>
                      <span className="text-slate-600 ml-1">followers</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900">{followingCount}</span>
                      <span className="text-slate-600 ml-1">following</span>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-4">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {stats.read} read
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {stats.currentlyReading} reading
                    </Badge>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {stats.wantToRead} want to read
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Tabs */}
          <Tabs defaultValue="books">
            <TabsList className="mb-6">
              <TabsTrigger value="books">
                <BookOpen className="mr-2 h-4 w-4" />
                Books ({userBooks.length})
              </TabsTrigger>
              <TabsTrigger value="reviews">
                <Star className="mr-2 h-4 w-4" />
                Reviews ({reviews.length})
              </TabsTrigger>
              <TabsTrigger value="lists">
                <ListIcon className="mr-2 h-4 w-4" />
                Lists ({lists.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="books">
              {userBooks.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No books yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {userBooks.map((userBook) => (
                    <Link
                      key={userBook.id}
                      href={`/book/${userBook.book_id}`}
                      className="group"
                    >
                      <div className="relative">
                        {userBook.book?.cover_url ? (
                          <img
                            src={userBook.book.cover_url}
                            alt={userBook.book.title}
                            className="w-full rounded shadow-md group-hover:shadow-xl transition-shadow"
                          />
                        ) : (
                          <div className="w-full aspect-[2/3] bg-slate-200 rounded flex items-center justify-center">
                            <span className="text-xs text-slate-400 text-center px-2">
                              No cover
                            </span>
                          </div>
                        )}
                        {userBook.rating && (
                          <div className="absolute top-2 right-2 bg-white rounded-full px-2 py-1 shadow-md">
                            <div className="flex items-center">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs font-semibold ml-1">
                                {userBook.rating}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-slate-900 mt-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {userBook.book?.title}
                      </h3>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="reviews">
              {reviews.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Star className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No reviews yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <Card key={review.id}>
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          <Link href={`/book/${review.book_id}`}>
                            {review.book?.cover_url ? (
                              <img
                                src={review.book.cover_url}
                                alt={review.book.title}
                                className="w-20 h-30 object-cover rounded shadow-sm"
                              />
                            ) : (
                              <div className="w-20 h-30 bg-slate-200 rounded" />
                            )}
                          </Link>
                          <div className="flex-1">
                            <Link
                              href={`/book/${review.book_id}`}
                              className="text-lg font-semibold text-slate-900 hover:text-primary transition-colors"
                            >
                              {review.book?.title}
                            </Link>
                            <p className="text-sm text-slate-600 mb-2">
                              {review.book?.authors.join(', ')}
                            </p>
                            <p className="text-sm text-slate-500 mb-3">
                              {formatDistanceToNow(new Date(review.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                            <p className="text-slate-700 whitespace-pre-wrap">
                              {review.content}
                            </p>
                            {review.contains_spoilers && (
                              <Badge variant="outline" className="mt-2">
                                Contains Spoilers
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="lists">
              {lists.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <ListIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">No lists yet</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lists.map((list) => (
                    <Link key={list.id} href={`/list/${list.id}`}>
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <CardTitle className="flex items-center justify-between">
                            <span className="line-clamp-1">{list.title}</span>
                            <Badge variant="secondary">
                              {(list as any).list_items?.[0]?.count || 0} books
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        {list.description && (
                          <CardContent>
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {list.description}
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}