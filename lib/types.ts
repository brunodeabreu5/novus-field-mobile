export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cargos: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      charges: {
        Row: {
          amount: number
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string
          vendor_id: string
          vendor_name: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
          vendor_name: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      chat_attachments: {
        Row: {
          attachment_kind: string
          created_at: string
          duration_seconds: number | null
          file_name: string
          file_size_bytes: number | null
          id: string
          message_id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          attachment_kind: string
          created_at?: string
          duration_seconds?: number | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          message_id: string
          mime_type?: string | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          attachment_kind?: string
          created_at?: string
          duration_seconds?: number | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          message_id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      chat_presence: {
        Row: {
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      mobile_push_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          provider: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform: string
          provider?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          provider?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          assigned_vendor_id: string | null
          created_at: string
          created_by: string
          document: string | null
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_vendor_id?: string | null
          created_at?: string
          created_by: string
          document?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_vendor_id?: string | null
          created_at?: string
          created_by?: string
          document?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      geofence_alert_configs: {
        Row: {
          active_days: number[] | null
          active_hours_end: string | null
          active_hours_start: string | null
          alert_on_enter: boolean
          alert_on_exit: boolean
          assigned_vendor_ids: string[] | null
          client_name: string | null
          created_at: string
          created_by: string
          custom_radius_meters: number
          enabled: boolean
          id: string
          notify_manager_ids: string[] | null
          zone_id: string
          zone_name: string
        }
        Insert: {
          active_days?: number[] | null
          active_hours_end?: string | null
          active_hours_start?: string | null
          alert_on_enter?: boolean
          alert_on_exit?: boolean
          assigned_vendor_ids?: string[] | null
          client_name?: string | null
          created_at?: string
          created_by: string
          custom_radius_meters?: number
          enabled?: boolean
          id?: string
          notify_manager_ids?: string[] | null
          zone_id: string
          zone_name: string
        }
        Update: {
          active_days?: number[] | null
          active_hours_end?: string | null
          active_hours_start?: string | null
          alert_on_enter?: boolean
          alert_on_exit?: boolean
          assigned_vendor_ids?: string[] | null
          client_name?: string | null
          created_at?: string
          created_by?: string
          custom_radius_meters?: number
          enabled?: boolean
          id?: string
          notify_manager_ids?: string[] | null
          zone_id?: string
          zone_name?: string
        }
        Relationships: []
      }
      geofence_alerts: {
        Row: {
          accuracy_meters: number
          alert_type: string
          client_name: string | null
          created_at: string
          distance_meters: number
          effective_radius_meters: number
          id: string
          latitude: number
          longitude: number
          user_id: string
          zone_id: string
          zone_name: string
        }
        Insert: {
          accuracy_meters: number
          alert_type: string
          client_name?: string | null
          created_at?: string
          distance_meters: number
          effective_radius_meters: number
          id?: string
          latitude: number
          longitude: number
          user_id: string
          zone_id: string
          zone_name: string
        }
        Update: {
          accuracy_meters?: number
          alert_type?: string
          client_name?: string | null
          created_at?: string
          distance_meters?: number
          effective_radius_meters?: number
          id?: string
          latitude?: number
          longitude?: number
          user_id?: string
          zone_id?: string
          zone_name?: string
        }
        Relationships: []
      }
      manager_notifications: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          read: boolean
          recipient_id: string
          vendor_id: string
          vendor_name: string
          zone_id: string
          zone_name: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          read?: boolean
          recipient_id: string
          vendor_id: string
          vendor_name: string
          zone_id: string
          zone_name: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          recipient_id?: string
          vendor_id?: string
          vendor_name?: string
          zone_id?: string
          zone_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          document: string | null
          full_name: string | null
          id: string
          phone: string | null
          role_title: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          document?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role_title?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          document?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role_title?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          allowed: boolean
          id: string
          page_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string
        }
        Insert: {
          allowed?: boolean
          id?: string
          page_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by: string
        }
        Update: {
          allowed?: boolean
          id?: string
          page_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_positions: {
        Row: {
          accuracy_meters: number | null
          created_at: string
          heading: number | null
          id: string
          idle_duration_seconds: number | null
          is_idle: boolean | null
          latitude: number
          longitude: number
          recorded_at: string
          speed_kmh: number | null
          vendor_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          idle_duration_seconds?: number | null
          is_idle?: boolean | null
          latitude: number
          longitude: number
          recorded_at?: string
          speed_kmh?: number | null
          vendor_id: string
        }
        Update: {
          accuracy_meters?: number | null
          created_at?: string
          heading?: number | null
          id?: string
          idle_duration_seconds?: number | null
          is_idle?: boolean | null
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed_kmh?: number | null
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_tracking_status: {
        Row: {
          last_error: string | null
          last_heartbeat_at: string
          last_position_at: string | null
          tracking_mode: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          last_error?: string | null
          last_heartbeat_at?: string
          last_position_at?: string | null
          tracking_mode?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          last_error?: string | null
          last_heartbeat_at?: string
          last_position_at?: string | null
          tracking_mode?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      visit_settings: {
        Row: {
          count_from_minutes: number
          exclude_under_minutes: number | null
          id: string
          min_duration_minutes: number
          overtime_threshold_minutes: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          count_from_minutes?: number
          exclude_under_minutes?: number | null
          id?: string
          min_duration_minutes?: number
          overtime_threshold_minutes?: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          count_from_minutes?: number
          exclude_under_minutes?: number | null
          id?: string
          min_duration_minutes?: number
          overtime_threshold_minutes?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      visit_type_options: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      visits: {
        Row: {
          auto_checked_in: boolean | null
          check_in_at: string
          check_in_lat: number | null
          check_in_lng: number | null
          check_out_at: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          client_id: string | null
          client_name: string
          created_at: string
          id: string
          notes: string | null
          photos_count: number | null
          vendor_id: string
          vendor_name: string
          visit_type: string
        }
        Insert: {
          auto_checked_in?: boolean | null
          check_in_at?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          client_id?: string | null
          client_name: string
          created_at?: string
          id?: string
          notes?: string | null
          photos_count?: number | null
          vendor_id: string
          vendor_name: string
          visit_type?: string
        }
        Update: {
          auto_checked_in?: boolean | null
          check_in_at?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          client_id?: string | null
          client_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          photos_count?: number | null
          vendor_id?: string
          vendor_name?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "vendor"
      visit_type:
        | "venda"
        | "cobranca"
        | "prospeccao"
        | "atendimento"
        | "visita_comercial"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "vendor"],
      visit_type: [
        "venda",
        "cobranca",
        "prospeccao",
        "atendimento",
        "visita_comercial",
      ],
    },
  },
} as const
