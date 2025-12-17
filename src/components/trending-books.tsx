'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import type { Book } from '@/types/database.types'
import { useTranslations } from 'next-intl'

interface BookWithStats extends Book {
  rating_count: number
  average_rating: number
}

export function TrendingBooks() {
  const t = useTranslations('home')
  const [books, setBooks] = useState<BookWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchTrendingBooks = async () => {
      // Get books with most ratings in the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data, error } = await supabase
        .from('user_books')
        .select(`
          book_id,
          rating,
          created_at,
          book:books(*)
        `)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('rating', 'is', null)

      if (!error && data) {
        // Aggregate ratings by book
        const bookStats = data.reduce((acc: any, item: any) => {
          const bookId = item.book_id
          if (!acc[bookId]) {
            acc[bookId] = {
              book: item.book,
              ratings: [],
            }
          }
          acc[bookId].ratings.push(item.rating)
          return acc
        }, {})

        // Calculate stats and sort
        const trending = Object.values(bookStats)
          .map((stat: any) => ({
            ...stat.book,
            rating_count: stat.ratings.length,
            average_rating: stat.ratings.reduce((a: number, b: number) => a + b, 0) / stat.ratings.length,
          }))
          .sort((a: any, b: any) => b.rating_count - a.rating_count)
          .slice(0, 5)

        setBooks(trending)
      }
      setLoading(false)
    }

    fetchTrendingBooks()
  }, [supabase])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('trending')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-3 animate-pulse">
                <div className="h-20 w-14 bg-slate-200 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (books.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('trending')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">No trending books yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trending Books
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {books.map((book, index) => (
            <Link
              key={book.id}
              href={`/book/${book.id}`}
              className="flex space-x-3 group"
            >
              <div className="relative">
                <span className="absolute -left-6 top-0 text-2xl font-bold text-slate-200">
                  {index + 1}
                </span>
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="h-24 w-16 object-cover rounded shadow-sm group-hover:shadow-md transition-shadow"
                  />
                ) : (
                  <div className="h-24 w-16 bg-slate-200 rounded flex items-center justify-center">
                    <span className="text-xs text-slate-400">No cover</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-slate-900 group-hover:text-primary transition-colors line-clamp-2">
                  {book.title}
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  {book.authors.join(', ')}
                </p>
                <div className="flex items-center mt-2 space-x-2">
                  <div className="flex items-center">
                    <span className="text-yellow-500 text-sm">⭐</span>
                    <span className="text-xs text-slate-600 ml-1">
                      {book.average_rating.toFixed(1)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    ({book.rating_count} ratings)
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}