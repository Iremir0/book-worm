'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Navbar } from '@/components/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2 } from 'lucide-react'
import { searchBooks, type GoogleBook } from '@/lib/google-books'
import Link from 'next/link'

export default function SearchPage() {
  const t = useTranslations('common')
  const tBooks = useTranslations('books')
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<GoogleBook[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

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
      const data = await searchBooks(q)
      setResults(data.items || [])
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">{t('search')}</h1>
          
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by title, author, or ISBN..."
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
                  t('search')
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

          {!loading && searched && results.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {tBooks('noBooks')}
                </h3>
                <p className="text-slate-600">
                  Try adjusting your search terms
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && results.length > 0 && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Found {results.length} results
              </p>
              <div className="space-y-4">
                {results.map((book) => (
                  <BookSearchResult key={book.id} book={book} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function BookSearchResult({ book }: { book: GoogleBook }) {
  const tBook = useTranslations('book')
  const { volumeInfo } = book
  const authors = volumeInfo.authors?.join(', ') || 'Unknown Author'
  const coverUrl = volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:')
  const description = volumeInfo.description
  const truncatedDescription = description 
    ? description.length > 200 
      ? description.substring(0, 200) + '...' 
      : description
    : 'No description available'

  return (
    <Link href={`/book/${book.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardContent className="p-6">
          <div className="flex gap-4">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={volumeInfo.title}
                className="w-24 h-36 object-cover rounded shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-36 bg-slate-200 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-slate-400 text-center px-2">
                  No cover
                </span>
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 mb-1 hover:text-primary transition-colors">
                {volumeInfo.title}
              </h3>
              <p className="text-sm text-slate-600 mb-2">{authors}</p>
              
              <div className="flex flex-wrap gap-2 mb-2">
                {volumeInfo.publishedDate && (
                  <span className="text-xs text-slate-500">
                    {new Date(volumeInfo.publishedDate).getFullYear()}
                  </span>
                )}
                {volumeInfo.pageCount && (
                  <span className="text-xs text-slate-500">
                    • {tBook('pages', { count: volumeInfo.pageCount })}
                  </span>
                )}
                {volumeInfo.categories && volumeInfo.categories[0] && (
                  <span className="text-xs text-slate-500">
                    • {volumeInfo.categories[0]}
                  </span>
                )}
              </div>
              
              <p className="text-sm text-slate-600 line-clamp-2">
                {truncatedDescription}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}