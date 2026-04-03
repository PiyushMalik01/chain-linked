/**
 * Supabase Database Types
 * @description Auto-generated TypeScript types for the Supabase PostgreSQL schema.
 * Regenerate with: npx supabase gen types typescript --project-id baurjucvzdboavbcuxjh
 * @module types/database
 */

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
      daily_account_snapshots: {
        Row: {
          id: string
          user_id: string
          date: string
          total_impressions: number
          total_reactions: number
          total_comments: number
          total_reposts: number
          total_saves: number
          total_sends: number
          total_engagements: number
          followers: number
          connections: number
          profile_views: number
          search_appearances: number
          post_count: number
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          total_impressions?: number
          total_reactions?: number
          total_comments?: number
          total_reposts?: number
          total_saves?: number
          total_sends?: number
          total_engagements?: number
          followers?: number
          connections?: number
          profile_views?: number
          search_appearances?: number
          post_count?: number
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          total_impressions?: number
          total_reactions?: number
          total_comments?: number
          total_reposts?: number
          total_saves?: number
          total_sends?: number
          total_engagements?: number
          followers?: number
          connections?: number
          profile_views?: number
          search_appearances?: number
          post_count?: number
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      daily_post_snapshots: {
        Row: {
          id: string
          user_id: string
          activity_urn: string
          date: string
          impressions: number
          reactions: number
          comments: number
          reposts: number
          saves: number
          sends: number
          engagements: number
          media_type: string | null
          posted_at: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          activity_urn: string
          date: string
          impressions?: number
          reactions?: number
          comments?: number
          reposts?: number
          saves?: number
          sends?: number
          engagements?: number
          media_type?: string | null
          posted_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          activity_urn?: string
          date?: string
          impressions?: number
          reactions?: number
          comments?: number
          reposts?: number
          saves?: number
          sends?: number
          engagements?: number
          media_type?: string | null
          posted_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      analytics_history: {
        Row: {
          created_at: string | null
          date: string
          engagements: number | null
          followers: number | null
          id: string
          impressions: number | null
          members_reached: number | null
          profile_views: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          engagements?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          members_reached?: number | null
          profile_views?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          engagements?: number | null
          followers?: number | null
          id?: string
          impressions?: number | null
          members_reached?: number | null
          profile_views?: number | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_summary_cache: {
        Row: {
          accumulative_total: number | null
          comp_avg: number
          comp_count: number
          comp_total: number
          computed_at: string
          created_at: string
          current_avg: number
          current_count: number
          current_total: number
          id: string
          metric: string
          metric_type: string
          pct_change: number
          period: string
          timeseries: Json
          user_id: string
        }
        Insert: {
          accumulative_total?: number | null
          comp_avg?: number
          comp_count?: number
          comp_total?: number
          computed_at?: string
          created_at?: string
          current_avg?: number
          current_count?: number
          current_total?: number
          id?: string
          metric: string
          metric_type?: string
          pct_change?: number
          period: string
          timeseries?: Json
          user_id: string
        }
        Update: {
          accumulative_total?: number | null
          comp_avg?: number
          comp_count?: number
          comp_total?: number
          computed_at?: string
          created_at?: string
          current_avg?: number
          current_count?: number
          current_total?: number
          id?: string
          metric?: string
          metric_type?: string
          pct_change?: number
          period?: string
          timeseries?: Json
          user_id?: string
        }
        Relationships: []
      }
      analytics_tracking_status: {
        Row: {
          id: number
          status: string
        }
        Insert: {
          id: number
          status: string
        }
        Update: {
          id?: number
          status?: string
        }
        Relationships: []
      }
      audience_data: {
        Row: {
          captured_at: string | null
          demographics_preview: Json | null
          follower_growth: number | null
          id: string
          raw_data: Json | null
          top_companies: Json | null
          top_industries: Json | null
          top_job_titles: Json | null
          top_locations: Json | null
          total_followers: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          captured_at?: string | null
          demographics_preview?: Json | null
          follower_growth?: number | null
          id?: string
          raw_data?: Json | null
          top_companies?: Json | null
          top_industries?: Json | null
          top_job_titles?: Json | null
          top_locations?: Json | null
          total_followers?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          captured_at?: string | null
          demographics_preview?: Json | null
          follower_growth?: number | null
          id?: string
          raw_data?: Json | null
          top_companies?: Json | null
          top_industries?: Json | null
          top_job_titles?: Json | null
          top_locations?: Json | null
          total_followers?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audience_history: {
        Row: {
          created_at: string | null
          date: string
          id: string
          new_followers: number | null
          total_followers: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          new_followers?: number | null
          total_followers?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          new_followers?: number | null
          total_followers?: number | null
          user_id?: string
        }
        Relationships: []
      }
      brand_kits: {
        Row: {
          accent_color: string | null
          background_color: string | null
          created_at: string | null
          font_primary: string | null
          font_secondary: string | null
          id: string
          is_active: boolean | null
          logo_storage_path: string | null
          logo_url: string | null
          primary_color: string
          raw_extraction: Json | null
          secondary_color: string | null
          team_id: string | null
          text_color: string | null
          updated_at: string | null
          user_id: string
          website_url: string
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string | null
          font_primary?: string | null
          font_secondary?: string | null
          id?: string
          is_active?: boolean | null
          logo_storage_path?: string | null
          logo_url?: string | null
          primary_color: string
          raw_extraction?: Json | null
          secondary_color?: string | null
          team_id?: string | null
          text_color?: string | null
          updated_at?: string | null
          user_id: string
          website_url: string
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          created_at?: string | null
          font_primary?: string | null
          font_secondary?: string | null
          id?: string
          is_active?: boolean | null
          logo_storage_path?: string | null
          logo_url?: string | null
          primary_color?: string
          raw_extraction?: Json | null
          secondary_color?: string | null
          team_id?: string | null
          text_color?: string | null
          updated_at?: string | null
          user_id?: string
          website_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_kits_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_stats: {
        Row: {
          analytics_captures: number | null
          api_calls_captured: number | null
          created_at: string | null
          date: string
          dom_extractions: number | null
          feed_posts_captured: number | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analytics_captures?: number | null
          api_calls_captured?: number | null
          created_at?: string | null
          date?: string
          dom_extractions?: number | null
          feed_posts_captured?: number | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analytics_captures?: number | null
          api_calls_captured?: number | null
          created_at?: string | null
          date?: string
          dom_extractions?: number | null
          feed_posts_captured?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      captured_apis: {
        Row: {
          captured_at: string | null
          category: string | null
          endpoint: string | null
          id: string
          method: string | null
          response_data: Json | null
          response_hash: string | null
          user_id: string
        }
        Insert: {
          captured_at?: string | null
          category?: string | null
          endpoint?: string | null
          id?: string
          method?: string | null
          response_data?: Json | null
          response_hash?: string | null
          user_id: string
        }
        Update: {
          captured_at?: string | null
          category?: string | null
          endpoint?: string | null
          id?: string
          method?: string | null
          response_data?: Json | null
          response_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      carousel_templates: {
        Row: {
          brand_colors: Json | null
          category: string
          created_at: string | null
          description: string | null
          fonts: Json | null
          id: string
          is_public: boolean | null
          name: string
          slides: Json
          team_id: string | null
          thumbnail: string | null
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          brand_colors?: Json | null
          category?: string
          created_at?: string | null
          description?: string | null
          fonts?: Json | null
          id?: string
          is_public?: boolean | null
          name: string
          slides: Json
          team_id?: string | null
          thumbnail?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          brand_colors?: Json | null
          category?: string
          created_at?: string | null
          description?: string | null
          fonts?: Json | null
          id?: string
          is_public?: boolean | null
          name?: string
          slides?: Json
          team_id?: string | null
          thumbnail?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          activity_urn: string | null
          author_headline: string | null
          author_name: string | null
          author_profile_url: string | null
          comment_urn: string | null
          content: string | null
          created_at: string | null
          id: string
          parent_urn: string | null
          posted_at: string | null
          raw_data: Json | null
          reactions: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_urn?: string | null
          author_headline?: string | null
          author_name?: string | null
          author_profile_url?: string | null
          comment_urn?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          parent_urn?: string | null
          posted_at?: string | null
          raw_data?: Json | null
          reactions?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_urn?: string | null
          author_headline?: string | null
          author_name?: string | null
          author_profile_url?: string | null
          comment_urn?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          parent_urn?: string | null
          posted_at?: string | null
          raw_data?: Json | null
          reactions?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          settings: Json | null
          slug: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_context: {
        Row: {
          brand_colors: Json | null
          company_name: string
          company_summary: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          industry: string | null
          inngest_run_id: string | null
          perplexity_research: string | null
          products_and_services: Json | null
          scraped_content: string | null
          status: string | null
          target_audience: Json | null
          target_audience_input: string | null
          tone_of_voice: Json | null
          updated_at: string | null
          user_id: string
          value_proposition: string | null
          website_url: string | null
        }
        Insert: {
          brand_colors?: Json | null
          company_name: string
          company_summary?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          industry?: string | null
          inngest_run_id?: string | null
          perplexity_research?: string | null
          products_and_services?: Json | null
          scraped_content?: string | null
          status?: string | null
          target_audience?: Json | null
          target_audience_input?: string | null
          tone_of_voice?: Json | null
          updated_at?: string | null
          user_id: string
          value_proposition?: string | null
          website_url?: string | null
        }
        Update: {
          brand_colors?: Json | null
          company_name?: string
          company_summary?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          industry?: string | null
          inngest_run_id?: string | null
          perplexity_research?: string | null
          products_and_services?: Json | null
          scraped_content?: string | null
          status?: string | null
          target_audience?: Json | null
          target_audience_input?: string | null
          tone_of_voice?: Json | null
          updated_at?: string | null
          user_id?: string
          value_proposition?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      compose_conversations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          messages: Json
          mode: string
          title: string | null
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          messages?: Json
          mode: string
          title?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          messages?: Json
          mode?: string
          title?: string | null
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          connected_at: string | null
          connection_degree: number | null
          created_at: string | null
          first_name: string | null
          headline: string | null
          id: string
          last_name: string | null
          linkedin_id: string | null
          profile_picture: string | null
          public_identifier: string | null
          raw_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          connection_degree?: number | null
          created_at?: string | null
          first_name?: string | null
          headline?: string | null
          id?: string
          last_name?: string | null
          linkedin_id?: string | null
          profile_picture?: string | null
          public_identifier?: string | null
          raw_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          connected_at?: string | null
          connection_degree?: number | null
          created_at?: string | null
          first_name?: string | null
          headline?: string | null
          id?: string
          last_name?: string | null
          linkedin_id?: string | null
          profile_picture?: string | null
          public_identifier?: string | null
          raw_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_rules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          rule_text: string
          rule_type: string
          team_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_text: string
          rule_type: string
          team_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          rule_text?: string
          rule_type?: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_rules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      discover_news_articles: {
        Row: {
          created_at: string
          freshness: string
          headline: string
          id: string
          ingest_batch_id: string | null
          perplexity_citations: string[] | null
          published_date: string | null
          relevance_tags: string[]
          source_name: string
          source_url: string
          summary: string
          topic: string
        }
        Insert: {
          created_at?: string
          freshness?: string
          headline: string
          id?: string
          ingest_batch_id?: string | null
          perplexity_citations?: string[] | null
          published_date?: string | null
          relevance_tags?: string[]
          source_name: string
          source_url: string
          summary: string
          topic: string
        }
        Update: {
          created_at?: string
          freshness?: string
          headline?: string
          id?: string
          ingest_batch_id?: string | null
          perplexity_citations?: string[] | null
          published_date?: string | null
          relevance_tags?: string[]
          source_name?: string
          source_url?: string
          summary?: string
          topic?: string
        }
        Relationships: []
      }
      discover_posts: {
        Row: {
          author_avatar_url: string | null
          author_headline: string
          author_name: string
          author_profile_url: string | null
          comments_count: number
          content: string
          engagement_rate: number | null
          freshness: string | null
          id: string
          impressions_count: number | null
          ingest_batch_id: string | null
          is_viral: boolean
          likes_count: number
          linkedin_url: string
          post_type: string | null
          posted_at: string
          reposts_count: number
          scraped_at: string
          source: string
          topics: string[]
          tags: string[] | null
          primary_cluster: string | null
          linkedin_post_id: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_headline?: string
          author_name: string
          author_profile_url?: string | null
          comments_count?: number
          content: string
          engagement_rate?: number | null
          freshness?: string | null
          id?: string
          impressions_count?: number | null
          ingest_batch_id?: string | null
          is_viral?: boolean
          likes_count?: number
          linkedin_url: string
          post_type?: string | null
          posted_at: string
          reposts_count?: number
          scraped_at?: string
          source?: string
          topics?: string[]
          tags?: string[] | null
          primary_cluster?: string | null
          linkedin_post_id?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_headline?: string
          author_name?: string
          author_profile_url?: string | null
          comments_count?: number
          content?: string
          engagement_rate?: number | null
          freshness?: string | null
          id?: string
          impressions_count?: number | null
          ingest_batch_id?: string | null
          is_viral?: boolean
          likes_count?: number
          linkedin_url?: string
          post_type?: string | null
          posted_at?: string
          reposts_count?: number
          scraped_at?: string
          source?: string
          topics?: string[]
          tags?: string[] | null
          primary_cluster?: string | null
          linkedin_post_id?: string | null
        }
        Relationships: []
      }
      extension_settings: {
        Row: {
          auto_capture_enabled: boolean | null
          capture_analytics: boolean | null
          capture_feed: boolean | null
          capture_messaging: boolean | null
          capture_profile: boolean | null
          created_at: string | null
          dark_mode: boolean | null
          id: string
          notifications_enabled: boolean | null
          raw_settings: Json | null
          sync_enabled: boolean | null
          sync_interval: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_capture_enabled?: boolean | null
          capture_analytics?: boolean | null
          capture_feed?: boolean | null
          capture_messaging?: boolean | null
          capture_profile?: boolean | null
          created_at?: string | null
          dark_mode?: boolean | null
          id?: string
          notifications_enabled?: boolean | null
          raw_settings?: Json | null
          sync_enabled?: boolean | null
          sync_interval?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_capture_enabled?: boolean | null
          capture_analytics?: boolean | null
          capture_feed?: boolean | null
          capture_messaging?: boolean | null
          capture_profile?: boolean | null
          created_at?: string | null
          dark_mode?: boolean | null
          id?: string
          notifications_enabled?: boolean | null
          raw_settings?: Json | null
          sync_enabled?: boolean | null
          sync_interval?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feed_posts: {
        Row: {
          activity_urn: string
          author_headline: string | null
          author_name: string | null
          author_profile_url: string | null
          author_urn: string | null
          comments: number | null
          content: string | null
          created_at: string | null
          engagement_score: number | null
          hashtags: Json | null
          id: string
          media_type: string | null
          media_urls: string[] | null
          posted_at: string | null
          raw_data: Json | null
          reactions: number | null
          reposts: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_urn: string
          author_headline?: string | null
          author_name?: string | null
          author_profile_url?: string | null
          author_urn?: string | null
          comments?: number | null
          content?: string | null
          created_at?: string | null
          engagement_score?: number | null
          hashtags?: Json | null
          id?: string
          media_type?: string | null
          media_urls?: string[] | null
          posted_at?: string | null
          raw_data?: Json | null
          reactions?: number | null
          reposts?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_urn?: string
          author_headline?: string | null
          author_name?: string | null
          author_profile_url?: string | null
          author_urn?: string | null
          comments?: number | null
          content?: string | null
          created_at?: string | null
          engagement_score?: number | null
          hashtags?: Json | null
          id?: string
          media_type?: string | null
          media_urls?: string[] | null
          posted_at?: string | null
          raw_data?: Json | null
          reactions?: number | null
          reposts?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      followed_influencers: {
        Row: {
          author_headline: string | null
          author_name: string | null
          author_profile_picture: string | null
          created_at: string | null
          id: string
          last_scraped_at: string | null
          linkedin_url: string
          linkedin_username: string | null
          posts_count: number | null
          status: string
          updated_at: string | null
          user_id: string
          last_seen_at: string | null
        }
        Insert: {
          author_headline?: string | null
          author_name?: string | null
          author_profile_picture?: string | null
          created_at?: string | null
          id?: string
          last_scraped_at?: string | null
          last_seen_at?: string | null
          linkedin_url: string
          linkedin_username?: string | null
          posts_count?: number | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          author_headline?: string | null
          author_name?: string | null
          author_profile_picture?: string | null
          created_at?: string | null
          id?: string
          last_scraped_at?: string | null
          last_seen_at?: string | null
          linkedin_url?: string
          linkedin_username?: string | null
          posts_count?: number | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string | null
          first_name: string | null
          followed_at: string | null
          headline: string | null
          id: string
          last_name: string | null
          linkedin_id: string | null
          profile_picture: string | null
          public_identifier: string | null
          raw_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          followed_at?: string | null
          headline?: string | null
          id?: string
          last_name?: string | null
          linkedin_id?: string | null
          profile_picture?: string | null
          public_identifier?: string | null
          raw_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          followed_at?: string | null
          headline?: string | null
          id?: string
          last_name?: string | null
          linkedin_id?: string | null
          profile_picture?: string | null
          public_identifier?: string | null
          raw_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      generated_posts: {
        Row: {
          completion_tokens: number | null
          content: string
          conversation_id: string | null
          created_at: string
          cta: string | null
          discover_post_id: string | null
          estimated_cost: number | null
          estimated_read_time: number | null
          hook: string | null
          id: string
          model: string | null
          post_type: string
          prompt_snapshot: Json | null
          prompt_tokens: number | null
          research_session_id: string | null
          source: string | null
          source_snippet: string | null
          source_title: string | null
          source_url: string | null
          status: string
          total_tokens: number | null
          updated_at: string
          user_id: string
          word_count: number | null
          draft_state: Json | null
        }
        Insert: {
          completion_tokens?: number | null
          content: string
          conversation_id?: string | null
          created_at?: string
          cta?: string | null
          discover_post_id?: string | null
          estimated_cost?: number | null
          estimated_read_time?: number | null
          hook?: string | null
          id?: string
          model?: string | null
          post_type: string
          prompt_snapshot?: Json | null
          prompt_tokens?: number | null
          research_session_id?: string | null
          source?: string | null
          source_snippet?: string | null
          source_title?: string | null
          source_url?: string | null
          status?: string
          total_tokens?: number | null
          updated_at?: string
          user_id: string
          word_count?: number | null
          draft_state?: Json | null
        }
        Update: {
          completion_tokens?: number | null
          content?: string
          conversation_id?: string | null
          created_at?: string
          cta?: string | null
          discover_post_id?: string | null
          estimated_cost?: number | null
          estimated_read_time?: number | null
          hook?: string | null
          id?: string
          model?: string | null
          post_type?: string
          prompt_snapshot?: Json | null
          prompt_tokens?: number | null
          research_session_id?: string | null
          source?: string | null
          source_snippet?: string | null
          source_title?: string | null
          source_url?: string | null
          status?: string
          total_tokens?: number | null
          updated_at?: string
          user_id?: string
          word_count?: number | null
          draft_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_posts_discover_post_id_fkey"
            columns: ["discover_post_id"]
            isOneToOne: false
            referencedRelation: "discover_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_posts_research_session_id_fkey"
            columns: ["research_session_id"]
            isOneToOne: false
            referencedRelation: "research_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_suggestions: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          estimated_engagement: number | null
          expires_at: string | null
          generation_batch_id: string | null
          id: string
          post_type: string | null
          prompt_context: Json | null
          status: string | null
          tone: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          estimated_engagement?: number | null
          expires_at?: string | null
          generation_batch_id?: string | null
          id?: string
          post_type?: string | null
          prompt_context?: Json | null
          status?: string | null
          tone?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          estimated_engagement?: number | null
          expires_at?: string | null
          generation_batch_id?: string | null
          id?: string
          post_type?: string | null
          prompt_context?: Json | null
          status?: string | null
          tone?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      influencer_posts: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string | null
          id: string
          influencer_id: string
          likes_count: number | null
          linkedin_url: string | null
          post_type: string | null
          posted_at: string | null
          quality_score: number | null
          quality_status: string | null
          raw_data: Json | null
          rejection_reason: string | null
          reposts_count: number | null
          scraped_at: string | null
          tags: string[] | null
          primary_cluster: string | null
          linkedin_post_id: string | null
          user_id: string
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string | null
          id?: string
          influencer_id: string
          likes_count?: number | null
          linkedin_post_id?: string | null
          linkedin_url?: string | null
          post_type?: string | null
          posted_at?: string | null
          primary_cluster?: string | null
          quality_score?: number | null
          quality_status?: string | null
          raw_data?: Json | null
          rejection_reason?: string | null
          reposts_count?: number | null
          scraped_at?: string | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string | null
          id?: string
          influencer_id?: string
          likes_count?: number | null
          linkedin_post_id?: string | null
          linkedin_url?: string | null
          post_type?: string | null
          posted_at?: string | null
          primary_cluster?: string | null
          quality_score?: number | null
          quality_status?: string | null
          raw_data?: Json | null
          rejection_reason?: string | null
          reposts_count?: number | null
          scraped_at?: string | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_posts_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "followed_influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      inspiration_posts: {
        Row: {
          author_avatar_url: string | null
          author_headline: string | null
          author_name: string | null
          author_profile_url: string | null
          category: string | null
          comments: number | null
          content: string
          created_at: string | null
          engagement_score: number | null
          id: string
          niche: string | null
          posted_at: string | null
          reactions: number | null
          reposts: number | null
          source: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_headline?: string | null
          author_name?: string | null
          author_profile_url?: string | null
          category?: string | null
          comments?: number | null
          content: string
          created_at?: string | null
          engagement_score?: number | null
          id?: string
          niche?: string | null
          posted_at?: string | null
          reactions?: number | null
          reposts?: number | null
          source?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_headline?: string | null
          author_name?: string | null
          author_profile_url?: string | null
          category?: string | null
          comments?: number | null
          content?: string
          created_at?: string | null
          engagement_score?: number | null
          id?: string
          niche?: string | null
          posted_at?: string | null
          reactions?: number | null
          reposts?: number | null
          source?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          actor_headline: string | null
          actor_name: string | null
          actor_profile_picture: string | null
          actor_profile_url: string | null
          created_at: string | null
          direction: string | null
          id: string
          invitation_type: string | null
          invitation_urn: string | null
          message: string | null
          raw_data: Json | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actor_headline?: string | null
          actor_name?: string | null
          actor_profile_picture?: string | null
          actor_profile_url?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          invitation_type?: string | null
          invitation_urn?: string | null
          message?: string | null
          raw_data?: Json | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actor_headline?: string | null
          actor_name?: string | null
          actor_profile_picture?: string | null
          actor_profile_url?: string | null
          created_at?: string | null
          direction?: string | null
          id?: string
          invitation_type?: string | null
          invitation_urn?: string | null
          message?: string | null
          raw_data?: Json | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      linkedin_analytics: {
        Row: {
          captured_at: string | null
          engagements: number | null
          id: string
          impressions: number | null
          members_reached: number | null
          new_followers: number | null
          page_type: string
          profile_views: number | null
          raw_data: Json | null
          search_appearances: number | null
          top_posts: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          captured_at?: string | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          members_reached?: number | null
          new_followers?: number | null
          page_type: string
          profile_views?: number | null
          raw_data?: Json | null
          search_appearances?: number | null
          top_posts?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          captured_at?: string | null
          engagements?: number | null
          id?: string
          impressions?: number | null
          members_reached?: number | null
          new_followers?: number | null
          page_type?: string
          profile_views?: number | null
          raw_data?: Json | null
          search_appearances?: number | null
          top_posts?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      linkedin_credentials: {
        Row: {
          cookies_set_at: string | null
          created_at: string | null
          csrf_token: string | null
          expires_at: string | null
          id: string
          is_valid: boolean | null
          jsessionid: string
          last_used_at: string | null
          li_at: string
          liap: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          cookies_set_at?: string | null
          created_at?: string | null
          csrf_token?: string | null
          expires_at?: string | null
          id?: string
          is_valid?: boolean | null
          jsessionid: string
          last_used_at?: string | null
          li_at: string
          liap?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          cookies_set_at?: string | null
          created_at?: string | null
          csrf_token?: string | null
          expires_at?: string | null
          id?: string
          is_valid?: boolean | null
          jsessionid?: string
          last_used_at?: string | null
          li_at?: string
          liap?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      linkedin_profiles: {
        Row: {
          background_image_url: string | null
          captured_at: string | null
          connections_count: number | null
          first_name: string | null
          followers_count: number | null
          headline: string | null
          id: string
          industry: string | null
          last_name: string | null
          location: string | null
          profile_picture_url: string | null
          profile_urn: string | null
          public_identifier: string | null
          raw_data: Json | null
          summary: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          background_image_url?: string | null
          captured_at?: string | null
          connections_count?: number | null
          first_name?: string | null
          followers_count?: number | null
          headline?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          location?: string | null
          profile_picture_url?: string | null
          profile_urn?: string | null
          public_identifier?: string | null
          raw_data?: Json | null
          summary?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          background_image_url?: string | null
          captured_at?: string | null
          connections_count?: number | null
          first_name?: string | null
          followers_count?: number | null
          headline?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          location?: string | null
          profile_picture_url?: string | null
          profile_urn?: string | null
          public_identifier?: string | null
          raw_data?: Json | null
          summary?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      linkedin_research_posts: {
        Row: {
          activity_urn: string | null
          author_first_name: string | null
          author_headline: string | null
          author_last_name: string | null
          author_profile_picture: string | null
          author_profile_url: string | null
          author_username: string | null
          celebrates: number | null
          comments: number | null
          created_at: string | null
          full_urn: string | null
          funny: number | null
          id: string
          insights: number | null
          likes: number | null
          loves: number | null
          media_images: Json | null
          media_type: string | null
          media_url: string | null
          post_type: string | null
          posted_date: string | null
          posted_relative: string | null
          posted_timestamp: number | null
          profile_input: string | null
          raw_data: Json | null
          reposts: number | null
          share_urn: string | null
          supports: number | null
          text: string | null
          total_reactions: number | null
          ugc_post_urn: string | null
          url: string | null
        }
        Insert: {
          activity_urn?: string | null
          author_first_name?: string | null
          author_headline?: string | null
          author_last_name?: string | null
          author_profile_picture?: string | null
          author_profile_url?: string | null
          author_username?: string | null
          celebrates?: number | null
          comments?: number | null
          created_at?: string | null
          full_urn?: string | null
          funny?: number | null
          id?: string
          insights?: number | null
          likes?: number | null
          loves?: number | null
          media_images?: Json | null
          media_type?: string | null
          media_url?: string | null
          post_type?: string | null
          posted_date?: string | null
          posted_relative?: string | null
          posted_timestamp?: number | null
          profile_input?: string | null
          raw_data?: Json | null
          reposts?: number | null
          share_urn?: string | null
          supports?: number | null
          text?: string | null
          total_reactions?: number | null
          ugc_post_urn?: string | null
          url?: string | null
        }
        Update: {
          activity_urn?: string | null
          author_first_name?: string | null
          author_headline?: string | null
          author_last_name?: string | null
          author_profile_picture?: string | null
          author_profile_url?: string | null
          author_username?: string | null
          celebrates?: number | null
          comments?: number | null
          created_at?: string | null
          full_urn?: string | null
          funny?: number | null
          id?: string
          insights?: number | null
          likes?: number | null
          loves?: number | null
          media_images?: Json | null
          media_type?: string | null
          media_url?: string | null
          post_type?: string | null
          posted_date?: string | null
          posted_relative?: string | null
          posted_timestamp?: number | null
          profile_input?: string | null
          raw_data?: Json | null
          reposts?: number | null
          share_urn?: string | null
          supports?: number | null
          text?: string | null
          total_reactions?: number | null
          ugc_post_urn?: string | null
          url?: string | null
        }
        Relationships: []
      }
      linkedin_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          linkedin_urn: string | null
          refresh_token: string | null
          scopes: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          linkedin_urn?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          linkedin_urn?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      my_posts: {
        Row: {
          activity_urn: string
          comments: number | null
          content: string | null
          created_at: string | null
          engagement_rate: number | null
          id: string
          impressions: number | null
          media_type: string | null
          media_urls: string[] | null
          posted_at: string | null
          raw_data: Json | null
          reactions: number | null
          reposts: number | null
          saves: number | null
          sends: number | null
          source: string
          unique_views: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_urn: string
          comments?: number | null
          content?: string | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          media_type?: string | null
          media_urls?: string[] | null
          posted_at?: string | null
          raw_data?: Json | null
          reactions?: number | null
          reposts?: number | null
          saves?: number | null
          sends?: number | null
          source?: string
          unique_views?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_urn?: string
          comments?: number | null
          content?: string | null
          created_at?: string | null
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          media_type?: string | null
          media_urls?: string[] | null
          posted_at?: string | null
          raw_data?: Json | null
          reactions?: number | null
          reposts?: number | null
          saves?: number | null
          sends?: number | null
          source?: string
          unique_views?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      network_data: {
        Row: {
          created_at: string | null
          data_type: string | null
          entity_urn: string | null
          id: string
          person_headline: string | null
          person_name: string | null
          person_profile_picture: string | null
          person_profile_url: string | null
          public_identifier: string | null
          raw_data: Json | null
          suggestion_reason: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_type?: string | null
          entity_urn?: string | null
          id?: string
          person_headline?: string | null
          person_name?: string | null
          person_profile_picture?: string | null
          person_profile_url?: string | null
          public_identifier?: string | null
          raw_data?: Json | null
          suggestion_reason?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_type?: string | null
          entity_urn?: string | null
          id?: string
          person_headline?: string | null
          person_name?: string | null
          person_profile_picture?: string | null
          person_profile_url?: string | null
          public_identifier?: string | null
          raw_data?: Json | null
          suggestion_reason?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_headline: string | null
          actor_name: string | null
          actor_profile_url: string | null
          content: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          notification_type: string | null
          notification_urn: string | null
          raw_data: Json | null
          received_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actor_headline?: string | null
          actor_name?: string | null
          actor_profile_url?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_type?: string | null
          notification_urn?: string | null
          raw_data?: Json | null
          received_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actor_headline?: string | null
          actor_name?: string | null
          actor_profile_url?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_type?: string | null
          notification_urn?: string | null
          raw_data?: Json | null
          received_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      openai_connections: {
        Row: {
          id: string
          user_id: string
          auth_method: string
          api_key: string | null
          access_token: string | null
          refresh_token: string | null
          id_token: string | null
          token_expires_at: string | null
          email: string | null
          account_id: string | null
          plan_type: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          auth_method?: string
          api_key?: string | null
          access_token?: string | null
          refresh_token?: string | null
          id_token?: string | null
          token_expires_at?: string | null
          email?: string | null
          account_id?: string | null
          plan_type?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          auth_method?: string
          api_key?: string | null
          access_token?: string | null
          refresh_token?: string | null
          id_token?: string | null
          token_expires_at?: string | null
          email?: string | null
          account_id?: string | null
          plan_type?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      openai_device_sessions: {
        Row: {
          id: string
          user_id: string
          device_auth_id: string
          user_code: string
          code_verifier: string | null
          verification_url: string
          expires_at: string
          poll_interval: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_auth_id: string
          user_code: string
          code_verifier?: string | null
          verification_url: string
          expires_at: string
          poll_interval?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_auth_id?: string
          user_code?: string
          code_verifier?: string | null
          verification_url?: string
          expires_at?: string
          poll_interval?: number
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      post_analytics: {
        Row: {
          activity_urn: string | null
          captured_at: string | null
          comments: number | null
          demographics: Json | null
          engagement_rate: number | null
          followers_gained: number | null
          id: string
          impressions: number | null
          members_reached: number | null
          post_content: string | null
          post_type: string | null
          posted_at: string | null
          profile_viewers: number | null
          raw_data: Json | null
          reactions: number | null
          reposts: number | null
          saves: number | null
          sends: number | null
          unique_views: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_urn?: string | null
          captured_at?: string | null
          comments?: number | null
          demographics?: Json | null
          engagement_rate?: number | null
          followers_gained?: number | null
          id?: string
          impressions?: number | null
          members_reached?: number | null
          post_content?: string | null
          post_type?: string | null
          posted_at?: string | null
          profile_viewers?: number | null
          raw_data?: Json | null
          reactions?: number | null
          reposts?: number | null
          saves?: number | null
          sends?: number | null
          unique_views?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_urn?: string | null
          captured_at?: string | null
          comments?: number | null
          demographics?: Json | null
          engagement_rate?: number | null
          followers_gained?: number | null
          id?: string
          impressions?: number | null
          members_reached?: number | null
          post_content?: string | null
          post_type?: string | null
          posted_at?: string | null
          profile_viewers?: number | null
          raw_data?: Json | null
          reactions?: number | null
          reposts?: number | null
          saves?: number | null
          sends?: number | null
          unique_views?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      post_analytics_accumulative: {
        Row: {
          analysis_date: string
          analytics_tracking_status_id: number | null
          comments_total: number | null
          engagements_rate: number | null
          engagements_total: number | null
          id: string
          impressions_total: number | null
          post_created_at: string | null
          post_id: string
          post_type: string | null
          reactions_total: number | null
          reposts_total: number | null
          saves_total: number | null
          sends_total: number | null
          unique_reach_total: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_date: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          post_created_at?: string | null
          post_id: string
          post_type?: string | null
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_date?: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          post_created_at?: string | null
          post_id?: string
          post_type?: string | null
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_accumulative_analytics_tracking_status_id_fkey"
            columns: ["analytics_tracking_status_id"]
            isOneToOne: false
            referencedRelation: "analytics_tracking_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_analytics_accumulative_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "my_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_analytics_daily: {
        Row: {
          analysis_date: string
          analytics_tracking_status_id: number | null
          comments_gained: number | null
          created_at: string | null
          engagements_gained: number | null
          engagements_rate: number | null
          id: string
          impressions_gained: number | null
          post_id: string
          post_type: string | null
          reactions_gained: number | null
          reposts_gained: number | null
          saves_gained: number | null
          sends_gained: number | null
          unique_reach_gained: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_date: string
          analytics_tracking_status_id?: number | null
          comments_gained?: number | null
          created_at?: string | null
          engagements_gained?: number | null
          engagements_rate?: number | null
          id?: string
          impressions_gained?: number | null
          post_id: string
          post_type?: string | null
          reactions_gained?: number | null
          reposts_gained?: number | null
          saves_gained?: number | null
          sends_gained?: number | null
          unique_reach_gained?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_date?: string
          analytics_tracking_status_id?: number | null
          comments_gained?: number | null
          created_at?: string | null
          engagements_gained?: number | null
          engagements_rate?: number | null
          id?: string
          impressions_gained?: number | null
          post_id?: string
          post_type?: string | null
          reactions_gained?: number | null
          reposts_gained?: number | null
          saves_gained?: number | null
          sends_gained?: number | null
          unique_reach_gained?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_daily_analytics_tracking_status_id_fkey"
            columns: ["analytics_tracking_status_id"]
            isOneToOne: false
            referencedRelation: "analytics_tracking_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_analytics_daily_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "my_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_analytics_mth: {
        Row: {
          analysis_date: string
          analytics_tracking_status_id: number | null
          comments_total: number | null
          engagements_rate: number | null
          engagements_total: number | null
          id: string
          impressions_total: number | null
          is_finalized: boolean | null
          month_start: string
          post_id: string
          post_type: string | null
          reactions_total: number | null
          reposts_total: number | null
          saves_total: number | null
          sends_total: number | null
          unique_reach_total: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_date: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          is_finalized?: boolean | null
          month_start: string
          post_id: string
          post_type?: string | null
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_date?: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          is_finalized?: boolean | null
          month_start?: string
          post_id?: string
          post_type?: string | null
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_mth_analytics_tracking_status_id_fkey"
            columns: ["analytics_tracking_status_id"]
            isOneToOne: false
            referencedRelation: "analytics_tracking_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_analytics_mth_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "my_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_analytics_qtr: {
        Row: {
          analysis_date: string
          analytics_tracking_status_id: number | null
          comments_total: number | null
          engagements_rate: number | null
          engagements_total: number | null
          id: string
          impressions_total: number | null
          is_finalized: boolean | null
          post_id: string
          post_type: string | null
          quarter_start: string
          reactions_total: number | null
          reposts_total: number | null
          saves_total: number | null
          sends_total: number | null
          unique_reach_total: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_date: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          is_finalized?: boolean | null
          post_id: string
          post_type?: string | null
          quarter_start: string
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_date?: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          is_finalized?: boolean | null
          post_id?: string
          post_type?: string | null
          quarter_start?: string
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_qtr_analytics_tracking_status_id_fkey"
            columns: ["analytics_tracking_status_id"]
            isOneToOne: false
            referencedRelation: "analytics_tracking_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_analytics_qtr_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "my_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_analytics_wk: {
        Row: {
          analysis_date: string
          analytics_tracking_status_id: number | null
          comments_total: number | null
          engagements_rate: number | null
          engagements_total: number | null
          id: string
          impressions_total: number | null
          is_finalized: boolean | null
          post_id: string
          post_type: string | null
          reactions_total: number | null
          reposts_total: number | null
          saves_total: number | null
          sends_total: number | null
          unique_reach_total: number | null
          updated_at: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          analysis_date: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          is_finalized?: boolean | null
          post_id: string
          post_type?: string | null
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          analysis_date?: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          is_finalized?: boolean | null
          post_id?: string
          post_type?: string | null
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_wk_analytics_tracking_status_id_fkey"
            columns: ["analytics_tracking_status_id"]
            isOneToOne: false
            referencedRelation: "analytics_tracking_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_analytics_wk_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "my_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_analytics_yr: {
        Row: {
          analysis_date: string
          analytics_tracking_status_id: number | null
          comments_total: number | null
          engagements_rate: number | null
          engagements_total: number | null
          id: string
          impressions_total: number | null
          is_finalized: boolean | null
          post_id: string
          post_type: string | null
          reactions_total: number | null
          reposts_total: number | null
          saves_total: number | null
          sends_total: number | null
          unique_reach_total: number | null
          updated_at: string | null
          user_id: string
          year_start: string
        }
        Insert: {
          analysis_date: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          is_finalized?: boolean | null
          post_id: string
          post_type?: string | null
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id: string
          year_start: string
        }
        Update: {
          analysis_date?: string
          analytics_tracking_status_id?: number | null
          comments_total?: number | null
          engagements_rate?: number | null
          engagements_total?: number | null
          id?: string
          impressions_total?: number | null
          is_finalized?: boolean | null
          post_id?: string
          post_type?: string | null
          reactions_total?: number | null
          reposts_total?: number | null
          saves_total?: number | null
          sends_total?: number | null
          unique_reach_total?: number | null
          updated_at?: string | null
          user_id?: string
          year_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_analytics_yr_analytics_tracking_status_id_fkey"
            columns: ["analytics_tracking_status_id"]
            isOneToOne: false
            referencedRelation: "analytics_tracking_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_analytics_yr_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "my_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posting_goals: {
        Row: {
          created_at: string | null
          current_posts: number | null
          end_date: string
          id: string
          period: string
          start_date: string
          target_posts: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_posts?: number | null
          end_date: string
          id?: string
          period: string
          start_date: string
          target_posts: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_posts?: number | null
          end_date?: string
          id?: string
          period?: string
          start_date?: string
          target_posts?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profile_analytics_accumulative: {
        Row: {
          analysis_date: string
          connections_total: number | null
          followers_total: number | null
          id: string
          profile_views_total: number | null
          search_appearances_total: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_date: string
          connections_total?: number | null
          followers_total?: number | null
          id?: string
          profile_views_total?: number | null
          search_appearances_total?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_date?: string
          connections_total?: number | null
          followers_total?: number | null
          id?: string
          profile_views_total?: number | null
          search_appearances_total?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profile_analytics_daily: {
        Row: {
          analysis_date: string
          connections_gained: number | null
          created_at: string | null
          followers_gained: number | null
          id: string
          profile_views_gained: number | null
          search_appearances_gained: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_date: string
          connections_gained?: number | null
          created_at?: string | null
          followers_gained?: number | null
          id?: string
          profile_views_gained?: number | null
          search_appearances_gained?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_date?: string
          connections_gained?: number | null
          created_at?: string | null
          followers_gained?: number | null
          id?: string
          profile_views_gained?: number | null
          search_appearances_gained?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_description: string | null
          company_icp: string | null
          company_name: string | null
          company_onboarding_completed: boolean | null
          company_products: string | null
          company_value_props: string | null
          company_website: string | null
          created_at: string | null
          dashboard_tour_completed: boolean | null
          discover_topics: string[] | null
          discover_topics_selected: boolean | null
          email: string | null
          full_name: string | null
          id: string
          linkedin_access_token: string | null
          linkedin_avatar_url: string | null
          linkedin_connected_at: string | null
          linkedin_headline: string | null
          linkedin_profile_url: string | null
          linkedin_token_expires_at: string | null
          linkedin_user_id: string | null
          onboarding_completed: boolean | null
          onboarding_current_step: number | null
          onboarding_type: string | null
          extension_logged_in: boolean
          extension_last_active_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_description?: string | null
          company_icp?: string | null
          company_name?: string | null
          company_onboarding_completed?: boolean | null
          company_products?: string | null
          company_value_props?: string | null
          company_website?: string | null
          created_at?: string | null
          dashboard_tour_completed?: boolean | null
          discover_topics?: string[] | null
          discover_topics_selected?: boolean | null
          email?: string | null
          extension_logged_in?: boolean
          extension_last_active_at?: string | null
          full_name?: string | null
          id: string
          linkedin_access_token?: string | null
          linkedin_avatar_url?: string | null
          linkedin_connected_at?: string | null
          linkedin_headline?: string | null
          linkedin_profile_url?: string | null
          linkedin_token_expires_at?: string | null
          linkedin_user_id?: string | null
          onboarding_completed?: boolean | null
          onboarding_current_step?: number | null
          onboarding_type?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_description?: string | null
          company_icp?: string | null
          company_name?: string | null
          company_onboarding_completed?: boolean | null
          company_products?: string | null
          company_value_props?: string | null
          company_website?: string | null
          created_at?: string | null
          dashboard_tour_completed?: boolean | null
          discover_topics?: string[] | null
          discover_topics_selected?: boolean | null
          email?: string | null
          extension_logged_in?: boolean
          extension_last_active_at?: string | null
          full_name?: string | null
          id?: string
          linkedin_access_token?: string | null
          linkedin_avatar_url?: string | null
          linkedin_connected_at?: string | null
          linkedin_headline?: string | null
          linkedin_profile_url?: string | null
          linkedin_token_expires_at?: string | null
          linkedin_user_id?: string | null
          onboarding_completed?: boolean | null
          onboarding_current_step?: number | null
          onboarding_type?: string | null
        }
        Relationships: []
      }
      prompt_test_results: {
        Row: {
          created_at: string
          estimated_cost: number | null
          id: string
          max_tokens: number | null
          model: string
          notes: string | null
          prompt_id: string | null
          prompt_version: number
          rating: number | null
          response_content: string
          system_prompt: string
          temperature: number | null
          tokens_used: number | null
          user_id: string | null
          user_prompt: string
          variables: Json
        }
        Insert: {
          created_at?: string
          estimated_cost?: number | null
          id?: string
          max_tokens?: number | null
          model: string
          notes?: string | null
          prompt_id?: string | null
          prompt_version: number
          rating?: number | null
          response_content: string
          system_prompt: string
          temperature?: number | null
          tokens_used?: number | null
          user_id?: string | null
          user_prompt: string
          variables?: Json
        }
        Update: {
          created_at?: string
          estimated_cost?: number | null
          id?: string
          max_tokens?: number | null
          model?: string
          notes?: string | null
          prompt_id?: string | null
          prompt_version?: number
          rating?: number | null
          response_content?: string
          system_prompt?: string
          temperature?: number | null
          tokens_used?: number | null
          user_id?: string | null
          user_prompt?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "prompt_test_results_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "system_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          estimated_cost: number | null
          feature: string
          id: string
          input_tokens: number | null
          metadata: Json
          model: string | null
          output_tokens: number | null
          prompt_id: string | null
          prompt_type: Database["public"]["Enums"]["prompt_type"]
          prompt_version: number
          response_time_ms: number | null
          success: boolean
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          estimated_cost?: number | null
          feature: string
          id?: string
          input_tokens?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          prompt_id?: string | null
          prompt_type: Database["public"]["Enums"]["prompt_type"]
          prompt_version: number
          response_time_ms?: number | null
          success?: boolean
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          estimated_cost?: number | null
          feature?: string
          id?: string
          input_tokens?: number | null
          metadata?: Json
          model?: string | null
          output_tokens?: number | null
          prompt_id?: string | null
          prompt_type?: Database["public"]["Enums"]["prompt_type"]
          prompt_version?: number
          response_time_ms?: number | null
          success?: boolean
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_usage_logs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "system_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          change_notes: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          prompt_id: string
          variables: Json
          version: number
        }
        Insert: {
          change_notes?: string | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_id: string
          variables?: Json
          version: number
        }
        Update: {
          change_notes?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prompt_id?: string
          variables?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "system_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          depth: string
          error_message: string | null
          failed_step: string | null
          id: string
          inngest_run_id: string | null
          posts_discovered: number | null
          posts_generated: number | null
          started_at: string | null
          status: string
          topics: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          depth?: string
          error_message?: string | null
          failed_step?: string | null
          id?: string
          inngest_run_id?: string | null
          posts_discovered?: number | null
          posts_generated?: number | null
          started_at?: string | null
          status?: string
          topics: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          depth?: string
          error_message?: string | null
          failed_step?: string | null
          id?: string
          inngest_run_id?: string | null
          posts_discovered?: number | null
          posts_generated?: number | null
          started_at?: string | null
          status?: string
          topics?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_inspirations: {
        Row: {
          created_at: string | null
          id: string
          inspiration_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          inspiration_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          inspiration_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_inspirations_inspiration_post_id_fkey"
            columns: ["inspiration_post_id"]
            isOneToOne: false
            referencedRelation: "linkedin_research_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          activity_urn: string | null
          content: string
          created_at: string
          error_message: string | null
          id: string
          linkedin_post_id: string | null
          media_urls: string[] | null
          posted_at: string | null
          scheduled_for: string
          status: string
          timezone: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          activity_urn?: string | null
          content: string
          created_at?: string
          error_message?: string | null
          id?: string
          linkedin_post_id?: string | null
          media_urls?: string[] | null
          posted_at?: string | null
          scheduled_for: string
          status?: string
          timezone?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          activity_urn?: string | null
          content?: string
          created_at?: string
          error_message?: string | null
          id?: string
          linkedin_post_id?: string | null
          media_urls?: string[] | null
          posted_at?: string | null
          scheduled_for?: string
          status?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      suggestion_generation_runs: {
        Row: {
          company_context_id: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          inngest_run_id: string | null
          post_types_used: string[] | null
          status: string | null
          suggestions_generated: number | null
          suggestions_requested: number | null
          user_id: string
        }
        Insert: {
          company_context_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          inngest_run_id?: string | null
          post_types_used?: string[] | null
          status?: string | null
          suggestions_generated?: number | null
          suggestions_requested?: number | null
          user_id: string
        }
        Update: {
          company_context_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          inngest_run_id?: string | null
          post_types_used?: string[] | null
          status?: string | null
          suggestions_generated?: number | null
          suggestions_requested?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_generation_runs_company_context_id_fkey"
            columns: ["company_context_id"]
            isOneToOne: false
            referencedRelation: "company_context"
            referencedColumns: ["id"]
          },
        ]
      }
      swipe_preferences: {
        Row: {
          action: string
          created_at: string | null
          id: string
          post_id: string | null
          suggestion_content: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          post_id?: string | null
          suggestion_content?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          post_id?: string | null
          suggestion_content?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipe_preferences_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "inspiration_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      swipe_wishlist: {
        Row: {
          category: string | null
          collection_id: string | null
          content: string
          created_at: string | null
          id: string
          is_scheduled: boolean | null
          notes: string | null
          post_type: string | null
          scheduled_post_id: string | null
          status: string | null
          suggestion_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          collection_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_scheduled?: boolean | null
          notes?: string | null
          post_type?: string | null
          scheduled_post_id?: string | null
          status?: string | null
          suggestion_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          collection_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_scheduled?: boolean | null
          notes?: string | null
          post_type?: string | null
          scheduled_post_id?: string | null
          status?: string | null
          suggestion_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipe_wishlist_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "wishlist_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipe_wishlist_scheduled_post_id_fkey"
            columns: ["scheduled_post_id"]
            isOneToOne: false
            referencedRelation: "scheduled_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipe_wishlist_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "generated_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_metadata: {
        Row: {
          created_at: string | null
          id: string
          last_synced_at: string | null
          pending_changes: number | null
          sync_status: string | null
          table_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          pending_changes?: number | null
          sync_status?: string | null
          table_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          pending_changes?: number | null
          sync_status?: string | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          type: Database["public"]["Enums"]["prompt_type"]
          updated_at: string
          updated_by: string | null
          variables: Json
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          type: Database["public"]["Enums"]["prompt_type"]
          updated_at?: string
          updated_by?: string | null
          variables?: Json
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          type?: Database["public"]["Enums"]["prompt_type"]
          updated_at?: string
          updated_by?: string | null
          variables?: Json
          version?: number
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          status: string
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          team_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_join_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          team_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          team_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          team_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string | null
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          company_id: string | null
          created_at: string | null
          discoverable: boolean | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          discoverable?: boolean | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          discoverable?: boolean | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      template_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      template_favorites: {
        Row: {
          created_at: string | null
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          ai_generation_batch_id: string | null
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_ai_generated: boolean | null
          is_public: boolean | null
          name: string
          tags: Json | null
          team_id: string | null
          updated_at: string | null
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          ai_generation_batch_id?: string | null
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          name: string
          tags?: Json | null
          team_id?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          ai_generation_batch_id?: string | null
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean | null
          name?: string
          tags?: Json | null
          team_id?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_api_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string
          id: string
          is_valid: boolean | null
          key_hint: string | null
          last_validated_at: string | null
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          id?: string
          is_valid?: boolean | null
          key_hint?: string | null
          last_validated_at?: string | null
          provider?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          id?: string
          is_valid?: boolean | null
          key_hint?: string | null
          last_validated_at?: string | null
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_niches: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          niche: string
          source: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          niche: string
          source?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          niche?: string
          source?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      viral_source_profiles: {
        Row: {
          category: string | null
          created_at: string | null
          display_name: string | null
          id: string
          linkedin_url: string
          linkedin_username: string | null
          status: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          linkedin_url: string
          linkedin_username?: string | null
          status?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          linkedin_url?: string
          linkedin_username?: string | null
          status?: string | null
        }
        Relationships: []
      }
      wishlist_collections: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          emoji_icon: string | null
          id: string
          is_default: boolean | null
          item_count: number | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          emoji_icon?: string | null
          id?: string
          is_default?: boolean | null
          item_count?: number | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          emoji_icon?: string | null
          id?: string
          is_default?: boolean | null
          item_count?: number | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      writing_style_profiles: {
        Row: {
          avg_sentence_length: number | null
          content_themes: string[] | null
          created_at: string | null
          cta_patterns: string[] | null
          emoji_usage: string | null
          formatting_style: Json | null
          hook_patterns: string[] | null
          id: string
          last_refreshed_at: string | null
          posts_analyzed_count: number | null
          raw_analysis: Json | null
          signature_phrases: string[] | null
          tone: string | null
          updated_at: string | null
          user_id: string
          vocabulary_level: string | null
          wishlisted_analyzed_count: number | null
        }
        Insert: {
          avg_sentence_length?: number | null
          content_themes?: string[] | null
          created_at?: string | null
          cta_patterns?: string[] | null
          emoji_usage?: string | null
          formatting_style?: Json | null
          hook_patterns?: string[] | null
          id?: string
          last_refreshed_at?: string | null
          posts_analyzed_count?: number | null
          raw_analysis?: Json | null
          signature_phrases?: string[] | null
          tone?: string | null
          updated_at?: string | null
          user_id: string
          vocabulary_level?: string | null
          wishlisted_analyzed_count?: number | null
        }
        Update: {
          avg_sentence_length?: number | null
          content_themes?: string[] | null
          created_at?: string | null
          cta_patterns?: string[] | null
          emoji_usage?: string | null
          formatting_style?: Json | null
          hook_patterns?: string[] | null
          id?: string
          last_refreshed_at?: string | null
          posts_analyzed_count?: number | null
          raw_analysis?: Json | null
          signature_phrases?: string[] | null
          tone?: string | null
          updated_at?: string | null
          user_id?: string
          vocabulary_level?: string | null
          wishlisted_analyzed_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_user_generate_suggestions: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      expire_old_suggestions: { Args: never; Returns: number }
      get_active_suggestion_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_analytics_summary: {
        Args: {
          p_comp_end_date: string
          p_comp_start_date: string
          p_end_date: string
          p_metric: string
          p_post_ids?: string[]
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          comp_avg: number
          comp_count: number
          comp_total: number
          current_avg: number
          current_count: number
          current_total: number
          pct_change: number
        }[]
      }
      get_analytics_timeseries_daily: {
        Args: {
          p_end_date: string
          p_metric: string
          p_post_ids?: string[]
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          bucket_date: string
          value: number
        }[]
      }
      get_analytics_timeseries_monthly: {
        Args: {
          p_end_date: string
          p_metric: string
          p_post_ids?: string[]
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          bucket_date: string
          value: number
        }[]
      }
      get_analytics_timeseries_quarterly: {
        Args: {
          p_end_date: string
          p_metric: string
          p_post_ids?: string[]
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          bucket_date: string
          value: number
        }[]
      }
      get_analytics_timeseries_weekly: {
        Args: {
          p_end_date: string
          p_metric: string
          p_post_ids?: string[]
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          bucket_date: string
          value: number
        }[]
      }
      get_analytics_timeseries_yearly: {
        Args: {
          p_end_date: string
          p_metric: string
          p_post_ids?: string[]
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          bucket_date: string
          value: number
        }[]
      }
      get_profile_analytics_summary: {
        Args: {
          p_comp_end_date: string
          p_comp_start_date: string
          p_end_date: string
          p_metric: string
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          comp_avg: number
          comp_count: number
          comp_total: number
          current_avg: number
          current_count: number
          current_total: number
          pct_change: number
        }[]
      }
      get_profile_analytics_timeseries_daily: {
        Args: {
          p_end_date: string
          p_metric: string
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          bucket_date: string
          value: number
        }[]
      }
      get_profile_analytics_timeseries_monthly: {
        Args: {
          p_end_date: string
          p_metric: string
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          bucket_date: string
          value: number
        }[]
      }
      get_profile_analytics_timeseries_weekly: {
        Args: {
          p_end_date: string
          p_metric: string
          p_start_date: string
          p_user_id: string
        }
        Returns: {
          bucket_date: string
          value: number
        }[]
      }
      is_company_team_member: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_member_of_team: { Args: { target_team_id: string }; Returns: boolean }
      is_team_admin_or_owner: {
        Args: { target_team_id: string }
        Returns: boolean
      }
      is_team_mate: { Args: { target_user_id: string }; Returns: boolean }
      search_connections_mentions: {
        Args: { p_query: string; p_user_id: string }
        Returns: {
          artifact_path: string
          entity_urn: string
          headline: string
          name: string
          public_identifier: string
          root_url: string
        }[]
      }
      search_teams_fuzzy: {
        Args: { search_term: string; similarity_threshold?: number }
        Returns: {
          company_id: string
          discoverable: boolean
          id: string
          logo_url: string
          name: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      prompt_type:
        | "remix_professional"
        | "remix_casual"
        | "remix_inspiring"
        | "remix_educational"
        | "remix_thought_provoking"
        | "remix_match_style"
        | "post_story"
        | "post_listicle"
        | "post_how_to"
        | "post_contrarian"
        | "post_case_study"
        | "post_reflection"
        | "post_data_driven"
        | "post_question"
        | "post_carousel"
        | "carousel_system"
        | "carousel_user_template"
        | "base_rules"
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
      prompt_type: [
        "remix_professional",
        "remix_casual",
        "remix_inspiring",
        "remix_educational",
        "remix_thought_provoking",
        "remix_match_style",
        "post_story",
        "post_listicle",
        "post_how_to",
        "post_contrarian",
        "post_case_study",
        "post_reflection",
        "post_data_driven",
        "post_question",
        "post_carousel",
        "carousel_system",
        "carousel_user_template",
        "base_rules",
      ],
    },
  },
} as const

// ============================================================================
// Custom Type Aliases & Interfaces
// ============================================================================

export interface DiscoverPost {
  id: string
  linkedin_url: string
  author_name: string
  author_headline: string
  author_avatar_url: string | null
  author_profile_url: string | null
  content: string
  post_type: string | null
  likes_count: number
  comments_count: number
  reposts_count: number
  impressions_count: number | null
  posted_at: string
  scraped_at: string
  topics: string[]
  is_viral: boolean
  engagement_rate: number | null
  source: string
  ingest_batch_id: string | null
  freshness: string
}

export interface DiscoverNewsArticle {
  id: string
  headline: string
  summary: string
  source_url: string
  source_name: string
  published_date: string | null
  relevance_tags: string[]
  topic: string
  ingest_batch_id: string | null
  freshness: string
  perplexity_citations: string[]
  created_at: string
}

export type Company = Tables<'companies'>
export type CompanyInsert = TablesInsert<'companies'>
export type CompanyUpdate = TablesUpdate<'companies'>
export type Team = Tables<'teams'>
export type TeamMember = Tables<'team_members'>
export type TeamInvitation = Tables<'team_invitations'>
export type TeamInvitationInsert = TablesInsert<'team_invitations'>
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled'
export type TeamMemberRole = 'owner' | 'admin' | 'member'

export interface CompanyWithTeam extends Company {
  team?: Team | null
  team_members?: TeamMember[]
}

export interface TeamInvitationWithInviter extends TeamInvitation {
  inviter?: {
    name: string | null
    email: string
    avatar_url: string | null
  }
  team?: {
    name: string
    company?: {
      name: string
      logo_url: string | null
    }
  }
}

export type ScheduledPost = Tables<'scheduled_posts'>
export type ScheduledPostInsert = TablesInsert<'scheduled_posts'>
export type ScheduledPostUpdate = TablesUpdate<'scheduled_posts'>
export type ScheduledPostStatus = 'pending' | 'scheduled' | 'posting' | 'posted' | 'failed' | 'cancelled'
export type PostVisibility = 'PUBLIC' | 'CONNECTIONS'

export type ResearchSessionStatus =
  | 'pending'
  | 'initializing'
  | 'searching'
  | 'enriching'
  | 'generating'
  | 'saving'
  | 'completed'
  | 'failed'

export type ResearchDepth = 'basic' | 'deep'

export type GeneratedPostType =
  | 'thought-leadership'
  | 'storytelling'
  | 'educational'
  | 'contrarian'
  | 'data-driven'
  | 'how-to'
  | 'listicle'

export type GeneratedPostStatus = 'draft' | 'scheduled' | 'posted' | 'archived'

export interface ResearchSession {
  id: string
  user_id: string
  topics: string[]
  depth: ResearchDepth
  status: ResearchSessionStatus
  posts_discovered: number | null
  posts_generated: number | null
  error_message: string | null
  failed_step: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  inngest_run_id: string | null
}

export interface GeneratedPost {
  id: string
  user_id: string
  discover_post_id: string | null
  research_session_id: string | null
  content: string
  post_type: GeneratedPostType
  hook: string | null
  cta: string | null
  word_count: number | null
  estimated_read_time: number | null
  status: GeneratedPostStatus
  source_url: string | null
  source_title: string | null
  source_snippet: string | null
  created_at: string
  updated_at: string
}

export interface ResearchSessionInsert {
  id?: string
  user_id: string
  topics: string[]
  depth?: ResearchDepth
  status?: ResearchSessionStatus
  posts_discovered?: number
  posts_generated?: number
  error_message?: string | null
  failed_step?: string | null
  started_at?: string | null
  completed_at?: string | null
  inngest_run_id?: string | null
}

export interface GeneratedPostInsert {
  id?: string
  user_id: string
  discover_post_id?: string | null
  research_session_id?: string | null
  content: string
  post_type: GeneratedPostType
  hook?: string | null
  cta?: string | null
  word_count?: number
  estimated_read_time?: number
  status?: GeneratedPostStatus
  source_url?: string | null
  source_title?: string | null
  source_snippet?: string | null
}

export type GeneratedSuggestion = Tables<'generated_suggestions'>
export type GeneratedSuggestionInsert = TablesInsert<'generated_suggestions'>
export type GeneratedSuggestionUpdate = TablesUpdate<'generated_suggestions'>
export type WishlistCollection = Tables<'wishlist_collections'>
export type WishlistCollectionInsert = TablesInsert<'wishlist_collections'>
export type WishlistCollectionUpdate = TablesUpdate<'wishlist_collections'>
export type WishlistItem = Tables<'swipe_wishlist'>
export type WishlistItemInsert = TablesInsert<'swipe_wishlist'>
export type WishlistItemUpdate = TablesUpdate<'swipe_wishlist'>
export type GenerationRun = Tables<'suggestion_generation_runs'>
export type GenerationRunInsert = TablesInsert<'suggestion_generation_runs'>
export type GenerationRunUpdate = TablesUpdate<'suggestion_generation_runs'>
export type SuggestionStatus = 'active' | 'used' | 'dismissed' | 'expired'
export type WishlistStatus = 'saved' | 'scheduled' | 'posted' | 'removed'
export type GenerationRunStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled'
export type WritingStyleProfile = Tables<'writing_style_profiles'>
export type WritingStyleProfileInsert = TablesInsert<'writing_style_profiles'>
export type WritingStyleProfileUpdate = TablesUpdate<'writing_style_profiles'>
export type ContentFreshness = 'new' | 'recent' | 'aging' | 'stale'
