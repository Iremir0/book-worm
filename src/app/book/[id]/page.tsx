'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Navbar } from '@/components/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Loader2, 
  Star, 
  BookOpen, 
  BookMarked, 
  Heart,
  MessageSquare
} from 'lucide-react'
import { getBookById, formatBookForDatabase, type GoogleBook } from '@/lib/google-books'
import { createClient } from '@/lib/supabase/client'
import type { Review, UserBook } from '@/types/database.types'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default function BookDetailPage() {
  const t = useTranslations('book')
  const tCommon = useTranslations('common')
  const params = useParams()
  const bookId = params.id as string
  const supabase = createClient()

  const [book, setBook] = useState<GoogleBook | null>(null)
  const [userBook, setUserBook] = useState<UserBook | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Rating state
  const [selectedRating, setSelectedRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)

  // Review state
  const [reviewText, setReviewText] = useState('')
  const [containsSpoilers, setContainsSpoilers] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)

      // Fetch book from Google Books
      try {
        const googleBook = await getBookById(bookId)
        setBook(googleBook)

        // Cache book in our database
        const formattedBook = formatBookForDatabase(googleBook)
        await supabase
          .from('books')
          .upsert(formattedBook, { onConflict: 'id' })

        // Fetch user's book status
        if (user) {
          const { data: userBookData } = await supabase
            .from('user_books')
            .select('*')
            .eq('user_id', user.id)
            .eq('book_id', bookId)
            .single()

          setUserBook(userBookData)
          if (userBookData?.rating) {
            setSelectedRating(userBookData.rating)
          }

          // Fetch user's review
          const { data: reviewData } = await supabase
            .from('reviews')
            .select('*')
            .eq('user_id', user.id)
            .eq('book_id', bookId)
            .single()

          if (reviewData) {
            setReviewText(reviewData.content)
            setContainsSpoilers(reviewData.contains_spoilers)
          }
        }

        // Fetch all reviews
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select(`
            *,
            profile:profiles(id, username, full_name, avatar_url),
            user_book:user_books!reviews_user_book_id_fkey(rating)
          `)
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })

        setReviews(reviewsData || [])
      } catch (error) {
        console.error('Error fetching book:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [bookId, supabase])

  const handleShelfChange = async (shelf: 'read' | 'currently_reading' | 'want_to_read') => {
    if (!userId) return

    const now = new Date().toISOString()
    const updates: any = { shelf }

    if (shelf === 'currently_reading' && !userBook?.started_reading_at) {
      updates.started_reading_at = now
    } else if (shelf === 'read' && !userBook?.finished_reading_at) {
      updates.finished_reading_at = now
    }

    if (userBook) {
      const { data, error } = await supabase
        .from('user_books')
        .update(updates)
        .eq('id', userBook.id)
        .select()
        .single()

      if (!error) {
        setUserBook(data)
        // Create activity
        await supabase.from('activities').insert({
          user_id: userId,
          activity_type: 'shelf_add',
          book_id: bookId,
          metadata: { shelf }
        })
      }
    } else {
      const { data, error } = await supabase
        .from('user_books')
        .insert({
          user_id: userId,
          book_id: bookId,
          ...updates
        })
        .select()
        .single()

      if (!error) {
        setUserBook(data)
        await supabase.from('activities').insert({
          user_id: userId,
          activity_type: 'shelf_add',
          book_id: bookId,
          metadata: { shelf }
        })
      }
    }
  }

  const handleRating = async (rating: number) => {
    if (!userId) return

    setSelectedRating(rating)

    if (userBook) {
      await supabase
        .from('user_books')
        .update({ rating })
        .eq('id', userBook.id)
    } else {
      const { data } = await supabase
        .from('user_books')
        .insert({
          user_id: userId,
          book_id: bookId,
          shelf: 'read',
          rating
        })
        .select()
        .single()

      setUserBook(data)
    }

    // Create activity
    await supabase.from('activities').insert({
      user_id: userId,
      activity_type: 'rating',
      book_id: bookId,
      metadata: { rating }
    })
  }

  const handleReviewSubmit = async () => {
    if (!userId || !reviewText.trim()) return

    setSubmitting(true)

    try {
      // Upsert review
      const { data: reviewData, error } = await supabase
        .from('reviews')
        .upsert({
          user_id: userId,
          book_id: bookId,
          user_book_id: userBook?.id || null,
          content: reviewText,
          contains_spoilers: containsSpoilers
        }, {
          onConflict: 'user_id,book_id'
        })
        .select()
        .single()

      if (!error) {
        // Create activity
        await supabase.from('activities').insert({
          user_id: userId,
          activity_type: 'review',
          book_id: bookId,
          review_id: reviewData.id
        })

        // Refresh reviews
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select(`
            *,
            profile:profiles(id, username, full_name, avatar_url),
            user_book:user_books!reviews_user_book_id_fkey(rating)
          `)
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })

        setReviews(reviewsData || [])
      }
    } catch (error) {
      console.error('Error submitting review:', error)
    } finally {
      setSubmitting(false)
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

  if (!book) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Book not found</h3>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const { volumeInfo } = book
  const coverUrl = volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:')

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Book Cover & Actions */}
            <div className="md:col-span-1">
              <Card>
                <CardContent className="p-6">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={volumeInfo.title}
                      className="w-full rounded shadow-lg mb-6"
                    />
                  ) : (
                    <div className="w-full h-96 bg-slate-200 rounded flex items-center justify-center mb-6">
                      <span className="text-slate-400">No cover</span>
                    </div>
                  )}

                  {/* Rating */}
                  <div className="mb-6">
                    <Label className="mb-2 block">{t('rate')}</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => handleRating(rating)}
                          onMouseEnter={() => setHoverRating(rating)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-8 w-8 ${
                              rating <= (hoverRating || selectedRating)
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shelf Buttons */}
                  <div className="space-y-2">
                    <Button
                      variant={userBook?.shelf === 'want_to_read' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleShelfChange('want_to_read')}
                    >
                      <Heart className="mr-2 h-4 w-4" />
                      {t('addToShelf')} - Want to Read
                    </Button>
                    <Button
                      variant={userBook?.shelf === 'currently_reading' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleShelfChange('currently_reading')}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Currently Reading
                    </Button>
                    <Button
                      variant={userBook?.shelf === 'read' ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => handleShelfChange('read')}
                    >
                      <BookMarked className="mr-2 h-4 w-4" />
                      Read
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Book Info & Reviews */}
            <div className="md:col-span-2">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">
                  {volumeInfo.title}
                </h1>
                <p className="text-lg text-slate-600 mb-4">
                  by {volumeInfo.authors?.join(', ') || 'Unknown Author'}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {volumeInfo.publishedDate && (
                    <Badge variant="secondary">
                      {new Date(volumeInfo.publishedDate).getFullYear()}
                    </Badge>
                  )}
                  {volumeInfo.pageCount && (
                    <Badge variant="secondary">{t('pages', { count: volumeInfo.pageCount })}</Badge>
                  )}
                  {volumeInfo.categories?.map((category) => (
                    <Badge key={category} variant="outline">
                      {category}
                    </Badge>
                  ))}
                </div>

                {volumeInfo.description && (
                <div className="prose prose-slate max-w-none text-slate-700">
                    <p className="whitespace-pre-wrap">
                    {volumeInfo.description.replace(/<[^>]*>/g, '')}
                    </p>
                </div>
                )}
              </div>

              <Separator className="my-6" />

              <Tabs defaultValue="reviews">
                <TabsList>
                  <TabsTrigger value="reviews">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {t('reviews')} ({reviews.length})
                  </TabsTrigger>
                  <TabsTrigger value="write">{t('writeReview')}</TabsTrigger>
                </TabsList>

                <TabsContent value="reviews" className="space-y-4 mt-4">
                  {reviews.length === 0 ? (
                    <Card>
                      <CardContent className="p-12 text-center">
                        <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600">{t('noReviews')}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    reviews.map((review) => (
                      <Card key={review.id}>
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <Link href={`/profile/${review.profile?.username}`}>
                              <Avatar>
                                <AvatarImage src={review.profile?.avatar_url || undefined} />
                                <AvatarFallback>
                                  {review.profile?.username?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </Link>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <Link
                                    href={`/profile/${review.profile?.username}`}
                                    className="font-semibold hover:underline"
                                  >
                                    {review.profile?.full_name || review.profile?.username}
                                  </Link>
                                  {review.user_book?.rating && (
                                    <div className="flex items-center mt-1">
                                      {[...Array(5)].map((_, i) => (
                                        <Star
                                          key={i}
                                          className={`h-4 w-4 ${
                                            i < (review.user_book?.rating || 0)
                                              ? 'fill-yellow-400 text-yellow-400'
                                              : 'text-slate-300'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm text-slate-500">
                                  {formatDistanceToNow(new Date(review.created_at), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                              <p className="text-slate-700 whitespace-pre-wrap">
                                {review.content}
                              </p>
                              {review.contains_spoilers && (
                                <Badge variant="outline" className="mt-2">
                                  {t('containsSpoilers')}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="write" className="mt-4">
                  <Card>
                    <CardContent className="p-6 space-y-4">
                      <div>
                        <Label htmlFor="review">{t('writeReview')}</Label>
                        <Textarea
                          id="review"
                          placeholder="Share your thoughts about this book..."
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          rows={6}
                          className="mt-2"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="spoilers"
                          checked={containsSpoilers}
                          onChange={(e) => setContainsSpoilers(e.target.checked)}
                          className="rounded"
                        />
                        <Label htmlFor="spoilers" className="cursor-pointer">
                          {t('containsSpoilers')}
                        </Label>
                      </div>
                      <Button
                        onClick={handleReviewSubmit}
                        disabled={!reviewText.trim() || submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {tCommon('loading')}
                          </>
                        ) : (
                          tCommon('submit')
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}