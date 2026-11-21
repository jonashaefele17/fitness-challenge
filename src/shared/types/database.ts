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
      unregister_push_subscription: { Args: { p_endpoint: string }; Returns: undefined };
    };
    Enums: {
      group_role: 'admin' | 'member';
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
      group_role: ['admin', 'member'],
    },
  },
} as const;
