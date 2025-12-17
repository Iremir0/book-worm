// Multi-API Book Search Integration
// Combines Google Books API and Open Library API for broader coverage

export interface UnifiedBook {
  id: string
  source: 'google' | 'openlibrary'
  title: string
  authors: string[]
  description?: string
  coverUrl?: string
  publishedDate?: string
  pageCount?: number
  categories?: string[]
  isbn10?: string
  isbn13?: string
  publisher?: string
  language?: string
}

// Google Books API Types
interface GoogleBook {
  id: string
  volumeInfo: {
    title: string
    authors?: string[]
    description?: string
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    publishedDate?: string
    pageCount?: number
    categories?: string[]
    publisher?: string
    language?: string
    industryIdentifiers?: Array<{
      type: string
      identifier: string
    }>
  }
}

// Open Library API Types
interface OpenLibraryDoc {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  isbn?: string[]
  publisher?: string[]
  language?: string[]
  number_of_pages_median?: number
  cover_i?: number
  subject?: string[]
}

interface OpenLibrarySearchResponse {
  docs: OpenLibraryDoc[]
  numFound: number
}

interface OpenLibraryWork {
  title: string
  authors?: Array<{ author: { key: string } }>
  description?: string | { value: string }
  covers?: number[]
  subjects?: string[]
  first_publish_date?: string
}

interface OpenLibraryEdition {
  title: string
  authors?: Array<{ key: string }>
  description?: string | { value: string }
  covers?: number[]
  publishers?: string[]
  publish_date?: string
  number_of_pages?: number
  languages?: Array<{ key: string }>
  isbn_10?: string[]
  isbn_13?: string[]
}

// Convert Google Books to unified format
function convertGoogleBook(book: GoogleBook): UnifiedBook {
  const { id, volumeInfo } = book
  const isbn10 = volumeInfo.industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier
  const isbn13 = volumeInfo.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier

  return {
    id: `google:${id}`,
    source: 'google',
    title: volumeInfo.title,
    authors: volumeInfo.authors || ['Unknown Author'],
    description: volumeInfo.description,
    coverUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
    publishedDate: volumeInfo.publishedDate,
    pageCount: volumeInfo.pageCount,
    categories: volumeInfo.categories,
    isbn10,
    isbn13,
    publisher: volumeInfo.publisher,
    language: volumeInfo.language,
  }
}

// Convert Open Library to unified format
function convertOpenLibraryDoc(doc: OpenLibraryDoc): UnifiedBook {
  const isbn13 = doc.isbn?.find(isbn => isbn.length === 13)
  const isbn10 = doc.isbn?.find(isbn => isbn.length === 10)

  return {
    id: `openlibrary:${doc.key}`,
    source: 'openlibrary',
    title: doc.title,
    authors: doc.author_name || ['Unknown Author'],
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
    publishedDate: doc.first_publish_year?.toString(),
    pageCount: doc.number_of_pages_median,
    categories: doc.subject?.slice(0, 5),
    isbn10,
    isbn13,
    publisher: doc.publisher?.[0],
    language: doc.language?.[0],
  }
}

// Search Google Books API
async function searchGoogleBooks(query: string, maxResults = 10): Promise<UnifiedBook[]> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
    const response = await fetch(url)

    if (!response.ok) {
      console.error('Google Books API error:', response.status)
      return []
    }

    const data = await response.json()
    return (data.items || []).map(convertGoogleBook)
  } catch (error) {
    console.error('Error fetching from Google Books:', error)
    return []
  }
}

