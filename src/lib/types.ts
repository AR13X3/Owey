export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      households: {
        Row: {
          id: string
          name: string
          user1_id: string | null
          user2_id: string | null
          invite_code: string
          created_at: string
        }
        Insert: {
          id?: string
          name?: string
          user1_id?: string | null
          user2_id?: string | null
          invite_code?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          user1_id?: string | null
          user2_id?: string | null
          invite_code?: string
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_color: string
          household_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          avatar_color?: string
          household_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          avatar_color?: string
          household_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          id: string
          household_id: string
          uploaded_by: string
          store_name: string
          receipt_date: string
          raw_text: string | null
          total_amount: number
          split_mode: 'half' | 'per_item' | 'all_me' | 'all_partner'
          is_settled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          uploaded_by: string
          store_name: string
          receipt_date: string
          raw_text?: string | null
          total_amount: number
          split_mode?: 'half' | 'per_item' | 'all_me' | 'all_partner'
          is_settled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          uploaded_by?: string
          store_name?: string
          receipt_date?: string
          raw_text?: string | null
          total_amount?: number
          split_mode?: 'half' | 'per_item' | 'all_me' | 'all_partner'
          is_settled?: boolean
          created_at?: string
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          id: string
          receipt_id: string
          name: string
          quantity: number
          unit_price: number
          total_price: number
          assigned_to: 'user1' | 'user2' | 'shared'
        }
        Insert: {
          id?: string
          receipt_id: string
          name: string
          quantity?: number
          unit_price: number
          assigned_to?: 'user1' | 'user2' | 'shared'
        }
        Update: {
          id?: string
          receipt_id?: string
          name?: string
          quantity?: number
          unit_price?: number
          assigned_to?: 'user1' | 'user2' | 'shared'
        }
        Relationships: []
      }
      expenses: {
        Row: {
          id: string
          household_id: string
          paid_by: string
          expense_type: 'personal' | 'shared' | 'loan'
          category: string
          amount: number
          description: string
          expense_date: string
          split_with: string | null
          loan_to: string | null
          is_settled: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          paid_by: string
          expense_type: 'personal' | 'shared' | 'loan'
          category: string
          amount: number
          description: string
          expense_date: string
          split_with?: string | null
          loan_to?: string | null
          is_settled?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          paid_by?: string
          expense_type?: 'personal' | 'shared' | 'loan'
          category?: string
          amount?: number
          description?: string
          expense_date?: string
          split_with?: string | null
          loan_to?: string | null
          is_settled?: boolean
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          id: string
          household_id: string
          paid_by: string
          paid_to: string
          amount: number
          notes: string | null
          settled_at: string
        }
        Insert: {
          id?: string
          household_id: string
          paid_by: string
          paid_to: string
          amount: number
          notes?: string | null
          settled_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          paid_by?: string
          paid_to?: string
          amount?: number
          notes?: string | null
          settled_at?: string
        }
        Relationships: []
      }
    }
    Functions: {
      join_household: {
        Args: { p_invite_code: string }
        Returns: { household_id?: string; name?: string; error?: string }
      }
      get_household_balance: {
        Args: { p_household_id: string; p_user_id: string }
        Returns: { you_are_owed: number; you_owe: number; net: number }
      }
      create_receipt_with_items: {
        Args: {
          p_household_id: string
          p_store_name: string
          p_receipt_date: string
          p_raw_text: string | null
          p_total_amount: number
          p_split_mode: string
          p_items: Json
        }
        Returns: string
      }
    }
  }
}

// Convenience row types
export type Household = Database['public']['Tables']['households']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Receipt = Database['public']['Tables']['receipts']['Row']
export type ReceiptItem = Database['public']['Tables']['receipt_items']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type Settlement = Database['public']['Tables']['settlements']['Row']

// Composite types
export type ReceiptWithItems = Receipt & { receipt_items: ReceiptItem[] }
export type ExpenseWithProfiles = Expense & {
  paid_by_profile?: Profile
  split_with_profile?: Profile | null
  loan_to_profile?: Profile | null
}

export type HouseholdBalance = {
  you_are_owed: number
  you_owe: number
  net: number
}

export type ExpenseCategory =
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'utilities'
  | 'rent'
  | 'entertainment'
  | 'health'
  | 'shopping'
  | 'travel'
  | 'other'

export type SplitMode = 'half' | 'per_item' | 'all_me' | 'all_partner'
export type ExpenseType = 'personal' | 'shared' | 'loan'
