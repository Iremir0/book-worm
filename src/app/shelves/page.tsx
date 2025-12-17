'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Loader2, 
  BookOpen, 
  BookMarked, 
  Heart,
  Star,
  MoreVertical,
  Trash2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserBook, ShelfType } from '@/types/database.types'
import Link from 'next/link'

export default function ShelvesPage() {
  const supabase = createClient()
  const [userBooks, setUserBooks] = useState<UserBook[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ShelfType>('read')

  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('user_books')
        .select('*, book:books(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setUserBooks(data || [])
      setLoading(false)
    }

    fetchBooks()
  }, [supabase])

  const handleShelfChange = async (bookId: string, newShelf: ShelfType) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const book = userBooks.find(b => b.id === bookId)
    if (!book) return

    const now = new Date().toISOString()
    const updates: any = { shelf: newShelf }

    if (newShelf === 'currently_reading' && !book.started_reading_at) {
      updates.started_reading_at = now
    } else if (newShelf === 'read' && !book.finished_reading_at) {
      updates.finished_reading_at = now
    }

    const { error } = await supabase
      .from('user_books')
      .update(updates)
      .eq('id', bookId)

    if (!error) {
      setUserBooks(prev =>
        prev.map(b => b.id === bookId ? { ...b, ...updates } : b)
      )

      // Create activity
      await supabase.from('activities').insert({
        user_id: user.id,
        activity_type: 'shelf_add',
        book_id: book.book_id,
        metadata: { shelf: newShelf }
      })
    }
  }

  const handleRemoveBook = async (bookId: string) => {
    await supabase
      .from('user_books')
      .delete()
      .eq('id', bookId)

    setUserBooks(prev => prev.filter(b => b.id !== bookId))
  }

  const filterByShelf = (shelf: ShelfType) => {
    return userBooks.filter(b => b.shelf === shelf)
  }

  const readBooks = filterByShelf('read')
  const currentlyReadingBooks = filterByShelf('currently_reading')
  const wantToReadBooks = filterByShelf('want_to_read')

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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">My Shelves</h1>
            <p className="text-slate-600 mt-1">Organize and track your reading journey</p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ShelfType)}>
            <TabsList className="mb-6">
              <TabsTrigger value="read" className="gap-2">
                <BookMarked className="h-4 w-4" />
                Read
                <Badge variant="secondary">{readBooks.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="currently_reading" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Currently Reading
                <Badge variant="secondary">{currentlyReadingBooks.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="want_to_read" className="gap-2">
                <Heart className="h-4 w-4" />
                Want to Read
                <Badge variant="secondary">{wantToReadBooks.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="read">
              <ShelfContent
                books={readBooks}
                emptyMessage="No books marked as read yet"
                onShelfChange={handleShelfChange}
                onRemove={handleRemoveBook}
              />
            </TabsContent>

            <TabsContent value="currently_reading">
              <ShelfContent
                books={currentlyReadingBooks}
                emptyMessage="No books currently reading"
                onShelfChange={handleShelfChange}
                onRemove={handleRemoveBook}
              />
            </TabsContent>

            <TabsContent value="want_to_read">
              <ShelfContent
                books={wantToReadBooks}
                emptyMessage="No books in want to read"
                onShelfChange={handleShelfChange}
                onRemove={handleRemoveBook}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

function ShelfContent({
  books,
  emptyMessage,
  onShelfChange,
  onRemove,
}: {
  books: UserBook[]
  emptyMessage: string
  onShelfChange: (bookId: string, shelf: ShelfType) => void
  onRemove: (bookId: string) => void
}) {
  if (books.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {books.map((userBook) => (
        <Card key={userBook.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <Link href={`/book/${userBook.book_id}`} className="flex-shrink-0">
                {userBook.book?.cover_url ? (
                  <img
                    src={userBook.book.cover_url}
                    alt={userBook.book.title}
                    className="w-24 h-36 object-cover rounded shadow-sm"
                  />
                ) : (
                  <div className="w-24 h-36 bg-slate-200 rounded flex items-center justify-center">
                    <span className="text-xs text-slate-400 text-center px-2">
                      No cover
                    </span>
                  </div>
                )}
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <Link
                      href={`/book/${userBook.book_id}`}
                      className="text-lg font-semibold text-slate-900 hover:text-primary transition-colors line-clamp-2"
                    >
                      {userBook.book?.title}
                    </Link>
                    <p className="text-sm text-slate-600 mt-1">
                      {userBook.book?.authors.join(', ')}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onShelfChange(userBook.id, 'want_to_read')}
                      >
                        <Heart className="mr-2 h-4 w-4" />
                        Want to Read
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onShelfChange(userBook.id, 'currently_reading')}
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        Currently Reading
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onShelfChange(userBook.id, 'read')}
                      >
                        <BookMarked className="mr-2 h-4 w-4" />
                        Read
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onRemove(userBook.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {userBook.book?.published_date && (
                    <Badge variant="outline" className="text-xs">
                      {new Date(userBook.book.published_date).getFullYear()}
                    </Badge>
                  )}
                  {userBook.book?.page_count && (
                    <Badge variant="outline" className="text-xs">
                      {userBook.book.page_count} pages
                    </Badge>
                  )}
                  {userBook.book?.categories?.[0] && (
                    <Badge variant="outline" className="text-xs">
                      {userBook.book.categories[0]}
                    </Badge>
                  )}
                </div>

                {userBook.rating && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-sm text-slate-600">Your rating:</span>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < userBook.rating!
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {userBook.book?.description && (
                  <p className="text-sm text-slate-600 line-clamp-2 mt-2">
                    {userBook.book.description.replace(/<[^>]*>/g, '')}
                  </p>
                )}

                <div className="flex gap-2 mt-3">
                  <Link href={`/book/${userBook.book_id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}