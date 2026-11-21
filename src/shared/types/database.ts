export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      comment_mentions: {
        Row: {
          comment_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          comment_id: string;
          user_id: string;
        };
        Update: {
          comment_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comment_mentions_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comment_mentions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          group_id: string;
          id: string;
          parent_id: string | null;
          target_id: string;
          target_index: number | null;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          group_id: string;
          id?: string;
          parent_id?: string | null;
          target_id: string;
          target_index?: number | null;
          target_type: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          group_id?: string;
          id?: string;
          parent_id?: string | null;
          target_id?: string;
          target_index?: number | null;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'comments_target_type_fkey';
            columns: ['target_type'];
            isOneToOne: false;
            referencedRelation: 'target_types';
            referencedColumns: ['key'];
          },
        ];
      };
      device_exercises: {
        Row: {
          device_id: string;
          exercise_id: string;
        };
        ComputedFields: never;
        Insert: {
          device_id: string;
          exercise_id: string;
        };
        Update: {
          device_id?: string;
          exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'device_exercises_device_id_fkey';
            columns: ['device_id'];
            isOneToOne: false;
            referencedRelation: 'devices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'device_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      devices: {
        Row: {
          comparable: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          image_path: string | null;
          location_id: string;
          name: string;
          setting_fields: string[];
          weight_max: number | null;
          weight_min: number | null;
          weight_step: number | null;
        };
        ComputedFields: never;
        Insert: {
          comparable?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          location_id: string;
          name: string;
          setting_fields?: string[];
          weight_max?: number | null;
          weight_min?: number | null;
          weight_step?: number | null;
        };
        Update: {
          comparable?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          location_id?: string;
          name?: string;
          setting_fields?: string[];
          weight_max?: number | null;
          weight_min?: number | null;
          weight_step?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'devices_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_aliases: {
        Row: {
          alias: string;
          exercise_id: string;
        };
        ComputedFields: never;
        Insert: {
          alias: string;
          exercise_id: string;
        };
        Update: {
          alias?: string;
          exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_aliases_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      exercise_muscles: {
        Row: {
          exercise_id: string;
          muscle_group: string;
          role: string;
        };
        ComputedFields: never;
        Insert: {
          exercise_id: string;
          muscle_group: string;
          role: string;
        };
        Update: {
          exercise_id?: string;
          muscle_group?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercise_muscles_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'exercise_muscles_muscle_group_fkey';
            columns: ['muscle_group'];
            isOneToOne: false;
            referencedRelation: 'muscle_groups';
            referencedColumns: ['key'];
          },
        ];
      };
      exercises: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          image_path: string | null;
          measure: Database['public']['Enums']['exercise_measure'];
          merged_into: string | null;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          measure: Database['public']['Enums']['exercise_measure'];
          merged_into?: string | null;
          name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          measure?: Database['public']['Enums']['exercise_measure'];
          merged_into?: string | null;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exercises_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      feed_event_types: {
        Row: {
          description: string;
          key: string;
        };
        ComputedFields: never;
        Insert: {
          description: string;
          key: string;
        };
        Update: {
          description?: string;
          key?: string;
        };
        Relationships: [];
      };
      feed_events: {
        Row: {
          actor_id: string;
          created_at: string;
          data: NonNullable<Json>;
          group_id: string;
          id: string;
          last_activity_at: string;
          target_id: string | null;
          target_type: string | null;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          created_at?: string;
          data?: NonNullable<Json>;
          group_id: string;
          id?: string;
          last_activity_at?: string;
          target_id?: string | null;
          target_type?: string | null;
          type: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          data?: NonNullable<Json>;
          group_id?: string;
          id?: string;
          last_activity_at?: string;
          target_id?: string | null;
          target_type?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feed_events_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feed_events_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feed_events_target_type_fkey';
            columns: ['target_type'];
            isOneToOne: false;
            referencedRelation: 'target_types';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'feed_events_type_fkey';
            columns: ['type'];
            isOneToOne: false;
            referencedRelation: 'feed_event_types';
            referencedColumns: ['key'];
          },
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          invite_id: string | null;
          joined_at: string;
          role: Database['public']['Enums']['group_role'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          invite_id?: string | null;
          joined_at?: string;
          role?: Database['public']['Enums']['group_role'];
          user_id: string;
        };
        Update: {
          group_id?: string;
          invite_id?: string | null;
          joined_at?: string;
          role?: Database['public']['Enums']['group_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_invite_id_fkey';
            columns: ['invite_id'];
            isOneToOne: false;
            referencedRelation: 'invites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      invites: {
        Row: {
          code_hash: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          grants_super_admin: boolean;
          group_id: string;
          id: string;
          label: string | null;
          max_uses: number;
          revoked_at: string | null;
          role: Database['public']['Enums']['group_role'];
          used_count: number;
        };
        ComputedFields: never;
        Insert: {
          code_hash: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          grants_super_admin?: boolean;
          group_id: string;
          id?: string;
          label?: string | null;
          max_uses?: number;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['group_role'];
          used_count?: number;
        };
        Update: {
          code_hash?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          grants_super_admin?: boolean;
          group_id?: string;
          id?: string;
          label?: string | null;
          max_uses?: number;
          revoked_at?: string | null;
          role?: Database['public']['Enums']['group_role'];
          used_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'invites_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invites_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      locations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          owner_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          owner_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          owner_id?: string | null;
        };
        Relationships: [];
      };
      muscle_groups: {
        Row: {
          key: string;
          label: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          label: string;
          sort: number;
        };
        Update: {
          key?: string;
          label?: string;
          sort?: number;
        };
        Relationships: [];
      };
      notification_categories: {
        Row: {
          description: string;
          in_all: boolean;
          in_important: boolean;
          in_standard: boolean;
          key: string;
          label: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          description: string;
          in_all?: boolean;
          in_important: boolean;
          in_standard: boolean;
          key: string;
          label: string;
          sort: number;
        };
        Update: {
          description?: string;
          in_all?: boolean;
          in_important?: boolean;
          in_standard?: boolean;
          key?: string;
          label?: string;
          sort?: number;
        };
        Relationships: [];
      };
      notification_category_prefs: {
        Row: {
          category: string;
          enabled: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          enabled: boolean;
          user_id?: string;
        };
        Update: {
          category?: string;
          enabled?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_category_prefs_category_fkey';
            columns: ['category'];
            isOneToOne: false;
            referencedRelation: 'notification_categories';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'notification_category_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notification_prefs: {
        Row: {
          bundle: boolean;
          preset: string;
          quiet_end: string;
          quiet_hours_enabled: boolean;
          quiet_start: string;
          time_zone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          bundle?: boolean;
          preset?: string;
          quiet_end?: string;
          quiet_hours_enabled?: boolean;
          quiet_start?: string;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          bundle?: boolean;
          preset?: string;
          quiet_end?: string;
          quiet_hours_enabled?: boolean;
          quiet_start?: string;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_prefs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          category: string;
          comment_id: string | null;
          created_at: string;
          data: NonNullable<Json>;
          event: string;
          group_id: string;
          id: string;
          push_skipped: boolean;
          pushed_at: string | null;
          read_at: string | null;
          recipient_id: string;
          target_id: string;
          target_index: number | null;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          category: string;
          comment_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          event: string;
          group_id: string;
          id?: string;
          push_skipped?: boolean;
          pushed_at?: string | null;
          read_at?: string | null;
          recipient_id: string;
          target_id: string;
          target_index?: number | null;
          target_type: string;
        };
        Update: {
          actor_id?: string | null;
          category?: string;
          comment_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          event?: string;
          group_id?: string;
          id?: string;
          push_skipped?: boolean;
          pushed_at?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          target_id?: string;
          target_index?: number | null;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_category_fkey';
            columns: ['category'];
            isOneToOne: false;
            referencedRelation: 'notification_categories';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'notifications_comment_id_fkey';
            columns: ['comment_id'];
            isOneToOne: false;
            referencedRelation: 'comments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_recipient_id_fkey';
            columns: ['recipient_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_target_type_fkey';
            columns: ['target_type'];
            isOneToOne: false;
            referencedRelation: 'target_types';
            referencedColumns: ['key'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          color: string;
          created_at: string;
          display_name: string;
          home_gym: string | null;
          id: string;
          is_super_admin: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          color: string;
          created_at?: string;
          display_name: string;
          home_gym?: string | null;
          id: string;
          is_super_admin?: boolean;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          color?: string;
          created_at?: string;
          display_name?: string;
          home_gym?: string | null;
          id?: string;
          is_super_admin?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_state: {
        Row: {
          last_push_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          last_push_at: string;
          user_id: string;
        };
        Update: {
          last_push_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_state_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          failure_count: number;
          id: string;
          last_success_at: string | null;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          failure_count?: number;
          id?: string;
          last_success_at?: string | null;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          failure_count?: number;
          id?: string;
          last_success_at?: string | null;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reaction_kinds: {
        Row: {
          emoji: string;
          key: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          emoji: string;
          key: string;
          sort?: number;
        };
        Update: {
          emoji?: string;
          key?: string;
          sort?: number;
        };
        Relationships: [];
      };
      reactions: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          kind: string;
          target_id: string;
          target_index: number | null;
          target_type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          kind?: string;
          target_id: string;
          target_index?: number | null;
          target_type: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          kind?: string;
          target_id?: string;
          target_index?: number | null;
          target_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reactions_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reactions_kind_fkey';
            columns: ['kind'];
            isOneToOne: false;
            referencedRelation: 'reaction_kinds';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'reactions_target_type_fkey';
            columns: ['target_type'];
            isOneToOne: false;
            referencedRelation: 'target_types';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'reactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      read_markers: {
        Row: {
          group_id: string;
          last_read_at: string;
          target_id: string;
          target_index: number | null;
          target_type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          last_read_at?: string;
          target_id: string;
          target_index?: number | null;
          target_type: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          last_read_at?: string;
          target_id?: string;
          target_index?: number | null;
          target_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'read_markers_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'read_markers_target_type_fkey';
            columns: ['target_type'];
            isOneToOne: false;
            referencedRelation: 'target_types';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'read_markers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      target_types: {
        Row: {
          can_view_fn: unknown;
          key: string;
          module: string;
          owner_fn: unknown;
        };
        ComputedFields: never;
        Insert: {
          can_view_fn: unknown;
          key: string;
          module: string;
          owner_fn: unknown;
        };
        Update: {
          can_view_fn?: unknown;
          key?: string;
          module?: string;
          owner_fn?: unknown;
        };
        Relationships: [];
      };
      training_prefs: {
        Row: {
          home_location_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          home_location_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          home_location_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'training_prefs_home_location_id_fkey';
            columns: ['home_location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      training_types: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          kind: string;
          location_mode: string;
          name: string;
          owner_id: string | null;
          sort: number;
          variants: string[];
          with_distance: boolean;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          location_mode?: string;
          name: string;
          owner_id?: string | null;
          sort?: number;
          variants?: string[];
          with_distance?: boolean;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          location_mode?: string;
          name?: string;
          owner_id?: string | null;
          sort?: number;
          variants?: string[];
          with_distance?: boolean;
        };
        Relationships: [];
      };
      user_device_settings: {
        Row: {
          device_id: string;
          exercise_id: string;
          updated_at: string;
          user_id: string;
          values: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          device_id: string;
          exercise_id: string;
          updated_at?: string;
          user_id?: string;
          values?: NonNullable<Json>;
        };
        Update: {
          device_id?: string;
          exercise_id?: string;
          updated_at?: string;
          user_id?: string;
          values?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'user_device_settings_device_id_fkey';
            columns: ['device_id'];
            isOneToOne: false;
            referencedRelation: 'devices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_device_settings_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_items: {
        Row: {
          created_at: string;
          device_id: string | null;
          exercise_id: string;
          id: string;
          note: string | null;
          position: number;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          device_id?: string | null;
          exercise_id: string;
          id?: string;
          note?: string | null;
          position: number;
          workout_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string | null;
          exercise_id?: string;
          id?: string;
          note?: string | null;
          position?: number;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_items_device_id_fkey';
            columns: ['device_id'];
            isOneToOne: false;
            referencedRelation: 'devices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_items_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_items_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_sets: {
        Row: {
          completed_at: string | null;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          is_warmup: boolean;
          item_id: string;
          position: number;
          reps: number | null;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          is_warmup?: boolean;
          item_id: string;
          position: number;
          reps?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          is_warmup?: boolean;
          item_id?: string;
          position?: number;
          reps?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_sets_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'workout_items';
            referencedColumns: ['id'];
          },
        ];
      };
      workouts: {
        Row: {
          created_at: string;
          distance_m: number | null;
          duration_seconds: number | null;
          ended_at: string | null;
          id: string;
          intensity: number | null;
          location_id: string | null;
          note: string | null;
          paused_at: string | null;
          paused_seconds: number;
          started_at: string;
          status: Database['public']['Enums']['workout_status'];
          training_type_id: string;
          user_id: string;
          variant: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          distance_m?: number | null;
          duration_seconds?: number | null;
          ended_at?: string | null;
          id?: string;
          intensity?: number | null;
          location_id?: string | null;
          note?: string | null;
          paused_at?: string | null;
          paused_seconds?: number;
          started_at?: string;
          status?: Database['public']['Enums']['workout_status'];
          training_type_id: string;
          user_id?: string;
          variant?: string | null;
        };
        Update: {
          created_at?: string;
          distance_m?: number | null;
          duration_seconds?: number | null;
          ended_at?: string | null;
          id?: string;
          intensity?: number | null;
          location_id?: string | null;
          note?: string | null;
          paused_at?: string | null;
          paused_seconds?: number;
          started_at?: string;
          status?: Database['public']['Enums']['workout_status'];
          training_type_id?: string;
          user_id?: string;
          variant?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workouts_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workouts_training_type_id_fkey';
            columns: ['training_type_id'];
            isOneToOne: false;
            referencedRelation: 'training_types';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_invite: {
        Args: { p_code: string };
        Returns: {
          group_id: string;
          group_name: string;
        }[];
      };
      claim_push_deliveries: {
        Args: { p_bundle_window?: string };
        Returns: {
          notifications: Json;
          subscriptions: Json;
          unread: number;
          user_id: string;
        }[];
      };
      comment_stats: {
        Args: { p_group_id: string; p_target_ids: string[]; p_target_type: string };
        Returns: {
          last_author_id: string;
          last_body: string;
          last_comment_id: string;
          last_created_at: string;
          target_id: string;
          target_index: number;
          total: number;
          unread: number;
        }[];
      };
      exercise_trend: {
        Args: { p_device_id?: string; p_exercise_id: string; p_limit?: number };
        Returns: {
          value: number;
          workout_started_at: string;
        }[];
      };
      finish_workout: {
        Args: { p_workout_id: string };
        Returns: {
          created_at: string;
          distance_m: number | null;
          duration_seconds: number | null;
          ended_at: string | null;
          id: string;
          intensity: number | null;
          location_id: string | null;
          note: string | null;
          paused_at: string | null;
          paused_seconds: number;
          started_at: string;
          status: Database['public']['Enums']['workout_status'];
          training_type_id: string;
          user_id: string;
          variant: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'workouts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_all_notifications_read: { Args: Record<PropertyKey, never>; Returns: undefined };
      mark_thread_read: {
        Args: {
          p_group_id: string;
          p_target_id: string;
          p_target_index?: number;
          p_target_type: string;
        };
        Returns: undefined;
      };
      post_comment: {
        Args: {
          p_body: string;
          p_group_id: string;
          p_mentions?: string[];
          p_parent_id?: string;
          p_target_id: string;
          p_target_index?: number;
          p_target_type: string;
        };
        Returns: {
          author_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          group_id: string;
          id: string;
          parent_id: string | null;
          target_id: string;
          target_index: number | null;
          target_type: string;
        };
        SetofOptions: {
          from: '*';
          to: 'comments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      previous_sets: {
        Args: { p_device_id?: string; p_exercise_id: string };
        Returns: {
          duration_seconds: number;
          is_warmup: boolean;
          reps: number;
          same_device: boolean;
          set_position: number;
          weight_kg: number;
          workout_started_at: string;
        }[];
      };
      redeem_invite: {
        Args: { p_code: string; p_display_name?: string; p_home_gym?: string };
        Returns: string;
      };
      register_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string; p_user_agent?: string };
        Returns: undefined;
      };
      report_push_result: {
        Args: { p_gone: boolean; p_ok: boolean; p_subscription_id: string };
        Returns: undefined;
      };
      search_exercises: {
        Args: { p_limit?: number; p_query: string };
        Returns: {
          id: string;
          matched_alias: string;
          measure: Database['public']['Enums']['exercise_measure'];
          name: string;
        }[];
      };
      start_workout: {
        Args: { p_location_id?: string; p_training_type_id: string };
        Returns: {
          created_at: string;
          distance_m: number | null;
          duration_seconds: number | null;
          ended_at: string | null;
          id: string;
          intensity: number | null;
          location_id: string | null;
          note: string | null;
          paused_at: string | null;
          paused_seconds: number;
          started_at: string;
          status: Database['public']['Enums']['workout_status'];
          training_type_id: string;
          user_id: string;
          variant: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'workouts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      unregister_push_subscription: { Args: { p_endpoint: string }; Returns: undefined };
    };
    Enums: {
      exercise_measure: 'weight_reps' | 'reps' | 'duration';
      group_role: 'admin' | 'member';
      workout_status: 'active' | 'finished';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      exercise_measure: ['weight_reps', 'reps', 'duration'],
      group_role: ['admin', 'member'],
      workout_status: ['active', 'finished'],
    },
  },
} as const;
