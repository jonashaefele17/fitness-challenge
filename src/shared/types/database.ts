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
      body_checkin_reminder_log: {
        Row: {
          due_on: string;
          sent_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          due_on: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          due_on?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      body_checkins: {
        Row: {
          created_at: string;
          id: string;
          on_date: string;
          skipped: boolean;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          on_date: string;
          skipped?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          on_date?: string;
          skipped?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      body_measurement_kinds: {
        Row: {
          hint: string;
          image_path: string | null;
          key: string;
          label: string;
          sort: number;
          start_value: number;
          step: number;
          unit: string;
        };
        ComputedFields: never;
        Insert: {
          hint: string;
          image_path?: string | null;
          key: string;
          label: string;
          sort: number;
          start_value?: number;
          step?: number;
          unit?: string;
        };
        Update: {
          hint?: string;
          image_path?: string | null;
          key?: string;
          label?: string;
          sort?: number;
          start_value?: number;
          step?: number;
          unit?: string;
        };
        Relationships: [];
      };
      body_measurements: {
        Row: {
          checkin_id: string;
          kind: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          checkin_id: string;
          kind: string;
          value: number;
        };
        Update: {
          checkin_id?: string;
          kind?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'body_measurements_checkin_id_fkey';
            columns: ['checkin_id'];
            isOneToOne: false;
            referencedRelation: 'body_checkins';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'body_measurements_kind_fkey';
            columns: ['kind'];
            isOneToOne: false;
            referencedRelation: 'body_measurement_kinds';
            referencedColumns: ['key'];
          },
        ];
      };
      body_photo_poses: {
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
      body_photos: {
        Row: {
          bytes: number;
          checkin_id: string | null;
          created_at: string;
          deleted_at: string | null;
          height: number;
          id: string;
          path: string;
          pose: string;
          thumb_path: string;
          user_id: string;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          bytes: number;
          checkin_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          height: number;
          id?: string;
          path: string;
          pose: string;
          thumb_path: string;
          user_id?: string;
          width: number;
        };
        Update: {
          bytes?: number;
          checkin_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          height?: number;
          id?: string;
          path?: string;
          pose?: string;
          thumb_path?: string;
          user_id?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'body_photos_checkin_id_user_id_fkey';
            columns: ['checkin_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'body_checkins';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'body_photos_pose_fkey';
            columns: ['pose'];
            isOneToOne: false;
            referencedRelation: 'body_photo_poses';
            referencedColumns: ['key'];
          },
        ];
      };
      body_reminder_log: {
        Row: {
          on_date: string;
          sent_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          on_date: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          on_date?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      body_settings: {
        Row: {
          checkin_every_weeks: number | null;
          checkin_reminder_at: string | null;
          hidden_measurement_kinds: string[];
          updated_at: string;
          user_id: string;
          weigh_reminder_at: string | null;
          weigh_reminder_days: number[];
          weight_share: string;
        };
        ComputedFields: never;
        Insert: {
          checkin_every_weeks?: number | null;
          checkin_reminder_at?: string | null;
          hidden_measurement_kinds?: string[];
          updated_at?: string;
          user_id?: string;
          weigh_reminder_at?: string | null;
          weigh_reminder_days?: number[];
          weight_share?: string;
        };
        Update: {
          checkin_every_weeks?: number | null;
          checkin_reminder_at?: string | null;
          hidden_measurement_kinds?: string[];
          updated_at?: string;
          user_id?: string;
          weigh_reminder_at?: string | null;
          weigh_reminder_days?: number[];
          weight_share?: string;
        };
        Relationships: [];
      };
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
      device_hidden_exercises: {
        Row: {
          created_at: string;
          device_id: string;
          exercise_id: string;
          hidden_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          device_id: string;
          exercise_id: string;
          hidden_by?: string | null;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          exercise_id?: string;
          hidden_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'device_hidden_exercises_device_id_fkey';
            columns: ['device_id'];
            isOneToOne: false;
            referencedRelation: 'devices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'device_hidden_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      device_type_exercises: {
        Row: {
          added_by: string | null;
          created_at: string;
          device_type_id: string;
          exercise_id: string;
        };
        ComputedFields: never;
        Insert: {
          added_by?: string | null;
          created_at?: string;
          device_type_id: string;
          exercise_id: string;
        };
        Update: {
          added_by?: string | null;
          created_at?: string;
          device_type_id?: string;
          exercise_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'device_type_exercises_device_type_id_fkey';
            columns: ['device_type_id'];
            isOneToOne: false;
            referencedRelation: 'device_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'device_type_exercises_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
        ];
      };
      device_types: {
        Row: {
          comparable: boolean;
          created_at: string;
          created_by: string | null;
          default_weight_step: number | null;
          id: string;
          image_path: string | null;
          name: string;
          setting_fields: string[];
        };
        ComputedFields: never;
        Insert: {
          comparable?: boolean;
          created_at?: string;
          created_by?: string | null;
          default_weight_step?: number | null;
          id?: string;
          image_path?: string | null;
          name: string;
          setting_fields?: string[];
        };
        Update: {
          comparable?: boolean;
          created_at?: string;
          created_by?: string | null;
          default_weight_step?: number | null;
          id?: string;
          image_path?: string | null;
          name?: string;
          setting_fields?: string[];
        };
        Relationships: [];
      };
      devices: {
        Row: {
          created_at: string;
          created_by: string | null;
          device_type_id: string;
          id: string;
          image_path: string | null;
          location_id: string;
          weight_step: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          device_type_id: string;
          id?: string;
          image_path?: string | null;
          location_id: string;
          weight_step?: number | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          device_type_id?: string;
          id?: string;
          image_path?: string | null;
          location_id?: string;
          weight_step?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'devices_device_type_id_fkey';
            columns: ['device_type_id'];
            isOneToOne: false;
            referencedRelation: 'device_types';
            referencedColumns: ['id'];
          },
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
          catalog: string;
          created_at: string;
          created_by: string | null;
          id: string;
          image_path: string | null;
          instructions: string | null;
          measure: Database['public']['Enums']['exercise_measure'];
          merged_into: string | null;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          catalog?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          instructions?: string | null;
          measure: Database['public']['Enums']['exercise_measure'];
          merged_into?: string | null;
          name: string;
        };
        Update: {
          catalog?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          instructions?: string | null;
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
      feed_days: {
        Row: {
          actor_id: string;
          created_at: string;
          day: string;
          group_id: string;
          id: string;
          kind: string;
          last_activity_at: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          created_at?: string;
          day: string;
          group_id: string;
          id?: string;
          kind?: string;
          last_activity_at?: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          day?: string;
          group_id?: string;
          id?: string;
          kind?: string;
          last_activity_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feed_days_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feed_days_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
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
          feed_day_id: string;
          group_id: string;
          id: string;
          last_activity_at: string;
          occurred_at: string;
          target_id: string | null;
          target_type: string | null;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          created_at?: string;
          data?: NonNullable<Json>;
          feed_day_id: string;
          group_id: string;
          id?: string;
          last_activity_at?: string;
          occurred_at: string;
          target_id?: string | null;
          target_type?: string | null;
          type: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          data?: NonNullable<Json>;
          feed_day_id?: string;
          group_id?: string;
          id?: string;
          last_activity_at?: string;
          occurred_at?: string;
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
            foreignKeyName: 'feed_events_feed_day_id_fkey';
            columns: ['feed_day_id'];
            isOneToOne: false;
            referencedRelation: 'feed_days';
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
      habit_entries: {
        Row: {
          habit_id: string;
          on_date: string;
          source: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          habit_id: string;
          on_date: string;
          source?: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          habit_id?: string;
          on_date?: string;
          source?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: 'habit_entries_habit_id_fkey';
            columns: ['habit_id'];
            isOneToOne: false;
            referencedRelation: 'habits';
            referencedColumns: ['id'];
          },
        ];
      };
      habit_input_types: {
        Row: {
          key: string;
          label: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          label: string;
          sort?: number;
        };
        Update: {
          key?: string;
          label?: string;
          sort?: number;
        };
        Relationships: [];
      };
      habit_pauses: {
        Row: {
          created_at: string;
          from_date: string;
          id: string;
          note: string | null;
          to_date: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          from_date: string;
          id?: string;
          note?: string | null;
          to_date: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          from_date?: string;
          id?: string;
          note?: string | null;
          to_date?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      habit_reminder_log: {
        Row: {
          key: string;
          kind: string;
          on_date: string;
          sent_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          kind: string;
          on_date: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          key?: string;
          kind?: string;
          on_date?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      habit_reminders: {
        Row: {
          evening_at: string | null;
          morning_at: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          evening_at?: string | null;
          morning_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          evening_at?: string | null;
          morning_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      habit_templates: {
        Row: {
          description: string | null;
          frequency: string;
          id: string;
          input_type: string;
          key: string | null;
          name: string;
          options: NonNullable<Json>;
          rule: NonNullable<Json>;
          sort: number;
          source: string;
          time_of_day: string;
          times_per_week: number | null;
          unit: string | null;
          weekdays: number[];
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          frequency?: string;
          id?: string;
          input_type: string;
          key?: string | null;
          name: string;
          options?: NonNullable<Json>;
          rule?: NonNullable<Json>;
          sort?: number;
          source?: string;
          time_of_day?: string;
          times_per_week?: number | null;
          unit?: string | null;
          weekdays?: number[];
        };
        Update: {
          description?: string | null;
          frequency?: string;
          id?: string;
          input_type?: string;
          key?: string | null;
          name?: string;
          options?: NonNullable<Json>;
          rule?: NonNullable<Json>;
          sort?: number;
          source?: string;
          time_of_day?: string;
          times_per_week?: number | null;
          unit?: string | null;
          weekdays?: number[];
        };
        Relationships: [
          {
            foreignKeyName: 'habit_templates_input_type_fkey';
            columns: ['input_type'];
            isOneToOne: false;
            referencedRelation: 'habit_input_types';
            referencedColumns: ['key'];
          },
        ];
      };
      habit_versions: {
        Row: {
          created_at: string;
          frequency: string;
          habit_id: string;
          id: string;
          input_type: string;
          name: string;
          options: NonNullable<Json>;
          rule: NonNullable<Json>;
          source: string;
          time_of_day: string;
          times_per_week: number | null;
          unit: string | null;
          valid_from: string;
          weekdays: number[];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          frequency: string;
          habit_id: string;
          id?: string;
          input_type: string;
          name: string;
          options?: NonNullable<Json>;
          rule?: NonNullable<Json>;
          source: string;
          time_of_day: string;
          times_per_week?: number | null;
          unit?: string | null;
          valid_from: string;
          weekdays?: number[];
        };
        Update: {
          created_at?: string;
          frequency?: string;
          habit_id?: string;
          id?: string;
          input_type?: string;
          name?: string;
          options?: NonNullable<Json>;
          rule?: NonNullable<Json>;
          source?: string;
          time_of_day?: string;
          times_per_week?: number | null;
          unit?: string | null;
          valid_from?: string;
          weekdays?: number[];
        };
        Relationships: [
          {
            foreignKeyName: 'habit_versions_habit_id_fkey';
            columns: ['habit_id'];
            isOneToOne: false;
            referencedRelation: 'habits';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'habit_versions_input_type_fkey';
            columns: ['input_type'];
            isOneToOne: false;
            referencedRelation: 'habit_input_types';
            referencedColumns: ['key'];
          },
        ];
      };
      habits: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          share_level: string;
          sort: number;
          source_habit_id: string | null;
          template_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          share_level?: string;
          sort?: number;
          source_habit_id?: string | null;
          template_id?: string | null;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          share_level?: string;
          sort?: number;
          source_habit_id?: string | null;
          template_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'habits_source_habit_id_fkey';
            columns: ['source_habit_id'];
            isOneToOne: false;
            referencedRelation: 'habits';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'habits_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'habit_templates';
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
      live_items: {
        Row: {
          item_id: string;
          key: string;
          session_id: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          item_id: string;
          key: string;
          session_id: string;
          workout_id: string;
        };
        Update: {
          item_id?: string;
          key?: string;
          session_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'live_items_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'live_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      live_members: {
        Row: {
          joined_at: string;
          session_id: string;
          user_id: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          joined_at?: string;
          session_id: string;
          user_id: string;
          workout_id: string;
        };
        Update: {
          joined_at?: string;
          session_id?: string;
          user_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'live_members_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'live_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'live_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'live_members_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: true;
            referencedRelation: 'workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      live_private_items: {
        Row: {
          created_at: string;
          item_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          item_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          item_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      live_sessions: {
        Row: {
          created_at: string;
          ended_at: string | null;
          group_id: string;
          id: string;
          location_id: string | null;
          plan_id: string;
          plan_on: string;
          started_by: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          ended_at?: string | null;
          group_id: string;
          id?: string;
          location_id?: string | null;
          plan_id: string;
          plan_on: string;
          started_by: string;
        };
        Update: {
          created_at?: string;
          ended_at?: string | null;
          group_id?: string;
          id?: string;
          location_id?: string | null;
          plan_id?: string;
          plan_on?: string;
          started_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'live_sessions_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'live_sessions_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'live_sessions_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'live_sessions_started_by_fkey';
            columns: ['started_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
      plan_changes: {
        Row: {
          clear_time: boolean;
          focus_id: string | null;
          moved_to: string | null;
          on_date: string;
          plan_id: string;
          start_time: string | null;
          template_ids: string[] | null;
        };
        ComputedFields: never;
        Insert: {
          clear_time?: boolean;
          focus_id?: string | null;
          moved_to?: string | null;
          on_date: string;
          plan_id: string;
          start_time?: string | null;
          template_ids?: string[] | null;
        };
        Update: {
          clear_time?: boolean;
          focus_id?: string | null;
          moved_to?: string | null;
          on_date?: string;
          plan_id?: string;
          start_time?: string | null;
          template_ids?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_changes_focus_id_fkey';
            columns: ['focus_id'];
            isOneToOne: false;
            referencedRelation: 'training_focuses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_changes_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_days: {
        Row: {
          focus_id: string | null;
          plan_id: string;
          template_ids: string[];
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          focus_id?: string | null;
          plan_id: string;
          template_ids?: string[];
          weekday: number;
        };
        Update: {
          focus_id?: string | null;
          plan_id?: string;
          template_ids?: string[];
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_days_focus_id_fkey';
            columns: ['focus_id'];
            isOneToOne: false;
            referencedRelation: 'training_focuses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_days_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_participants: {
        Row: {
          created_at: string;
          group_id: string;
          plan_id: string;
          responded_at: string | null;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          group_id: string;
          plan_id: string;
          responded_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          plan_id?: string;
          responded_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_participants_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_participants_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_responses: {
        Row: {
          created_at: string;
          on_date: string;
          plan_id: string;
          proposed_date: string | null;
          proposed_time: string | null;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          on_date: string;
          plan_id: string;
          proposed_date?: string | null;
          proposed_time?: string | null;
          status: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          on_date?: string;
          plan_id?: string;
          proposed_date?: string | null;
          proposed_time?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_responses_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plan_responses_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      plan_skips: {
        Row: {
          created_at: string;
          on_date: string;
          plan_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          on_date: string;
          plan_id: string;
        };
        Update: {
          created_at?: string;
          on_date?: string;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plan_skips_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
      plans: {
        Row: {
          created_at: string;
          focus_id: string | null;
          id: string;
          kind: string;
          note: string | null;
          repeat_until: string | null;
          repeat_weekdays: number[];
          start_time: string | null;
          starts_on: string;
          template_ids: string[];
          title: string | null;
          training_type_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          focus_id?: string | null;
          id?: string;
          kind: string;
          note?: string | null;
          repeat_until?: string | null;
          repeat_weekdays?: number[];
          start_time?: string | null;
          starts_on: string;
          template_ids?: string[];
          title?: string | null;
          training_type_id?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          focus_id?: string | null;
          id?: string;
          kind?: string;
          note?: string | null;
          repeat_until?: string | null;
          repeat_weekdays?: number[];
          start_time?: string | null;
          starts_on?: string;
          template_ids?: string[];
          title?: string | null;
          training_type_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'plans_focus_id_fkey';
            columns: ['focus_id'];
            isOneToOne: false;
            referencedRelation: 'training_focuses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'plans_training_type_id_fkey';
            columns: ['training_type_id'];
            isOneToOne: false;
            referencedRelation: 'training_types';
            referencedColumns: ['id'];
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
      scales: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          is_main: boolean;
          name: string;
          offset_kg: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_main?: boolean;
          name: string;
          offset_kg?: number;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          is_main?: boolean;
          name?: string;
          offset_kg?: number;
          user_id?: string;
        };
        Relationships: [];
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
      training_focuses: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          muscle_groups: string[];
          name: string;
          owner_id: string | null;
          short_name: string | null;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          muscle_groups: string[];
          name: string;
          owner_id?: string | null;
          short_name?: string | null;
          sort?: number;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          muscle_groups?: string[];
          name?: string;
          owner_id?: string | null;
          short_name?: string | null;
          sort?: number;
        };
        Relationships: [];
      };
      training_prefs: {
        Row: {
          hidden_training_type_ids: string[];
          home_location_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          hidden_training_type_ids?: string[];
          home_location_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          hidden_training_type_ids?: string[];
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
          catalog: string;
          created_at: string;
          focus_ids: string[] | null;
          guided: boolean;
          icon: string;
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
          catalog?: string;
          created_at?: string;
          focus_ids?: string[] | null;
          guided?: boolean;
          icon?: string;
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
          catalog?: string;
          created_at?: string;
          focus_ids?: string[] | null;
          guided?: boolean;
          icon?: string;
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
      weigh_ins: {
        Row: {
          created_at: string;
          id: string;
          measured_at: string;
          measured_on: string;
          scale_id: string | null;
          source: string;
          updated_at: string;
          user_id: string;
          weight_kg: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          measured_at?: string;
          measured_on: string;
          scale_id?: string | null;
          source?: string;
          updated_at?: string;
          user_id?: string;
          weight_kg: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          measured_at?: string;
          measured_on?: string;
          scale_id?: string | null;
          source?: string;
          updated_at?: string;
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'weigh_ins_scale_id_user_id_fkey';
            columns: ['scale_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'scales';
            referencedColumns: ['id', 'user_id'];
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
          per_side: boolean;
          position: number;
          rep_max: number | null;
          rep_min: number | null;
          rest_seconds: number;
          side_rest_seconds: number;
          target_seconds: number | null;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          device_id?: string | null;
          exercise_id: string;
          id?: string;
          note?: string | null;
          per_side?: boolean;
          position: number;
          rep_max?: number | null;
          rep_min?: number | null;
          rest_seconds?: number;
          side_rest_seconds?: number;
          target_seconds?: number | null;
          workout_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string | null;
          exercise_id?: string;
          id?: string;
          note?: string | null;
          per_side?: boolean;
          position?: number;
          rep_max?: number | null;
          rep_min?: number | null;
          rest_seconds?: number;
          side_rest_seconds?: number;
          target_seconds?: number | null;
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
      workout_template_items: {
        Row: {
          device_type_id: string | null;
          duration_seconds: number | null;
          exercise_id: string;
          id: string;
          note: string | null;
          per_side: boolean;
          position: number;
          rep_max: number | null;
          rep_min: number | null;
          rest_seconds: number;
          sets: number;
          side_rest_seconds: number;
          template_id: string;
          warmup_sets: number;
        };
        ComputedFields: never;
        Insert: {
          device_type_id?: string | null;
          duration_seconds?: number | null;
          exercise_id: string;
          id?: string;
          note?: string | null;
          per_side?: boolean;
          position: number;
          rep_max?: number | null;
          rep_min?: number | null;
          rest_seconds?: number;
          sets?: number;
          side_rest_seconds?: number;
          template_id: string;
          warmup_sets?: number;
        };
        Update: {
          device_type_id?: string | null;
          duration_seconds?: number | null;
          exercise_id?: string;
          id?: string;
          note?: string | null;
          per_side?: boolean;
          position?: number;
          rep_max?: number | null;
          rep_min?: number | null;
          rest_seconds?: number;
          sets?: number;
          side_rest_seconds?: number;
          template_id?: string;
          warmup_sets?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_template_items_device_type_id_fkey';
            columns: ['device_type_id'];
            isOneToOne: false;
            referencedRelation: 'device_types';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_template_items_exercise_id_fkey';
            columns: ['exercise_id'];
            isOneToOne: false;
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_template_items_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'workout_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      workout_templates: {
        Row: {
          archived_at: string | null;
          created_at: string;
          focus_id: string | null;
          id: string;
          name: string;
          note: string | null;
          training_type_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          focus_id?: string | null;
          id?: string;
          name: string;
          note?: string | null;
          training_type_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          focus_id?: string | null;
          id?: string;
          name?: string;
          note?: string | null;
          training_type_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workout_templates_focus_id_fkey';
            columns: ['focus_id'];
            isOneToOne: false;
            referencedRelation: 'training_focuses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workout_templates_training_type_id_fkey';
            columns: ['training_type_id'];
            isOneToOne: false;
            referencedRelation: 'training_types';
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
          focus_id: string | null;
          id: string;
          intensity: number | null;
          location_id: string | null;
          logged_later: boolean;
          note: string | null;
          paused_at: string | null;
          paused_seconds: number;
          plan_id: string | null;
          plan_on: string | null;
          started_at: string;
          status: Database['public']['Enums']['workout_status'];
          template_id: string | null;
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
          focus_id?: string | null;
          id?: string;
          intensity?: number | null;
          location_id?: string | null;
          logged_later?: boolean;
          note?: string | null;
          paused_at?: string | null;
          paused_seconds?: number;
          plan_id?: string | null;
          plan_on?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['workout_status'];
          template_id?: string | null;
          training_type_id: string;
          user_id?: string;
          variant?: string | null;
        };
        Update: {
          created_at?: string;
          distance_m?: number | null;
          duration_seconds?: number | null;
          ended_at?: string | null;
          focus_id?: string | null;
          id?: string;
          intensity?: number | null;
          location_id?: string | null;
          logged_later?: boolean;
          note?: string | null;
          paused_at?: string | null;
          paused_seconds?: number;
          plan_id?: string | null;
          plan_on?: string | null;
          started_at?: string;
          status?: Database['public']['Enums']['workout_status'];
          template_id?: string | null;
          training_type_id?: string;
          user_id?: string;
          variant?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workouts_focus_id_fkey';
            columns: ['focus_id'];
            isOneToOne: false;
            referencedRelation: 'training_focuses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workouts_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workouts_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workouts_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'workout_templates';
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
      accept_plan_proposal: {
        Args: { p_on_date: string; p_plan_id: string; p_user_id: string };
        Returns: undefined;
      };
      add_body_photo: {
        Args: {
          p_bytes: number;
          p_checkin_id: string;
          p_height: number;
          p_id?: string;
          p_path: string;
          p_pose: string;
          p_thumb_path: string;
          p_width: number;
        };
        Returns: string;
      };
      adopt_habit: {
        Args: { p_def: Json; p_source_id: string; p_valid_from: string };
        Returns: string;
      };
      answer_join_request: {
        Args: { p_accept: boolean; p_plan_id: string; p_user_id: string };
        Returns: undefined;
      };
      archive_habit: { Args: { p_archive: boolean; p_habit_id: string }; Returns: undefined };
      body_checkin_status: {
        Args: { p_today: string; p_user_id: string };
        Returns: {
          days_until: number;
          due: boolean;
          every_weeks: number;
          last_done_on: string;
          last_on: string;
          next_due_on: string;
        }[];
      };
      body_measurement_history: {
        Args: { p_kind: string; p_user_id: string };
        Returns: {
          checkin_id: string;
          on_date: string;
          value: number;
        }[];
      };
      body_measurement_stats: {
        Args: { p_user_id: string };
        Returns: {
          change_since_first: number;
          change_since_previous: number;
          first_on: string;
          first_value: number;
          kind: string;
          latest_on: string;
          latest_value: number;
          previous_on: string;
          previous_value: number;
          value_count: number;
        }[];
      };
      body_photos_to_purge: {
        Args: { p_grace_seconds?: number };
        Returns: {
          id: string;
          path: string;
          thumb_path: string;
        }[];
      };
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
      copy_template: { Args: { p_template_id: string }; Returns: string };
      exercise_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          exercise_id: string;
          last_done_at: string;
          last_duration_seconds: number;
          last_reps: number;
          last_weight_kg: number;
          scope_device_id: string;
          trend: number[];
        }[];
      };
      exercise_popularity: {
        Args: Record<PropertyKey, never>;
        Returns: {
          exercise_id: string;
          uses: number;
        }[];
      };
      exercise_progression: {
        Args: {
          p_device_id?: string;
          p_exercise_id: string;
          p_rep_max?: number;
          p_rep_min?: number;
        };
        Returns: {
          go_up: boolean;
          last_reps: number;
          last_weight_kg: number;
          rep_max: number;
          rep_min: number;
          step_kg: number;
          suggested_weight_kg: number;
        }[];
      };
      exercise_records: {
        Args: { p_all_devices?: boolean; p_device_id?: string; p_exercise_id: string };
        Returns: {
          achieved_at: string;
          duration_seconds: number;
          kind: string;
          reps: number;
          value: number;
          weight_kg: number;
        }[];
      };
      exercise_sessions: {
        Args: {
          p_all_devices?: boolean;
          p_device_id?: string;
          p_exercise_id: string;
          p_user_id?: string;
        };
        Returns: {
          best_duration_seconds: number;
          best_reps: number;
          best_score: number;
          best_weight_kg: number;
          device_name: string;
          location_name: string;
          sets: Json;
          started_at: string;
          volume_kg: number;
          workout_id: string;
        }[];
      };
      exercise_trend: {
        Args: { p_device_id?: string; p_exercise_id: string; p_limit?: number };
        Returns: {
          value: number;
          workout_started_at: string;
        }[];
      };
      feed_cards: {
        Args: {
          p_before_at?: string;
          p_before_day?: string;
          p_before_id?: string;
          p_group_id: string;
          p_limit?: number;
          p_sort?: string;
        };
        Returns: {
          actor_id: string;
          day: string;
          events: Json;
          id: string;
          kind: string;
          last_activity_at: string;
          latest_at: string;
        }[];
      };
      finish_workout: {
        Args: { p_workout_id: string };
        Returns: {
          created_at: string;
          distance_m: number | null;
          duration_seconds: number | null;
          ended_at: string | null;
          focus_id: string | null;
          id: string;
          intensity: number | null;
          location_id: string | null;
          logged_later: boolean;
          note: string | null;
          paused_at: string | null;
          paused_seconds: number;
          plan_id: string | null;
          plan_on: string | null;
          started_at: string;
          status: Database['public']['Enums']['workout_status'];
          template_id: string | null;
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
      habit_days: {
        Args: {
          p_from: string;
          p_time_zone?: string;
          p_to: string;
          p_today?: string;
          p_user_id: string;
        };
        Returns: {
          due: boolean;
          frequency: string;
          habit_id: string;
          input_type: string;
          name: string;
          on_date: string;
          paused: boolean;
          score: number;
          source: string;
          state: string;
          time_of_day: string;
          value: Json;
          version_id: string;
        }[];
      };
      habit_stats: {
        Args: {
          p_from: string;
          p_time_zone?: string;
          p_to: string;
          p_today?: string;
          p_user_id: string;
        };
        Returns: {
          best_streak: number;
          counted: number;
          current_streak: number;
          habit_id: string;
          met: number;
          quota: number;
          unit: string;
        }[];
      };
      habit_summary: {
        Args: {
          p_from: string;
          p_time_zone?: string;
          p_to: string;
          p_today?: string;
          p_user_id: string;
        };
        Returns: {
          avg_duration: number;
          avg_end: number;
          avg_start: number;
          avg_value: number;
          best_value: number;
          choice_counts: Json;
          complete_days: number;
          counted: number;
          habit_id: string;
          item_counts: Json;
          met: number;
          previous_quota: number;
          quota: number;
        }[];
      };
      habit_weeks: {
        Args: {
          p_from: string;
          p_time_zone?: string;
          p_to: string;
          p_today?: string;
          p_user_id: string;
        };
        Returns: {
          done_days: number;
          habit_id: string;
          state: string;
          target: number;
          week_start: string;
        }[];
      };
      live_keep_private: { Args: { p_item_id: string }; Returns: undefined };
      live_peer_sets: {
        Args: { p_workout_id: string };
        Returns: {
          item_id: string;
          sets: Json;
          user_id: string;
        }[];
      };
      live_start: {
        Args: { p_plan_id: string; p_plan_on: string; p_template_id?: string };
        Returns: string;
      };
      live_today: {
        Args: { p_today: string };
        Returns: {
          focus_name: string;
          member_ids: string[];
          my_workout_id: string;
          owner_id: string;
          plan_id: string;
          plan_on: string;
          session_id: string;
          start_time: string;
          training_type_id: string;
          type_icon: string;
          type_name: string;
        }[];
      };
      log_past_workout: {
        Args: {
          p_distance_m?: number;
          p_duration_seconds: number;
          p_intensity?: number;
          p_note?: string;
          p_started_at: string;
          p_template_id?: string;
          p_training_type_id: string;
          p_variant?: string;
        };
        Returns: string;
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
      my_joined_plans: {
        Args: Record<PropertyKey, never>;
        Returns: {
          owner_id: string;
          plan_id: string;
          status: string;
        }[];
      };
      plan_occurrences: {
        Args: { p_from: string; p_to: string; p_user_id: string };
        Returns: {
          changed: boolean;
          focus_id: string;
          focus_name: string;
          focus_short: string;
          kind: string;
          note: string;
          on_date: string;
          plan_date: string;
          plan_id: string;
          recurring: boolean;
          start_time: string;
          status: string;
          template_ids: string[];
          title: string;
          training_type_id: string;
          type_icon: string;
          type_name: string;
          user_id: string;
          workout_id: string;
        }[];
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
        Args: { p_before?: string; p_device_id?: string; p_exercise_id: string };
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
      promote_habit_to_template: { Args: { p_habit_id: string }; Returns: string };
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
      request_to_join_plan: { Args: { p_group_id: string; p_plan_id: string }; Returns: undefined };
      respond_to_plan: {
        Args: {
          p_on_date: string;
          p_plan_id: string;
          p_proposed_date?: string;
          p_proposed_time?: string;
          p_status: string;
        };
        Returns: undefined;
      };
      restore_workout: { Args: { p_snapshot: Json; p_workout_id: string }; Returns: undefined };
      save_body_checkin: {
        Args: { p_id?: string; p_on_date: string; p_values: Json };
        Returns: string;
      };
      save_habit: {
        Args: { p_def: Json; p_habit_id: string; p_template_id: string; p_valid_from: string };
        Returns: string;
      };
      save_template: {
        Args: {
          p_focus_id: string;
          p_items: Json;
          p_name: string;
          p_note: string;
          p_template_id: string;
          p_training_type_id: string;
        };
        Returns: string;
      };
      scale_offset_suggestion: {
        Args: { p_scale_id: string };
        Returns: {
          common_days: number;
          scale_id: string;
          suggested_offset_kg: number;
        }[];
      };
      search_exercises: {
        Args: { p_catalog?: string; p_limit?: number; p_query: string };
        Returns: {
          id: string;
          matched_alias: string;
          measure: Database['public']['Enums']['exercise_measure'];
          name: string;
        }[];
      };
      set_body_checkin_photos: {
        Args: { p_checkin_id: string; p_photo_ids: string[] };
        Returns: number;
      };
      set_habit_entry: {
        Args: { p_habit_id: string; p_on_date: string; p_source?: string; p_value: Json };
        Returns: undefined;
      };
      set_item_positions: {
        Args: { p_item_ids: string[]; p_workout_id: string };
        Returns: undefined;
      };
      set_main_scale: { Args: { p_scale_id: string }; Returns: undefined };
      set_my_color: { Args: { p_color: string }; Returns: undefined };
      set_plan_participants: {
        Args: { p_group_id: string; p_plan_id: string; p_user_ids: string[] };
        Returns: undefined;
      };
      set_reaction: {
        Args: {
          p_group_id: string;
          p_kind: string;
          p_target_id: string;
          p_target_index: number;
          p_target_type: string;
        };
        Returns: undefined;
      };
      skip_body_checkin: { Args: { p_id?: string; p_on_date: string }; Returns: string };
      start_workout: {
        Args: {
          p_location_id?: string;
          p_plan_id?: string;
          p_plan_on?: string;
          p_template_id?: string;
          p_training_type_id: string;
        };
        Returns: {
          created_at: string;
          distance_m: number | null;
          duration_seconds: number | null;
          ended_at: string | null;
          focus_id: string | null;
          id: string;
          intensity: number | null;
          location_id: string | null;
          logged_later: boolean;
          note: string | null;
          paused_at: string | null;
          paused_seconds: number;
          plan_id: string | null;
          plan_on: string | null;
          started_at: string;
          status: Database['public']['Enums']['workout_status'];
          template_id: string | null;
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
      template_from_workout: {
        Args: { p_name: string; p_template_id?: string; p_workout_id: string };
        Returns: string;
      };
      template_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          archived_at: string;
          exercise_count: number;
          focus_id: string;
          id: string;
          my_last_used_at: string;
          name: string;
          note: string;
          owner_last_used_at: string;
          owner_name: string;
          training_type_id: string;
          user_id: string;
        }[];
      };
      unregister_push_subscription: { Args: { p_endpoint: string }; Returns: undefined };
      update_workout_time: {
        Args: { p_duration_seconds: number; p_started_at: string; p_workout_id: string };
        Returns: undefined;
      };
      weight_days: {
        Args: { p_from: string; p_to: string; p_user_id: string };
        Returns: {
          entries: number;
          on_date: string;
          trend_kg: number;
          weight_kg: number;
        }[];
      };
      weight_progress: {
        Args: { p_from: string; p_to: string; p_user_id: string };
        Returns: {
          change_pct: number;
          on_date: string;
          trend_kg: number;
          weight_kg: number;
        }[];
      };
      weight_summary: {
        Args: { p_from: string; p_to: string; p_user_id: string };
        Returns: {
          change_kg: number;
          change_pct: number;
          current_on: string;
          current_trend_kg: number;
          days_with_entries: number;
          latest_adjusted_kg: number;
          latest_kg: number;
          latest_on: string;
          latest_scale_id: string;
          share: string;
          start_on: string;
          start_trend_kg: number;
        }[];
      };
      workout_records: {
        Args: { p_workout_id: string };
        Returns: {
          duration_seconds: number;
          exercise_id: string;
          previous_duration_seconds: number;
          previous_reps: number;
          previous_weight_kg: number;
          reps: number;
          weight_kg: number;
        }[];
      };
      workout_summaries: {
        Args: { p_workout_ids: string[] };
        Returns: {
          distance_m: number;
          duration_seconds: number;
          exercise_count: number;
          exercise_names: string[];
          focus_name: string;
          guided: boolean;
          id: string;
          location_name: string;
          record_count: number;
          started_at: string;
          training_type_id: string;
          type_icon: string;
          type_kind: string;
          type_name: string;
          user_id: string;
          variant: string;
          volume_kg: number;
          working_sets: number;
        }[];
      };
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
