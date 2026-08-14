export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          name: string
          photo_url: string | null
          calorie_goal: number | null
          privacy_default: 'public' | 'private'
          streak_count: number
          streak_last_log_date: string | null
          reminder_time: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          name: string
          photo_url?: string | null
          calorie_goal?: number | null
          privacy_default?: 'public' | 'private'
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          recipient_id: string
          status: 'pending' | 'accepted'
          created_at: string
        }
        Insert: {
          requester_id: string
          recipient_id: string
        }
        Update: {
          status?: 'pending' | 'accepted'
        }
      }
      logs: {
        Row: {
          id: string
          user_id: string
          photo_url: string | null
          description: string | null
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          visibility: 'public' | 'private'
          calories_estimate: number | null
          calories_final: number | null
          protein_estimate_g: number | null
          protein_final_g: number | null
          carbs_estimate_g: number | null
          carbs_final_g: number | null
          fat_estimate_g: number | null
          fat_final_g: number | null
          ai_confidence: 'low' | 'medium' | 'high' | null
          ai_raw_response: unknown
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['logs']['Row']> & {
          user_id: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          visibility: 'public' | 'private'
        }
        Update: Partial<Database['public']['Tables']['logs']['Row']>
      }
      rewards: {
        Row: {
          id: string
          partner_name: string
          offer_description: string
          milestone_required: number
          expiry_date: string | null
        }
        Insert: never
        Update: never
      }
      redemptions: {
        Row: {
          id: string
          user_id: string
          reward_id: string
          code: string
          status: 'unredeemed' | 'redeemed' | 'expired'
          redeemed_at: string
        }
        Insert: {
          user_id: string
          reward_id: string
          code: string
        }
        Update: never
      }
    }
  }
}
