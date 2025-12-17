export type ShelfType = 'read' | 'currently_reading' | 'want_to_read'
export type ActivityType = 'review' | 'rating' | 'shelf_add' | 'list_create' | 'follow'

export interface Profile {
  id: string
  username: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  language: string | null
  created_at: string
  updated_at: string
}

export interface Book {
  id: string
  title: string
  authors: string[]
  description: string | null
  cover_url: string | null
  published_date: string | null
  page_count: number | null
  categories: string[] | null
  isbn_10: string | null
  isbn_13: string | null
  created_at: string
}

export interface UserBook {
  id: string
  user_id: string
  book_id: string
  shelf: ShelfType
  rating: number | null
  started_reading_at: string | null
  finished_reading_at: string | null
  created_at: string
  updated_at: string
  book?: Book
  profile?: Profile
}

export interface Review {
  id: string
  user_id: string
  book_id: string
  user_book_id: string | null
  content: string
  contains_spoilers: boolean
  created_at: string
  updated_at: string
  book?: Book
  profile?: Profile
  user_book?: UserBook
  likes_count?: number
  is_liked?: boolean
}

export interface List {
  id: string
  user_id: string
  title: string
  description: string | null
  is_public: boolean
  created_at: string
  updated_at: string
  profile?: Profile
  items_count?: number
}

export interface ListItem {
  id: string
  list_id: string
  book_id: string
  position: number
  note: string | null
  created_at: string
  book?: Book
}

export interface Activity {
  id: string
  user_id: string
  activity_type: ActivityType
  book_id: string | null
  review_id: string | null
  list_id: string | null
  target_user_id: string | null
  metadata: any
  created_at: string
  profile?: Profile
  book?: Book
  review?: Review
  list?: List
  target_profile?: Profile
}