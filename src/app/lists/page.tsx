'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Navbar } from '@/components/navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Loader2, List as ListIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { List } from '@/types/database.types'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default function ListsPage() {
  const t = useTranslations('lists')
  const tCommon = useTranslations('common')
  const supabase = createClient()
  const [lists, setLists] = useState<List[]>([])
  const [myLists, setMyLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Create list form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const fetchLists = async () => {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)

      // Fetch public lists with user info
      const { data: publicLists } = await supabase
        .from('lists')
        .select(`
          *,
          profile:profiles(id, username, full_name, avatar_url),
          list_items(count)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20)

      setLists(publicLists || [])

      // Fetch user's own lists
      if (user) {
        const { data: userLists } = await supabase
          .from('lists')
          .select(`
            *,
            list_items(count)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        setMyLists(userLists || [])
      }

      setLoading(false)
    }

    fetchLists()
  }, [supabase])

  const handleCreateList = async () => {
    if (!userId || !title.trim()) return

    setCreating(true)

    try {
      const { data, error } = await supabase
        .from('lists')
        .insert({
          user_id: userId,
          title: title.trim(),
          description: description.trim() || null,
          is_public: isPublic
        })
        .select()
        .single()

      if (!error && data) {
        // Add to my lists
        setMyLists(prev => [data, ...prev])

        // If public, add to all lists
        if (isPublic) {
          setLists(prev => [{ ...data, profile: null, list_items: [] } as any, ...prev])
        }

        // Create activity
        await supabase.from('activities').insert({
          user_id: userId,
          activity_type: 'list_create',
          list_id: data.id
        })

        // Reset form
        setTitle('')
        setDescription('')
        setIsPublic(true)
        setDialogOpen(false)
      }
    } catch (error) {
      console.error('Error creating list:', error)
    } finally {
      setCreating(false)
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{t('title')}</h1>
            </div>

            {userId && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('createNew')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('createNew')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="title">{t('listTitle')}</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Best Sci-Fi of 2024"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">{t('listDescription')}</Label>
                      <Textarea
                        id="description"
                        placeholder="What's this list about?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="public"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="public" className="cursor-pointer">
                        {t('makePublic')}
                      </Label>
                    </div>
                    <Button
                      onClick={handleCreateList}
                      disabled={!title.trim() || creating}
                      className="w-full"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {tCommon('loading')}
                        </>
                      ) : (
                        t('createNew')
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* My Lists Section */}
          {myLists.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">{t('myLists')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myLists.map((list) => (
                  <ListCard key={list.id} list={list} showAuthor={false} />
                ))}
              </div>
            </div>
          )}

          {/* All Public Lists */}
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              {myLists.length > 0 ? 'Community Lists' : 'All Lists'}
            </h2>
            {lists.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <ListIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('noLists')}</h3>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lists.map((list) => (
                  <ListCard key={list.id} list={list} showAuthor={true} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function ListCard({ list, showAuthor }: { list: List; showAuthor: boolean }) {
  const itemCount = (list as any).list_items?.[0]?.count || 0

  return (
    <Link href={`/list/${list.id}`}>
      <Card className="hover:shadow-lg transition-shadow h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 flex-1">{list.title}</CardTitle>
            <Badge variant="secondary">{itemCount}</Badge>
          </div>
          {showAuthor && list.profile && (
            <Link
              href={`/profile/${list.profile.username}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 mt-2 hover:underline"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={list.profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {list.profile.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-slate-600">
                {list.profile.full_name || list.profile.username}
              </span>
            </Link>
          )}
        </CardHeader>
        {list.description && (
          <CardContent>
            <p className="text-sm text-slate-600 line-clamp-3">{list.description}</p>
            <p className="text-xs text-slate-500 mt-2">
              {formatDistanceToNow(new Date(list.created_at), { addSuffix: true })}
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}