'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, TrendingUp, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Book, UserBook } from '@/types/database.types'
import Link from 'next/link'

interface BookWithStats extends Book {
  rating_count: number
  average_rating: number
}

export default function BooksPage() {
  const supabase = createClient()
  const [popularBooks, setPopularBooks] = useState<BookWithStats[]>([])
  const [highestRated, setHighestRated] = useState<BookWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBooks = async () => {
      setLoading(true)

      // Get all books with ratings
      const { data: userBooksData } = await supabase
        .from('user_books')
        .select('book_id, rating, book:books(*)')
        .not('rating', 'is', null)

      if (userBooksData) {
        // Aggregate ratings by book
        const bookStats: Record<string, { book: Book; ratings: number[] }> = {}

        userBooksData.forEach((item: any) => {
          const bookId = item.book_id
          if (!bookStats[bookId]) {
            bookStats[bookId] = {
              book: item.book,
              ratings: [],
            }
          }
          bookStats[bookId].ratings.push(item.rating)
        })

        // Calculate stats
        const booksWithStats = Object.values(bookStats)
          .map(stat => ({
            ...stat.book,
            rating_count: stat.ratings.length,
            average_rating: stat.ratings.reduce((a, b) => a + b, 0) / stat.ratings.length,
          }))
          .filter(book => book.rating_count >= 3) // Minimum 3 ratings

        // Most popular (most ratings)
        const popular = [...booksWithStats]
          .sort((a, b) => b.rating_count - a.rating_count)
          .slice(0, 20)

        setPopularBooks(popular)

        // Highest rated (best average rating)
        const rated = [...booksWithStats]
          .sort((a, b) => b.average_rating - a.average_rating)
          .slice(0, 20)

        setHighestRated(rated)
      }

      setLoading(false)
    }

    fetchBooks()
  }, [supabase])

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
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Discover Books</h1>
            <p className="text-slate-600">Popular and highly-rated books from our community</p>
          </div>

          <Tabs defaultValue="popular">
            <TabsList className="mb-6">
              <TabsTrigger value="popular">
                <TrendingUp className="mr-2 h-4 w-4" />
                Most Popular
              </TabsTrigger>
              <TabsTrigger value="rated">
                <Star className="mr-2 h-4 w-4" />
                Highest Rated
              </TabsTrigger>
            </TabsList>

            <TabsContent value="popular">
              {popularBooks.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <TrendingUp className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">
                      No popular books yet. Start rating books to see them here!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {popularBooks.map((book, index) => (
                    <BookListItem key={book.id} book={book} rank={index + 1} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rated">
              {highestRated.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Star className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600">
                      No rated books yet. Start rating books to see them here!
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {highestRated.map((book, index) => (
                    <BookListItem key={book.id} book={book} rank={index + 1} />
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

interface BookListItemProps {
  book: BookWithStats
  rank: number
}

function BookListItem({ book, rank }: BookListItemProps) {
  return (
    <Link href={`/book/${book.id}`}>
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex gap-4 items-start">
            <div className="relative">
              <span className="absolute -left-10 top-0 text-3xl font-bold text-slate-200">
                {rank}
              </span>
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-24 h-36 object-cover rounded shadow-sm"
                />
              ) : (
                <div className="w-24 h-36 bg-slate-200 rounded flex items-center justify-center">
                  <span className="text-xs text-slate-400">No cover</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-slate-900 hover:text-primary transition-colors mb-1 line-clamp-2">
                {book.title}
              </h3>
              <p className="text-sm text-slate-600 mb-3">
                {book.authors.join(', ')}
              </p>

              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400 mr-1" />
                  <span className="text-lg font-semibold text-slate-900">
                    {book.average_rating.toFixed(2)}
                  </span>
                </div>
                <span className="text-sm text-slate-600">
                  {book.rating_count} rating{book.rating_count !== 1 ? 's' : ''}
                </span>
              </div>

              {book.description && (
                <p className="text-sm text-slate-600 line-clamp-3">
                  {book.description.replace(/<[^>]*>/g, '')}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                {book.categories?.slice(0, 3).map((category) => (
                  <span
                    key={category}
                    className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded"
                  >
                    {category}
                  </span>
                ))}
                {book.page_count && (
                  <span className="text-xs text-slate-500">
                    {book.page_count} pages
                  </span>
                )}
                {book.published_date && (
                  <span className="text-xs text-slate-500">
                    {new Date(book.published_date).getFullYear()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}