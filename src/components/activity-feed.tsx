'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { tr, enUS } from 'date-fns/locale'
import { BookOpen, Star, List, UserPlus } from 'lucide-react'
import type { Activity } from '@/types/database.types'
import { useTranslations } from 'next-intl'
import { getCurrentLocale } from '@/lib/language'

interface ActivityFeedProps {
  userId: string
}

export function ActivityFeed({ userId }: ActivityFeedProps) {
  const t = useTranslations('home')
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchActivities = async () => {
      // Get users that the current user follows
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)

      const followingIds = following?.map(f => f.following_id) || []
      
      // Include current user's activities
      const userIds = [userId, ...followingIds]

      // Fetch activities from followed users
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          profile:profiles!activities_user_id_fkey(id, username, full_name, avatar_url),
          book:books(id, title, authors, cover_url),
          review:reviews(id, content, rating, contains_spoilers),
          list:lists(id, title, description),
          target_profile:profiles!activities_target_user_id_fkey(id, username, full_name)
        `)
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setActivities(data as any)
      }
      setLoading(false)
    }

    fetchActivities()

    // Subscribe to new activities
    const channel = supabase
      .channel('activities')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities',
        },
        (payload) => {
          // Refetch activities when new ones are added
          fetchActivities()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="flex items-start space-x-3">
                  <div className="h-10 w-10 bg-slate-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('title')}</h3>
          <p className="text-slate-600">
            {t('noActivities')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <Card key={activity.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <ActivityItem activity={activity} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ActivityItem({ activity }: { activity: Activity }) {
  const t = useTranslations('activity')
  const locale = getCurrentLocale()
  const dateLocale = locale === 'tr' ? tr : enUS

  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case 'review':
        return <Star className="h-5 w-5 text-yellow-500" />
      case 'rating':
        return <Star className="h-5 w-5 text-yellow-500" />
      case 'shelf_add':
        return <BookOpen className="h-5 w-5 text-blue-500" />
      case 'list_create':
        return <List className="h-5 w-5 text-green-500" />
      case 'follow':
        return <UserPlus className="h-5 w-5 text-purple-500" />
      default:
        return <BookOpen className="h-5 w-5 text-slate-500" />
    }
  }

  const getActivityText = () => {
    const username = activity.profile?.username
    
    switch (activity.activity_type) {
      case 'review':
        return (
          <>
            <Link href={`/profile/${username}`} className="font-semibold hover:underline">
              {activity.profile?.full_name || username}
            </Link>
            {' ' + t('reviewed') + ' '}
            <Link href={`/book/${activity.book?.id}`} className="font-semibold hover:underline">
              {activity.book?.title}
            </Link>
          </>
        )
      case 'rating':
        return (
          <>
            <Link href={`/profile/${username}`} className="font-semibold hover:underline">
              {activity.profile?.full_name || username}
            </Link>
            {' ' + t('rated') + ' '}
            <Link href={`/book/${activity.book?.id}`} className="font-semibold hover:underline">
              {activity.book?.title}
            </Link>
            {activity.metadata?.rating && (
              <span className="ml-2">
                {'⭐'.repeat(activity.metadata.rating)}
              </span>
            )}
          </>
        )
      case 'shelf_add':
        const shelfNames: Record<string, string> = {
          read: t('finishedReading'),
          currently_reading: t('startedReading'),
          want_to_read: t('wantsToRead'),
        }
        return (
          <>
            <Link href={`/profile/${username}`} className="font-semibold hover:underline">
              {activity.profile?.full_name || username}
            </Link>
            {' ' + (shelfNames[activity.metadata?.shelf] || 'added') + ' '}
            <Link href={`/book/${activity.book?.id}`} className="font-semibold hover:underline">
              {activity.book?.title}
            </Link>
          </>
        )
      case 'list_create':
        return (
          <>
            <Link href={`/profile/${username}`} className="font-semibold hover:underline">
              {activity.profile?.full_name || username}
            </Link>
            {' ' + t('createdList') + ' '}
            <Link href={`/list/${activity.list?.id}`} className="font-semibold hover:underline">
              {activity.list?.title}
            </Link>
          </>
        )
      case 'follow':
        return (
          <>
            <Link href={`/profile/${username}`} className="font-semibold hover:underline">
              {activity.profile?.full_name || username}
            </Link>
            {' ' + t('followedUser') + ' '}
            <Link href={`/profile/${activity.target_profile?.username}`} className="font-semibold hover:underline">
              {activity.target_profile?.full_name || activity.target_profile?.username}
            </Link>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex items-start space-x-3">
      <Link href={`/profile/${activity.profile?.username}`}>
        <Avatar className="h-10 w-10">
          <AvatarImage src={activity.profile?.avatar_url || undefined} />
          <AvatarFallback>
            {activity.profile?.username?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          {getActivityIcon()}
          <p className="text-sm text-slate-900">
            {getActivityText()}
          </p>
        </div>

        <p className="text-xs text-slate-500">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: dateLocale })}
        </p>

        {activity.activity_type === 'review' && activity.review && (
          <div className="mt-3 p-3 bg-slate-50 rounded-md">
            <p className="text-sm text-slate-700 line-clamp-3">
              {activity.review.content}
            </p>
            {activity.review.contains_spoilers && (
              <Badge variant="outline" className="mt-2 text-xs">
                Contains Spoilers
              </Badge>
            )}
          </div>
        )}

        {activity.book?.cover_url && ['review', 'rating', 'shelf_add'].includes(activity.activity_type) && (
          <div className="mt-3">
            <Link href={`/book/${activity.book.id}`}>
              <img
                src={activity.book.cover_url}
                alt={activity.book.title}
                className="h-32 w-auto rounded shadow-sm hover:shadow-md transition-shadow"
              />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}