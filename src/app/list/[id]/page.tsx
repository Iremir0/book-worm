'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Search,
  Edit,
  Lock,
  Globe
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { List, ListItem } from '@/types/database.types'
import { searchBooks, type GoogleBook, formatBookForDatabase } from '@/lib/google-books'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default function ListDetailPage() {
  const params = useParams()
  const router = useRouter()
  const listId = params.id as string
  const supabase = createClient()

  const [list, setList] = useState<List | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)

  // Add book dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GoogleBook[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)

      // Fetch list
      const { data: listData } = await supabase
        .from('lists')
        .select('*, profile:profiles(id, username, full_name, avatar_url)')
        .eq('id', listId)
        .single()

      if (!listData) {
        setLoading(false)
        return
      }

      // Check if list is public or owned by user
      if (!listData.is_public && listData.user_id !== user?.id) {
        router.push('/lists')
        return
      }

      setList(listData)
      setIsOwner(user?.id === listData.user_id)

      // Fetch list items
      const { data: itemsData } = await supabase
        .from('list_items')
        .select('*, book:books(*)')
        .eq('list_id', listId)
        .order('position', { ascending: true })

      setItems(itemsData || [])
      setLoading(false)
    }

    fetchList()
  }, [listId, supabase, router])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const data = await searchBooks(searchQuery, 0, 10)
      setSearchResults(data.items || [])
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setSearching(false)
    }
  }

  const handleAddBook = async (book: GoogleBook) => {
    if (!userId || !list) return

    setAdding(true)

    try {
      // Cache book in database
      const formattedBook = formatBookForDatabase(book)
      await supabase
        .from('books')
        .upsert(formattedBook, { onConflict: 'id' })

      // Add to list
      const { data, error } = await supabase
        .from('list_items')
        .insert({
          list_id: listId,
          book_id: book.id,
          position: items.length
        })
        .select('*, book:books(*)')
        .single()

      if (!error && data) {
        setItems(prev => [...prev, data])
        setSearchQuery('')
        setSearchResults([])
        setAddDialogOpen(false)
      }
    } catch (error) {
      console.error('Error adding book:', error)
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveBook = async (itemId: string) => {
    if (!isOwner) return

    await supabase
      .from('list_items')
      .delete()
      .eq('id', itemId)

    setItems(prev => prev.filter(item => item.id !== itemId))
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

  if (!list) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold text-slate-900">List not found</h3>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* List Header */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold text-slate-900">{list.title}</h1>
                    {list.is_public ? (
                      <Globe className="h-5 w-5 text-slate-400" />
                    ) : (
                      <Lock className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  {list.description && (
                    <p className="text-slate-700 mb-4">{list.description}</p>
                  )}
                  <Link
                    href={`/profile/${list.profile?.username}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={list.profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {list.profile?.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {list.profile?.full_name || list.profile?.username}
                      </p>
                      <p className="text-xs text-slate-500">
                        Created {formatDistanceToNow(new Date(list.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                </div>

                {isOwner && (
                  <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Book
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add Book to List</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Search for a book..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                          />
                          <Button onClick={handleSearch} disabled={searching}>
                            {searching ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <div className="max-h-96 overflow-y-auto space-y-2">
                          {searchResults.map((book) => {
                            const alreadyAdded = items.some(item => item.book_id === book.id)
                            return (
                              <div
                                key={book.id}
                                className="flex items-center gap-3 p-3 border rounded hover:bg-slate-50"
                              >
                                {book.volumeInfo.imageLinks?.thumbnail ? (
                                  <img
                                    src={book.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')}
                                    alt={book.volumeInfo.title}
                                    className="w-12 h-16 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-12 h-16 bg-slate-200 rounded" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm line-clamp-1">
                                    {book.volumeInfo.title}
                                  </h4>
                                  <p className="text-xs text-slate-600">
                                    {book.volumeInfo.authors?.join(', ') || 'Unknown'}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleAddBook(book)}
                                  disabled={alreadyAdded || adding}
                                >
                                  {alreadyAdded ? 'Added' : 'Add'}
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <Badge variant="secondary">{items.length} books</Badge>
            </CardContent>
          </Card>

          {/* List Items */}
          {items.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-slate-600">
                  {isOwner ? 'No books in this list yet. Add some!' : 'This list is empty.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="text-2xl font-bold text-slate-300 w-8">
                        {index + 1}
                      </div>
                      <Link href={`/book/${item.book_id}`} className="flex-shrink-0">
                        {item.book?.cover_url ? (
                          <img
                            src={item.book.cover_url}
                            alt={item.book.title}
                            className="w-20 h-30 object-cover rounded shadow-sm"
                          />
                        ) : (
                          <div className="w-20 h-30 bg-slate-200 rounded" />
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/book/${item.book_id}`}
                          className="text-lg font-semibold text-slate-900 hover:text-primary transition-colors line-clamp-2"
                        >
                          {item.book?.title}
                        </Link>
                        <p className="text-sm text-slate-600 mt-1">
                          {item.book?.authors.join(', ')}
                        </p>
                        {item.note && (
                          <p className="text-sm text-slate-700 mt-2 italic">
                            "{item.note}"
                          </p>
                        )}
                      </div>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBook(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}