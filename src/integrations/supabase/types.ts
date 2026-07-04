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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_rate_limits: {
        Row: {
          endpoint: string
          request_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          endpoint: string
          request_count?: number
          user_id: string
          window_start: string
        }
        Update: {
          endpoint?: string
          request_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          location: string | null
          name: string
          organization_id: string | null
          phone: string | null
          updated_at: string
          whatsapp_chat_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          location?: string | null
          name: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp_chat_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          location?: string | null
          name?: string
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          base_salary: number
          branch_id: string | null
          created_at: string
          full_name: string
          hire_date: string
          id: string
          is_active: boolean
          organization_id: string
          phone: string | null
          position: string | null
          updated_at: string
        }
        Insert: {
          base_salary?: number
          branch_id?: string | null
          created_at?: string
          full_name: string
          hire_date?: string
          id?: string
          is_active?: boolean
          organization_id: string
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Update: {
          base_salary?: number
          branch_id?: string | null
          created_at?: string
          full_name?: string
          hire_date?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approved_by: string | null
          branch_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          expense_date: string
          id: string
          idempotency_key: string | null
          is_deleted: boolean
          is_recurring: boolean
          notes: string | null
          organization_id: string
          receipt_image_url: string | null
          recurrence_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          idempotency_key?: string | null
          is_deleted?: boolean
          is_recurring?: boolean
          notes?: string | null
          organization_id: string
          receipt_image_url?: string | null
          recurrence_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          idempotency_key?: string | null
          is_deleted?: boolean
          is_recurring?: boolean
          notes?: string | null
          organization_id?: string
          receipt_image_url?: string | null
          recurrence_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          last_attempted_at: string | null
          max_attempts: number
          next_retry_at: string | null
          organization_id: string | null
          payload: Json
          status: string
          whatsapp_message_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          last_attempted_at?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          organization_id?: string | null
          payload: Json
          status?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          last_attempted_at?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          organization_id?: string | null
          payload?: Json
          status?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failed_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          organization_id: string
          sort_order: number
          target_amount: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          organization_id: string
          sort_order?: number
          target_amount?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          organization_id?: string
          sort_order?: number
          target_amount?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investment_logs: {
        Row: {
          asset_name: string
          capital_amount: number
          created_at: string
          expected_monthly_roi: number
          id: string
          is_active: boolean
          notes: string | null
          organization_id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_name: string
          capital_amount?: number
          created_at?: string
          expected_monthly_roi?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id: string
          start_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_name?: string
          capital_amount?: number
          created_at?: string
          expected_monthly_roi?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          due_date: string | null
          from_address: string | null
          from_company: string
          from_email: string | null
          id: string
          idempotency_key: string | null
          invoice_date: string
          invoice_number: string
          is_deleted: boolean
          notes: string | null
          organization_id: string
          project_name: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          to_address: string | null
          to_client: string
          to_email: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          from_address?: string | null
          from_company: string
          from_email?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_date?: string
          invoice_number: string
          is_deleted?: boolean
          notes?: string | null
          organization_id: string
          project_name?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          to_address?: string | null
          to_client: string
          to_email?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          due_date?: string | null
          from_address?: string | null
          from_company?: string
          from_email?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_date?: string
          invoice_number?: string
          is_deleted?: boolean
          notes?: string | null
          organization_id?: string
          project_name?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          to_address?: string | null
          to_client?: string
          to_email?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          account: string
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          hash: string
          id: string
          metadata: Json
          organization_id: string
          posted_at: string
          prev_hash: string | null
          ref_id: string
          ref_type: string
        }
        Insert: {
          account: string
          amount: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          hash: string
          id?: string
          metadata?: Json
          organization_id: string
          posted_at?: string
          prev_hash?: string | null
          ref_id: string
          ref_type: string
        }
        Update: {
          account?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          hash?: string
          id?: string
          metadata?: Json
          organization_id?: string
          posted_at?: string
          prev_hash?: string | null
          ref_id?: string
          ref_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          organization_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          organization_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          organization_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          industry_type: string
          investment_enabled: boolean
          invoicing_enabled: boolean
          logo_url: string | null
          max_branches: number
          max_users: number
          name: string
          plan_type: string
          rate_limit_per_minute: number
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry_type?: string
          investment_enabled?: boolean
          invoicing_enabled?: boolean
          logo_url?: string | null
          max_branches?: number
          max_users?: number
          name: string
          plan_type?: string
          rate_limit_per_minute?: number
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          industry_type?: string
          investment_enabled?: boolean
          invoicing_enabled?: boolean
          logo_url?: string | null
          max_branches?: number
          max_users?: number
          name?: string
          plan_type?: string
          rate_limit_per_minute?: number
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_invoices: {
        Row: {
          amount_usd: number
          created_at: string
          description: string | null
          due_date: string | null
          from_address: string
          from_company: string
          from_email: string
          id: string
          invoice_number: string
          issue_date: string
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          period_end: string | null
          period_start: string | null
          plan_code: string | null
          plan_id: string | null
          status: string
          tax_usd: number
          to_email: string | null
          to_organization_name: string
          total_usd: number
          updated_at: string
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          from_address?: string
          from_company?: string
          from_email?: string
          id?: string
          invoice_number: string
          issue_date?: string
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_code?: string | null
          plan_id?: string | null
          status?: string
          tax_usd?: number
          to_email?: string | null
          to_organization_name: string
          total_usd?: number
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          from_address?: string
          from_company?: string
          from_email?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_code?: string | null
          plan_id?: string | null
          status?: string
          tax_usd?: number
          to_email?: string | null
          to_organization_name?: string
          total_usd?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      print_orders: {
        Row: {
          branch_id: string | null
          commission_rate: number
          created_at: string
          customer_name: string
          designer_id: string | null
          file_path: string | null
          height: number
          id: string
          material_type: string
          notes: string | null
          organization_id: string
          printer_id: string | null
          quantity: number
          status: string
          total_area: number | null
          total_price: number | null
          unit_price: number
          updated_at: string
          width: number
        }
        Insert: {
          branch_id?: string | null
          commission_rate?: number
          created_at?: string
          customer_name: string
          designer_id?: string | null
          file_path?: string | null
          height?: number
          id?: string
          material_type?: string
          notes?: string | null
          organization_id: string
          printer_id?: string | null
          quantity?: number
          status?: string
          total_area?: number | null
          total_price?: number | null
          unit_price?: number
          updated_at?: string
          width?: number
        }
        Update: {
          branch_id?: string | null
          commission_rate?: number
          created_at?: string
          customer_name?: string
          designer_id?: string | null
          file_path?: string | null
          height?: number
          id?: string
          material_type?: string
          notes?: string | null
          organization_id?: string
          printer_id?: string | null
          quantity?: number
          status?: string
          total_area?: number | null
          total_price?: number | null
          unit_price?: number
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_orders_designer_id_fkey"
            columns: ["designer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_orders_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      salary_payments: {
        Row: {
          base_amount: number
          bonuses: number
          created_at: string
          deductions: number
          employee_id: string
          id: string
          idempotency_key: string | null
          month: number
          net_amount: number
          notes: string | null
          organization_id: string
          paid_at: string | null
          paid_by: string | null
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          base_amount: number
          bonuses?: number
          created_at?: string
          deductions?: number
          employee_id: string
          id?: string
          idempotency_key?: string | null
          month: number
          net_amount: number
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          base_amount?: number
          bonuses?: number
          created_at?: string
          deductions?: number
          employee_id?: string
          id?: string
          idempotency_key?: string | null
          month?: number
          net_amount?: number
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          paid_by?: string | null
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_cycle: string
          code: string
          created_at: string
          description_en: string | null
          features: Json
          id: string
          is_active: boolean
          max_branches: number
          max_users: number
          name_en: string
          price_usd: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          code: string
          created_at?: string
          description_en?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number
          max_users?: number
          name_en: string
          price_usd?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          code?: string
          created_at?: string
          description_en?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_branches?: number
          max_users?: number
          name_en?: string
          price_usd?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          connection_id: string | null
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          organization_id: string | null
          source: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
          organization_id?: string | null
          source: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          organization_id?: string | null
          source?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          ai_confidence: number | null
          amount: number
          bank_comment: string | null
          branch_id: string
          client_memo: string | null
          confirmed_at: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          extracted_data: Json | null
          fraud_flags: Json | null
          fraud_score: number | null
          id: string
          image_hash: string | null
          image_url: string | null
          is_confirmed: boolean
          is_deleted: boolean
          is_manual_memo: boolean
          needs_review: boolean
          notes: string | null
          organization_id: string | null
          receiver_account: string | null
          sender_account: string | null
          sender_name: string | null
          sender_phone: string | null
          transaction_id: string | null
          transfer_date: string
          updated_at: string
          whatsapp_connection_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          amount: number
          bank_comment?: string | null
          branch_id: string
          client_memo?: string | null
          confirmed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          extracted_data?: Json | null
          fraud_flags?: Json | null
          fraud_score?: number | null
          id?: string
          image_hash?: string | null
          image_url?: string | null
          is_confirmed?: boolean
          is_deleted?: boolean
          is_manual_memo?: boolean
          needs_review?: boolean
          notes?: string | null
          organization_id?: string | null
          receiver_account?: string | null
          sender_account?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          transaction_id?: string | null
          transfer_date?: string
          updated_at?: string
          whatsapp_connection_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          amount?: number
          bank_comment?: string | null
          branch_id?: string
          client_memo?: string | null
          confirmed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          extracted_data?: Json | null
          fraud_flags?: Json | null
          fraud_score?: number | null
          id?: string
          image_hash?: string | null
          image_url?: string | null
          is_confirmed?: boolean
          is_deleted?: boolean
          is_manual_memo?: boolean
          needs_review?: boolean
          notes?: string | null
          organization_id?: string | null
          receiver_account?: string | null
          sender_account?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          transaction_id?: string | null
          transfer_date?: string
          updated_at?: string
          whatsapp_connection_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credit_profiles: {
        Row: {
          created_at: string
          credit_limit: number
          currency: string
          current_balance: number
          id: string
          monthly_income_goal: number
          monthly_payment: number
          monthly_spend: number
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_limit?: number
          currency?: string
          current_balance?: number
          id?: string
          monthly_income_goal?: number
          monthly_payment?: number
          monthly_spend?: number
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_limit?: number
          currency?: string
          current_balance?: number
          id?: string
          monthly_income_goal?: number
          monthly_payment?: number
          monthly_spend?: number
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          dark_mode: boolean
          email_alerts_enabled: boolean
          id: string
          notifications_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dark_mode?: boolean
          email_alerts_enabled?: boolean
          id?: string
          notifications_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dark_mode?: boolean
          email_alerts_enabled?: boolean
          id?: string
          notifications_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_rate_limits: {
        Row: {
          connection_id: string
          id: string
          organization_id: string | null
          request_count: number
          window_start: string
        }
        Insert: {
          connection_id: string
          id?: string
          organization_id?: string | null
          request_count?: number
          window_start?: string
        }
        Update: {
          connection_id?: string
          id?: string
          organization_id?: string | null
          request_count?: number
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_rate_limits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          branch_id: string
          connection_type: string
          created_at: string
          green_api_instance_id: string | null
          id: string
          last_sync_at: string | null
          meta_phone_number_id: string | null
          monitored_chat_id: string | null
          monitored_chat_name: string | null
          notification_enabled: boolean
          organization_id: string | null
          phone_number: string
          status: Database["public"]["Enums"]["whatsapp_connection_status"]
          updated_at: string
          verification_code: string | null
          verification_expires_at: string | null
          webhook_verify_token: string | null
          whatsapp_business_id: string | null
        }
        Insert: {
          branch_id: string
          connection_type?: string
          created_at?: string
          green_api_instance_id?: string | null
          id?: string
          last_sync_at?: string | null
          meta_phone_number_id?: string | null
          monitored_chat_id?: string | null
          monitored_chat_name?: string | null
          notification_enabled?: boolean
          organization_id?: string | null
          phone_number: string
          status?: Database["public"]["Enums"]["whatsapp_connection_status"]
          updated_at?: string
          verification_code?: string | null
          verification_expires_at?: string | null
          webhook_verify_token?: string | null
          whatsapp_business_id?: string | null
        }
        Update: {
          branch_id?: string
          connection_type?: string
          created_at?: string
          green_api_instance_id?: string | null
          id?: string
          last_sync_at?: string | null
          meta_phone_number_id?: string | null
          monitored_chat_id?: string | null
          monitored_chat_name?: string | null
          notification_enabled?: boolean
          organization_id?: string | null
          phone_number?: string
          status?: Database["public"]["Enums"]["whatsapp_connection_status"]
          updated_at?: string
          verification_code?: string | null
          verification_expires_at?: string | null
          webhook_verify_token?: string | null
          whatsapp_business_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_credentials: {
        Row: {
          access_token: string | null
          connection_id: string
          created_at: string
          green_api_token: string | null
          id: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connection_id: string
          created_at?: string
          green_api_token?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connection_id?: string
          created_at?: string
          green_api_token?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          chat_id: string | null
          content: string | null
          created_at: string
          from_number: string
          id: string
          media_url: string | null
          message_id: string
          message_type: string
          organization_id: string | null
          processed: boolean
          processed_at: string | null
          whatsapp_connection_id: string
        }
        Insert: {
          chat_id?: string | null
          content?: string | null
          created_at?: string
          from_number: string
          id?: string
          media_url?: string | null
          message_id: string
          message_type: string
          organization_id?: string | null
          processed?: boolean
          processed_at?: string | null
          whatsapp_connection_id: string
        }
        Update: {
          chat_id?: string | null
          content?: string | null
          created_at?: string
          from_number?: string
          id?: string
          media_url?: string | null
          message_id?: string
          message_type?: string
          organization_id?: string | null
          processed?: boolean
          processed_at?: string | null
          whatsapp_connection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_whatsapp_connection_id_fkey"
            columns: ["whatsapp_connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_notification_log: {
        Row: {
          connection_id: string
          created_at: string
          error_message: string | null
          id: string
          organization_id: string
          recipient_phone: string | null
          status: string
          transfer_id: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id: string
          recipient_phone?: string | null
          status: string
          transfer_id?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          recipient_phone?: string | null
          status?: string
          transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_notification_log_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_notification_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_notification_log_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_add_branch: { Args: { _organization_id: string }; Returns: boolean }
      can_add_user: { Args: { _organization_id: string }; Returns: boolean }
      check_and_increment_ai_rate_limit: {
        Args: {
          _endpoint: string
          _limit: number
          _user_id: string
          _window_seconds?: number
        }
        Returns: boolean
      }
      create_organization_with_owner: {
        Args: { _name: string; _slug: string }
        Returns: {
          created_at: string
          id: string
          industry_type: string
          investment_enabled: boolean
          invoicing_enabled: boolean
          logo_url: string | null
          max_branches: number
          max_users: number
          name: string
          plan_type: string
          rate_limit_per_minute: number
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_branch_by_chat_id: {
        Args: { _chat_id: string; _organization_id: string }
        Returns: string
      }
      generate_platform_invoice_number: { Args: never; Returns: string }
      get_organization_limits: {
        Args: { _organization_id: string }
        Returns: {
          current_branches: number
          current_users: number
          max_branches: number
          max_users: number
          plan_type: string
        }[]
      }
      get_role_level: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: number
      }
      get_user_branch_id: {
        Args: { _organization_id: string; _user_id: string }
        Returns: string
      }
      get_user_organization_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_organization_role: {
        Args: {
          _organization_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      is_organization_member: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      issue_platform_invoice_for_org: {
        Args: { _org_id: string }
        Returns: string
      }
      mark_platform_invoice_paid: {
        Args: { _invoice_id: string; _method?: string; _reference?: string }
        Returns: boolean
      }
      post_ledger_entry: {
        Args: {
          _account: string
          _amount: number
          _currency: string
          _entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          _metadata?: Json
          _organization_id: string
          _ref_id: string
          _ref_type: string
        }
        Returns: string
      }
      soft_delete_all_transfers: {
        Args: { _organization_id: string }
        Returns: number
      }
      soft_delete_expense: { Args: { _expense_id: string }; Returns: boolean }
      soft_delete_invoice: { Args: { _invoice_id: string }; Returns: boolean }
      user_has_full_access: {
        Args: { _organization_id: string; _user_id: string }
        Returns: boolean
      }
      verify_ledger_chain: {
        Args: { _organization_id: string }
        Returns: {
          broken_at_id: string
          broken_at_posted_at: string
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "manager" | "viewer" | "cashier"
      ledger_entry_type: "debit" | "credit"
      whatsapp_connection_status: "connected" | "pending" | "disconnected"
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
      app_role: ["owner", "admin", "manager", "viewer", "cashier"],
      ledger_entry_type: ["debit", "credit"],
      whatsapp_connection_status: ["connected", "pending", "disconnected"],
    },
  },
} as const
