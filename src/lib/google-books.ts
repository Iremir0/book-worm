export interface GoogleBook {
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
    industryIdentifiers?: Array<{
      type: string
      identifier: string
    }>
  }
}

export interface SearchBooksResult {
  items?: GoogleBook[]
  totalItems: number
}

export async function searchBooks(query: string, startIndex = 0, maxResults = 20): Promise<SearchBooksResult> {
  if (!query.trim()) {
    return { totalItems: 0, items: [] }
  }

  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&startIndex=${startIndex}&maxResults=${maxResults}`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error('Failed to fetch books')
  }
  
  return response.json()
}

export async function getBookById(bookId: string): Promise<GoogleBook> {
  const url = `https://www.googleapis.com/books/v1/volumes/${bookId}`
  
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error('Failed to fetch book')
  }
  
  return response.json()
}

export function formatBookForDatabase(googleBook: GoogleBook) {
  const { id, volumeInfo } = googleBook
  
  const isbn10 = volumeInfo.industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier
  const isbn13 = volumeInfo.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier
  
  return {
    id,
    title: volumeInfo.title,
    authors: volumeInfo.authors || ['Unknown Author'],
    description: volumeInfo.description || null,
    cover_url: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
    published_date: volumeInfo.publishedDate || null,
    page_count: volumeInfo.pageCount || null,
    categories: volumeInfo.categories || null,
    isbn_10: isbn10 || null,
    isbn_13: isbn13 || null,
  }
}