
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "book_places": {
                  Row: {
                    "book_id": string,"created_at": string | null,"created_by": string | null,"id": string,"place_id": string,"source": Database["public"]['Enums']["location_source"],"status": Database["public"]['Enums']["link_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"created_at"?: string | null,"created_by"?: string | null,"id"?: string,"place_id": string,"source": Database["public"]['Enums']["location_source"],"status"?: Database["public"]['Enums']["link_status"]
                  }
                  Update: {
                    "book_id"?: string,"created_at"?: string | null,"created_by"?: string | null,"id"?: string,"place_id"?: string,"source"?: Database["public"]['Enums']["location_source"],"status"?: Database["public"]['Enums']["link_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "book_places_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_places_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "book_places_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"books": {
                  Row: {
                    "authors": (string)[],"cover_id": number | null,"created_at": string | null,"description": string | null,"first_publish_year": number | null,"id": string,"ol_work_id": string | null,"setting_checked_at": string | null,"title": string,"wikidata_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "authors"?: (string)[],"cover_id"?: number | null,"created_at"?: string | null,"description"?: string | null,"first_publish_year"?: number | null,"id"?: string,"ol_work_id"?: string | null,"setting_checked_at"?: string | null,"title": string,"wikidata_id"?: string | null
                  }
                  Update: {
                    "authors"?: (string)[],"cover_id"?: number | null,"created_at"?: string | null,"description"?: string | null,"first_publish_year"?: number | null,"id"?: string,"ol_work_id"?: string | null,"setting_checked_at"?: string | null,"title"?: string,"wikidata_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"places": {
                  Row: {
                    "country_code": string | null,"created_at": string | null,"geom": unknown,"id": string,"name": string,"osm_id": string | null,"precision": Database["public"]['Enums']["location_precision"],"wikidata_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "country_code"?: string | null,"created_at"?: string | null,"geom"?: unknown,"id"?: string,"name": string,"osm_id"?: string | null,"precision": Database["public"]['Enums']["location_precision"],"wikidata_id"?: string | null
                  }
                  Update: {
                    "country_code"?: string | null,"created_at"?: string | null,"geom"?: unknown,"id"?: string,"name"?: string,"osm_id"?: string | null,"precision"?: Database["public"]['Enums']["location_precision"],"wikidata_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string | null,"display_name": string | null,"id": string,"is_admin": boolean,"is_public": boolean,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"display_name"?: string | null,"id": string,"is_admin"?: boolean,"is_public"?: boolean,"username": string
                  }
                  Update: {
                    "created_at"?: string | null,"display_name"?: string | null,"id"?: string,"is_admin"?: boolean,"is_public"?: boolean,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shelf_entries": {
                  Row: {
                    "book_id": string,"created_at": string | null,"finished_on": string | null,"id": string,"rating": number | null,"status": Database["public"]['Enums']["shelf_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "book_id": string,"created_at"?: string | null,"finished_on"?: string | null,"id"?: string,"rating"?: number | null,"status"?: Database["public"]['Enums']["shelf_status"],"user_id": string
                  }
                  Update: {
                    "book_id"?: string,"created_at"?: string | null,"finished_on"?: string | null,"id"?: string,"rating"?: number | null,"status"?: Database["public"]['Enums']["shelf_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shelf_entries_book_id_fkey"
      columns: ["book_id"]
isOneToOne: false
      referencedRelation: "books"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shelf_entries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "book_place_coords":
{ Args: { "p_book_ids": (string)[] }; Returns: {
              "book_id": string,"country_code": string,"lat": number,"lng": number,"name": string,"place_id": string,"precision": Database["public"]['Enums']["location_precision"],"source": Database["public"]['Enums']["location_source"]
            }[]
                           },
"books_at_place":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_place_id": string }; Returns: {
              "authors": (string)[],"cover_id": number,"first_publish_year": number,"id": string,"ol_work_id": string,"title": string,"total": number
            }[]
                           },
"books_in_country":
{ Args: { "p_country_code": string,"p_limit"?: number,"p_offset"?: number }; Returns: {
              "authors": (string)[],"cover_id": number,"first_publish_year": number,"id": string,"ol_work_id": string,"title": string,"total": number
            }[]
                           },
"explore_places":
{ Args: { "max_features"?: number,"max_lat": number,"max_lng": number,"min_lat": number,"min_lng": number }; Returns: {
              "book_count": number,"country_code": string,"lat": number,"lng": number,"name": string,"place_id": string
            }[]
                           },
"place_detail":
{ Args: { "p_place_id": string }; Returns: {
              "country_code": string,"id": string,"lat": number,"lng": number,"name": string,"precision": Database["public"]['Enums']["location_precision"],"wikidata_id": string
            }[]
                           },
"search_places":
{ Args: { "max_results"?: number,"q": string }; Returns: {
              "book_count": number,"country_code": string,"lat": number,"lng": number,"name": string,"place_id": string,"precision": Database["public"]['Enums']["location_precision"]
            }[]
                           }
          }
          Enums: {
            "link_status": "approved"|"pending"|"rejected","location_precision": "point"|"city"|"region"|"country"|"fictional","location_source": "wikidata"|"user"|"admin","shelf_status": "read"|"reading"|"want"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "link_status": ["approved", "pending", "rejected"],"location_precision": ["point", "city", "region", "country", "fictional"],"location_source": ["wikidata", "user", "admin"],"shelf_status": ["read", "reading", "want"]
          }
        }
} as const