// Search Open Library API
async function searchOpenLibrary(query: string, limit = 10): Promise<UnifiedBook[]> {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`
    const response = await fetch(url)

    if (!response.ok) {
      console.error('Open Library API error:', response.status)
      return []
    }

    const data: OpenLibrarySearchResponse = await response.json()
    return data.docs.map(convertOpenLibraryDoc)
  } catch (error) {
    console.error('Error fetching from Open Library:', error)
    return []
  }
}

// Combined search across all APIs
export async function searchBooksMultiAPI(query: string): Promise<UnifiedBook[]> {
  if (!query.trim()) {
    return []
  }

  // Fetch from both APIs in parallel
  const [googleResults, openLibraryResults] = await Promise.all([
    searchGoogleBooks(query, 20),
    searchOpenLibrary(query, 20),
  ])

  // Combine and deduplicate results by ISBN or title
  const allBooks = [...googleResults, ...openLibraryResults]
  const uniqueBooks = new Map<string, UnifiedBook>()

  for (const book of allBooks) {
    // Try to deduplicate by ISBN first
    const key = book.isbn13 || book.isbn10 || `${book.title.toLowerCase()}-${book.authors[0]?.toLowerCase()}`

    if (!uniqueBooks.has(key)) {
      uniqueBooks.set(key, book)
    } else {
      // If we have a duplicate, prefer the one with more data
      const existing = uniqueBooks.get(key)!
      if (hasMoreData(book, existing)) {
        uniqueBooks.set(key, book)
      }
    }
  }

  return Array.from(uniqueBooks.values()).slice(0, 40)
}

// Helper to determine which book has more complete data
function hasMoreData(book1: UnifiedBook, book2: UnifiedBook): boolean {
  const score1 = (
    (book1.description ? 3 : 0) +
    (book1.coverUrl ? 2 : 0) +
    (book1.pageCount ? 1 : 0) +
    (book1.categories?.length || 0)
  )

  const score2 = (
    (book2.description ? 3 : 0) +
    (book2.coverUrl ? 2 : 0) +
    (book2.pageCount ? 1 : 0) +
    (book2.categories?.length || 0)
  )

  return score1 > score2
}

// Get book by ID (supports both sources)
export async function getBookByIdMultiAPI(bookId: string): Promise<UnifiedBook | null> {
  const [source, id] = bookId.split(':')

  if (source === 'google') {
    try {
      const url = `https://www.googleapis.com/books/v1/volumes/${id}`
      const response = await fetch(url)

      if (!response.ok) return null

      const data = await response.json()
      return convertGoogleBook(data)
    } catch (error) {
      console.error('Error fetching book from Google:', error)
      return null
    }
  }

  if (source === 'openlibrary') {
    try {
      // Try to get work details first
      const workUrl = `https://openlibrary.org${id}.json`
      const response = await fetch(workUrl)

      if (!response.ok) return null

      const work: OpenLibraryWork = await response.json()

      // Get cover and additional details
      const bookData: UnifiedBook = {
        id: bookId,
        source: 'openlibrary',
        title: work.title,
        authors: ['Unknown Author'], // Would need additional API call to get author names
        description: typeof work.description === 'string' ? work.description : work.description?.value,
        coverUrl: work.covers?.[0] ? `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg` : undefined,
        categories: work.subjects?.slice(0, 5),
        publishedDate: work.first_publish_date,
      }

      return bookData
    } catch (error) {
      console.error('Error fetching book from Open Library:', error)
      return null
    }
  }

  return null
}

// Search by ISBN across all APIs
export async function searchByISBN(isbn: string): Promise<UnifiedBook | null> {
  // Try Google Books first
  try {
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    const googleResponse = await fetch(googleUrl)

    if (googleResponse.ok) {
      const data = await googleResponse.json()
      if (data.items && data.items.length > 0) {
        return convertGoogleBook(data.items[0])
      }
    }
  } catch (error) {
    console.error('Error searching ISBN in Google Books:', error)
  }

  // Try Open Library
  try {
    const olUrl = `https://openlibrary.org/isbn/${isbn}.json`
    const olResponse = await fetch(olUrl)

    if (olResponse.ok) {
      const edition: OpenLibraryEdition = await olResponse.json()

      return {
        id: `openlibrary:/books/${isbn}`,
        source: 'openlibrary',
        title: edition.title,
        authors: ['Unknown Author'], // Would need work API call
        description: typeof edition.description === 'string' ? edition.description : edition.description?.value,
        coverUrl: edition.covers?.[0] ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-L.jpg` : undefined,
        publishedDate: edition.publish_date,
        pageCount: edition.number_of_pages,
        isbn10: edition.isbn_10?.[0],
        isbn13: edition.isbn_13?.[0],
        publisher: edition.publishers?.[0],
      }
    }
  } catch (error) {
    console.error('Error searching ISBN in Open Library:', error)
  }

  return null
}

// Format unified book for database storage
export function formatUnifiedBookForDatabase(book: UnifiedBook) {
  return {
    id: book.id,
    title: book.title,
    authors: book.authors,
    description: book.description || null,
    cover_url: book.coverUrl || null,
    published_date: book.publishedDate || null,
    page_count: book.pageCount || null,
    categories: book.categories || null,
    isbn_10: book.isbn10 || null,
    isbn_13: book.isbn13 || null,
    publisher: book.publisher || null,
    language: book.language || null,
  }
}
