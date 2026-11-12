
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "agent_runs": {
                  Row: {
                    "agent_id": string,"config_snapshot_id": string | null,"cost_eur": number,"created_at": string,"id": string,"location_id": string | null,"model": string | null,"organization_id": string,"requested_by": string | null,"status": string,"tokens_in": number,"tokens_out": number,"trigger": string,"trigger_ref": string | null,"updated_at": string,"workflow_id": string | null
                  }
                  Insert: {
                    "agent_id": string,"config_snapshot_id"?: string | null,"cost_eur"?: number,"created_at"?: string,"id"?: string,"location_id"?: string | null,"model"?: string | null,"organization_id": string,"requested_by"?: string | null,"status"?: string,"tokens_in"?: number,"tokens_out"?: number,"trigger": string,"trigger_ref"?: string | null,"updated_at"?: string,"workflow_id"?: string | null
                  }
                  Update: {
                    "agent_id"?: string,"config_snapshot_id"?: string | null,"cost_eur"?: number,"created_at"?: string,"id"?: string,"location_id"?: string | null,"model"?: string | null,"organization_id"?: string,"requested_by"?: string | null,"status"?: string,"tokens_in"?: number,"tokens_out"?: number,"trigger"?: string,"trigger_ref"?: string | null,"updated_at"?: string,"workflow_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_runs_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_runs_config_snapshot_id_fkey"
      columns: ["config_snapshot_id"]
isOneToOne: false
      referencedRelation: "config_snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_runs_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_runs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_runs_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_skills": {
                  Row: {
                    "agent_id": string,"autonomy_level": string,"created_at": string,"enabled": boolean,"organization_id": string,"skill_id": string,"updated_at": string
                  }
                  Insert: {
                    "agent_id": string,"autonomy_level": string,"created_at"?: string,"enabled"?: boolean,"organization_id": string,"skill_id": string,"updated_at"?: string
                  }
                  Update: {
                    "agent_id"?: string,"autonomy_level"?: string,"created_at"?: string,"enabled"?: boolean,"organization_id"?: string,"skill_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_skills_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_skills_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agent_skills_skill_id_fkey"
      columns: ["skill_id"]
isOneToOne: false
      referencedRelation: "skills"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_types": {
                  Row: {
                    "base_instructions": string,"color": string,"created_at": string,"default_skills": (string)[],"description": string,"id": string,"key": string,"name": string,"organization_id": string | null,"organization_kind": string,"origin": string,"updated_at": string
                  }
                  Insert: {
                    "base_instructions"?: string,"color": string,"created_at"?: string,"default_skills"?: (string)[],"description"?: string,"id"?: string,"key": string,"name": string,"organization_id"?: string | null,"organization_kind"?: string,"origin": string,"updated_at"?: string
                  }
                  Update: {
                    "base_instructions"?: string,"color"?: string,"created_at"?: string,"default_skills"?: (string)[],"description"?: string,"id"?: string,"key"?: string,"name"?: string,"organization_id"?: string | null,"organization_kind"?: string,"origin"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agent_types_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"agents": {
                  Row: {
                    "agent_type_id": string,"created_at": string,"display_name": string | null,"id": string,"organization_id": string,"status": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "agent_type_id": string,"created_at"?: string,"display_name"?: string | null,"id"?: string,"organization_id": string,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "agent_type_id"?: string,"created_at"?: string,"display_name"?: string | null,"id"?: string,"organization_id"?: string,"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "agents_agent_type_id_fkey"
      columns: ["agent_type_id"]
isOneToOne: false
      referencedRelation: "agent_types"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agents_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"appointments": {
                  Row: {
                    "booked_by": string,"cancelled_at": string | null,"contact_id": string,"conversation_id": string | null,"created_at": string,"ends_at": string,"external_ref": string | null,"id": string,"idempotency_key": string,"location_id": string,"organization_id": string,"resource_id": string,"service_id": string,"starts_at": string,"status": string,"synced_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "booked_by": string,"cancelled_at"?: string | null,"contact_id": string,"conversation_id"?: string | null,"created_at"?: string,"ends_at": string,"external_ref"?: string | null,"id"?: string,"idempotency_key": string,"location_id": string,"organization_id": string,"resource_id": string,"service_id": string,"starts_at": string,"status"?: string,"synced_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "booked_by"?: string,"cancelled_at"?: string | null,"contact_id"?: string,"conversation_id"?: string | null,"created_at"?: string,"ends_at"?: string,"external_ref"?: string | null,"id"?: string,"idempotency_key"?: string,"location_id"?: string,"organization_id"?: string,"resource_id"?: string,"service_id"?: string,"starts_at"?: string,"status"?: string,"synced_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_contact_same_org"
      columns: ["contact_id","organization_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "appointments_conversation_same_org"
      columns: ["conversation_id","organization_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "appointments_location_same_org"
      columns: ["location_id","organization_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "appointments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_resource_same_org"
      columns: ["resource_id","organization_id"]
isOneToOne: false
      referencedRelation: "booking_resources"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "appointments_service_same_org"
      columns: ["service_id","organization_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"approvals": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"effect_class": string,"execution_id": string,"expires_at": string,"id": string,"input_hash": string,"location_id": string | null,"organization_id": string,"reason": string | null,"requested_by": string | null,"required_role": string,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"effect_class": string,"execution_id": string,"expires_at": string,"id"?: string,"input_hash": string,"location_id"?: string | null,"organization_id": string,"reason"?: string | null,"requested_by"?: string | null,"required_role": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"effect_class"?: string,"execution_id"?: string,"expires_at"?: string,"id"?: string,"input_hash"?: string,"location_id"?: string | null,"organization_id"?: string,"reason"?: string | null,"requested_by"?: string | null,"required_role"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approvals_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_execution_id_fkey"
      columns: ["execution_id"]
isOneToOne: true
      referencedRelation: "executions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "approvals_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_type": string,"at": string,"id": string,"metadata": NonNullable<Json>,"organization_id": string | null,"target": NonNullable<Json>
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_type": string,"at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"organization_id"?: string | null,"target"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_type"?: string,"at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"organization_id"?: string | null,"target"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_resources": {
                  Row: {
                    "active": boolean,"created_at": string,"external_ref": string | null,"id": string,"kind": string,"location_id": string,"name": string,"organization_id": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"external_ref"?: string | null,"id"?: string,"kind": string,"location_id": string,"name": string,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"external_ref"?: string | null,"id"?: string,"kind"?: string,"location_id"?: string,"name"?: string,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_resources_location_same_org"
      columns: ["location_id","organization_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "booking_resources_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"channel_accounts": {
                  Row: {
                    "channel": string,"created_at": string,"default_agent_type": string,"external_id": string,"id": string,"location_id": string | null,"organization_id": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "channel": string,"created_at"?: string,"default_agent_type": string,"external_id": string,"id"?: string,"location_id"?: string | null,"organization_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"default_agent_type"?: string,"external_id"?: string,"id"?: string,"location_id"?: string | null,"organization_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "channel_accounts_location_same_org"
      columns: ["location_id","organization_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "channel_accounts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"config_overrides": {
                  Row: {
                    "agent_id": string,"created_at": string,"id": string,"level": string,"level_id": string,"locked_keys": (string)[],"organization_id": string,"updated_at": string,"values": NonNullable<Json>,"version": number
                  }
                  Insert: {
                    "agent_id": string,"created_at"?: string,"id"?: string,"level": string,"level_id": string,"locked_keys"?: (string)[],"organization_id": string,"updated_at"?: string,"values"?: NonNullable<Json>,"version"?: number
                  }
                  Update: {
                    "agent_id"?: string,"created_at"?: string,"id"?: string,"level"?: string,"level_id"?: string,"locked_keys"?: (string)[],"organization_id"?: string,"updated_at"?: string,"values"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "config_overrides_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "config_overrides_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"config_snapshots": {
                  Row: {
                    "agent_id": string,"created_at": string,"hash": string,"id": string,"location_id": string | null,"organization_id": string,"resolved": NonNullable<Json>
                  }
                  Insert: {
                    "agent_id": string,"created_at"?: string,"hash": string,"id"?: string,"location_id"?: string | null,"organization_id": string,"resolved": NonNullable<Json>
                  }
                  Update: {
                    "agent_id"?: string,"created_at"?: string,"hash"?: string,"id"?: string,"location_id"?: string | null,"organization_id"?: string,"resolved"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "config_snapshots_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "config_snapshots_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "config_snapshots_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contact_identities": {
                  Row: {
                    "contact_id": string,"created_at": string,"external_id": string,"id": string,"kind": string,"organization_id": string
                  }
                  Insert: {
                    "contact_id": string,"created_at"?: string,"external_id": string,"id"?: string,"kind": string,"organization_id": string
                  }
                  Update: {
                    "contact_id"?: string,"created_at"?: string,"external_id"?: string,"id"?: string,"kind"?: string,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contact_identities_contact_same_org"
      columns: ["contact_id","organization_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "consents": NonNullable<Json>,"created_at": string,"display_name": string | null,"id": string,"locale": string | null,"organization_id": string,"preferred_location_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "consents"?: NonNullable<Json>,"created_at"?: string,"display_name"?: string | null,"id"?: string,"locale"?: string | null,"organization_id": string,"preferred_location_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "consents"?: NonNullable<Json>,"created_at"?: string,"display_name"?: string | null,"id"?: string,"locale"?: string | null,"organization_id"?: string,"preferred_location_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_preferred_location_same_org"
      columns: ["preferred_location_id","organization_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"conversation_summaries": {
                  Row: {
                    "conversation_id": string,"covered_until": string,"created_at": string,"model": string | null,"organization_id": string,"summary": string,"updated_at": string
                  }
                  Insert: {
                    "conversation_id": string,"covered_until": string,"created_at"?: string,"model"?: string | null,"organization_id": string,"summary": string,"updated_at"?: string
                  }
                  Update: {
                    "conversation_id"?: string,"covered_until"?: string,"created_at"?: string,"model"?: string | null,"organization_id"?: string,"summary"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_summaries_conversation_same_org"
      columns: ["conversation_id","organization_id"]
isOneToOne: true
      referencedRelation: "conversations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "conversation_summaries_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "agent_id": string,"assigned_user_id": string | null,"channel": string,"channel_account_id": string,"contact_id": string,"created_at": string,"id": string,"last_message_at": string | null,"location_id": string | null,"mode": string,"organization_id": string,"updated_at": string
                  }
                  Insert: {
                    "agent_id": string,"assigned_user_id"?: string | null,"channel": string,"channel_account_id": string,"contact_id": string,"created_at"?: string,"id"?: string,"last_message_at"?: string | null,"location_id"?: string | null,"mode"?: string,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "agent_id"?: string,"assigned_user_id"?: string | null,"channel"?: string,"channel_account_id"?: string,"contact_id"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string | null,"location_id"?: string | null,"mode"?: string,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_agent_same_org"
      columns: ["agent_id","organization_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "conversations_assigned_user_id_fkey"
      columns: ["assigned_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_channel_account_same_org"
      columns: ["channel_account_id","organization_id"]
isOneToOne: false
      referencedRelation: "channel_accounts"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "conversations_contact_same_org"
      columns: ["contact_id","organization_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "conversations_location_same_org"
      columns: ["location_id","organization_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "conversations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"domain_events": {
                  Row: {
                    "chain_depth": number,"created_at": string,"id": string,"location_id": string | null,"organization_id": string,"payload": NonNullable<Json>,"published_at": string | null,"source_run_id": string | null,"type": string
                  }
                  Insert: {
                    "chain_depth"?: number,"created_at"?: string,"id"?: string,"location_id"?: string | null,"organization_id": string,"payload"?: NonNullable<Json>,"published_at"?: string | null,"source_run_id"?: string | null,"type": string
                  }
                  Update: {
                    "chain_depth"?: number,"created_at"?: string,"id"?: string,"location_id"?: string | null,"organization_id"?: string,"payload"?: NonNullable<Json>,"published_at"?: string | null,"source_run_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "domain_events_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "domain_events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"executions": {
                  Row: {
                    "autonomy_applied": string,"created_at": string,"effect_class": string,"id": string,"idempotency_key": string,"input": NonNullable<Json>,"input_hash": string,"location_id": string | null,"organization_id": string,"output": Json | null,"preview": Json | null,"rationale": string | null,"run_id": string,"skill_key": string,"skill_version": number,"status": string,"target": NonNullable<Json>,"updated_at": string
                  }
                  Insert: {
                    "autonomy_applied": string,"created_at"?: string,"effect_class": string,"id"?: string,"idempotency_key": string,"input": NonNullable<Json>,"input_hash": string,"location_id"?: string | null,"organization_id": string,"output"?: Json | null,"preview"?: Json | null,"rationale"?: string | null,"run_id": string,"skill_key": string,"skill_version": number,"status": string,"target": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "autonomy_applied"?: string,"created_at"?: string,"effect_class"?: string,"id"?: string,"idempotency_key"?: string,"input"?: NonNullable<Json>,"input_hash"?: string,"location_id"?: string | null,"organization_id"?: string,"output"?: Json | null,"preview"?: Json | null,"rationale"?: string | null,"run_id"?: string,"skill_key"?: string,"skill_version"?: number,"status"?: string,"target"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "executions_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "executions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "executions_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "agent_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"goal_progress": {
                  Row: {
                    "created_at": string,"goal_id": string,"id": string,"measured_at": string,"organization_id": string,"source": string,"value": number
                  }
                  Insert: {
                    "created_at"?: string,"goal_id": string,"id"?: string,"measured_at"?: string,"organization_id": string,"source": string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"goal_id"?: string,"id"?: string,"measured_at"?: string,"organization_id"?: string,"source"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "goal_progress_goal_id_fkey"
      columns: ["goal_id"]
isOneToOne: false
      referencedRelation: "goals"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goal_progress_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"goals": {
                  Row: {
                    "created_at": string,"direction": string,"due_date": string | null,"id": string,"metric_key": string,"organization_id": string,"owner_user_id": string | null,"period": string,"scope": string,"scope_id": string,"starts_on": string,"status": string,"target_value": number,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"direction"?: string,"due_date"?: string | null,"id"?: string,"metric_key": string,"organization_id": string,"owner_user_id"?: string | null,"period": string,"scope": string,"scope_id": string,"starts_on"?: string,"status"?: string,"target_value": number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"direction"?: string,"due_date"?: string | null,"id"?: string,"metric_key"?: string,"organization_id"?: string,"owner_user_id"?: string | null,"period"?: string,"scope"?: string,"scope_id"?: string,"starts_on"?: string,"status"?: string,"target_value"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goals_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goals_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"inbound_events": {
                  Row: {
                    "attempts": number,"channel_account_id": string,"conversation_id": string | null,"error_code": string | null,"id": string,"message_id": string | null,"organization_id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider_event_id": string,"received_at": string,"status": string
                  }
                  Insert: {
                    "attempts"?: number,"channel_account_id": string,"conversation_id"?: string | null,"error_code"?: string | null,"id"?: string,"message_id"?: string | null,"organization_id": string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider_event_id": string,"received_at"?: string,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"channel_account_id"?: string,"conversation_id"?: string | null,"error_code"?: string | null,"id"?: string,"message_id"?: string | null,"organization_id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider_event_id"?: string,"received_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbound_events_account_same_org"
      columns: ["channel_account_id","organization_id"]
isOneToOne: false
      referencedRelation: "channel_accounts"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "inbound_events_conversation_same_org"
      columns: ["conversation_id","organization_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "inbound_events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_secrets": {
                  Row: {
                    "ciphertext": string,"created_at": string,"encrypted_data_key": string,"id": string,"key_ref": string,"kind": string,"name": string,"organization_id": string,"rotated_at": string | null
                  }
                  Insert: {
                    "ciphertext": string,"created_at"?: string,"encrypted_data_key": string,"id"?: string,"key_ref": string,"kind": string,"name": string,"organization_id": string,"rotated_at"?: string | null
                  }
                  Update: {
                    "ciphertext"?: string,"created_at"?: string,"encrypted_data_key"?: string,"id"?: string,"key_ref"?: string,"kind"?: string,"name"?: string,"organization_id"?: string,"rotated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "integration_secrets_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"integrations": {
                  Row: {
                    "connected_by": string | null,"created_at": string,"id": string,"kind": string,"last_health_check": string | null,"location_id": string | null,"organization_id": string,"provider": string,"scopes": (string)[],"secret_id": string | null,"server_version": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "connected_by"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"last_health_check"?: string | null,"location_id"?: string | null,"organization_id": string,"provider": string,"scopes"?: (string)[],"secret_id"?: string | null,"server_version"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "connected_by"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"last_health_check"?: string | null,"location_id"?: string | null,"organization_id"?: string,"provider"?: string,"scopes"?: (string)[],"secret_id"?: string | null,"server_version"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integrations_connected_by_fkey"
      columns: ["connected_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "integrations_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "integrations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "integrations_secret_same_org"
      columns: ["secret_id","organization_id"]
isOneToOne: false
      referencedRelation: "integration_secrets"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string,"organization_id": string,"revoked_at": string | null,"role": string,"scope_location_ids": (string)[],"scope_region_ids": (string)[],"token_hash": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by": string,"organization_id": string,"revoked_at"?: string | null,"role": string,"scope_location_ids"?: (string)[],"scope_region_ids"?: (string)[],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string,"organization_id"?: string,"revoked_at"?: string | null,"role"?: string,"scope_location_ids"?: (string)[],"scope_region_ids"?: (string)[],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"knowledge_chunks": {
                  Row: {
                    "content": string,"created_at": string,"embedding": string,"embedding_dim": number,"embedding_model": string,"id": string,"location_id": string | null,"ordinal": number,"organization_id": string,"source_id": string,"tsv": unknown,"valid_until": string | null
                  }
                  Insert: {
                    "content": string,"created_at"?: string,"embedding": string,"embedding_dim": number,"embedding_model": string,"id"?: string,"location_id"?: string | null,"ordinal": number,"organization_id": string,"source_id": string,"tsv"?: never,"valid_until"?: string | null
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"embedding"?: string,"embedding_dim"?: number,"embedding_model"?: string,"id"?: string,"location_id"?: string | null,"ordinal"?: number,"organization_id"?: string,"source_id"?: string,"tsv"?: never,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_chunks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_chunks_source_same_org"
      columns: ["source_id","organization_id"]
isOneToOne: false
      referencedRelation: "knowledge_sources"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"knowledge_requests": {
                  Row: {
                    "agent_id": string,"answer": string | null,"answered_at": string | null,"answered_by": string | null,"assigned_role": string,"conversation_id": string | null,"created_at": string,"id": string,"idempotency_key": string | null,"location_id": string | null,"organization_id": string,"question": string,"resulting_source_id": string | null,"run_id": string | null,"status": string,"updated_at": string
                  }
                  Insert: {
                    "agent_id": string,"answer"?: string | null,"answered_at"?: string | null,"answered_by"?: string | null,"assigned_role": string,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key"?: string | null,"location_id"?: string | null,"organization_id": string,"question": string,"resulting_source_id"?: string | null,"run_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "agent_id"?: string,"answer"?: string | null,"answered_at"?: string | null,"answered_by"?: string | null,"assigned_role"?: string,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key"?: string | null,"location_id"?: string | null,"organization_id"?: string,"question"?: string,"resulting_source_id"?: string | null,"run_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_requests_agent_same_org"
      columns: ["agent_id","organization_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "knowledge_requests_answered_by_fkey"
      columns: ["answered_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_requests_conversation_same_org"
      columns: ["conversation_id","organization_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "knowledge_requests_location_same_org"
      columns: ["location_id","organization_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "knowledge_requests_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_requests_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "agent_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_requests_source_same_org"
      columns: ["resulting_source_id","organization_id"]
isOneToOne: false
      referencedRelation: "knowledge_sources"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"knowledge_sources": {
                  Row: {
                    "body": string | null,"created_at": string,"created_by": string | null,"id": string,"location_id": string | null,"organization_id": string,"status": string,"storage_path": string | null,"title": string,"type": string,"updated_at": string
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location_id"?: string | null,"organization_id": string,"status"?: string,"storage_path"?: string | null,"title": string,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location_id"?: string | null,"organization_id"?: string,"status"?: string,"storage_path"?: string | null,"title"?: string,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "knowledge_sources_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_sources_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "knowledge_sources_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "address": string | null,"created_at": string,"id": string,"name": string,"opening_hours": NonNullable<Json>,"organization_id": string,"region_id": string | null,"status": string,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"id"?: string,"name": string,"opening_hours"?: NonNullable<Json>,"organization_id": string,"region_id"?: string | null,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"opening_hours"?: NonNullable<Json>,"organization_id"?: string,"region_id"?: string | null,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "locations_organization_id_region_id_fkey"
      columns: ["organization_id","region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"role": string,"scope_location_ids": (string)[],"scope_region_ids": (string)[],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"role": string,"scope_location_ids"?: (string)[],"scope_region_ids"?: (string)[],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"role"?: string,"scope_location_ids"?: (string)[],"scope_region_ids"?: (string)[],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachments": NonNullable<Json>,"author": string,"author_user_id": string | null,"content": string,"conversation_id": string,"created_at": string,"delivery_error": string | null,"direction": string,"external_message_id": string | null,"id": string,"idempotency_key": string | null,"organization_id": string,"status": string,"status_changed_at": string | null
                  }
                  Insert: {
                    "attachments"?: NonNullable<Json>,"author": string,"author_user_id"?: string | null,"content": string,"conversation_id": string,"created_at"?: string,"delivery_error"?: string | null,"direction": string,"external_message_id"?: string | null,"id"?: string,"idempotency_key"?: string | null,"organization_id": string,"status"?: string,"status_changed_at"?: string | null
                  }
                  Update: {
                    "attachments"?: NonNullable<Json>,"author"?: string,"author_user_id"?: string | null,"content"?: string,"conversation_id"?: string,"created_at"?: string,"delivery_error"?: string | null,"direction"?: string,"external_message_id"?: string | null,"id"?: string,"idempotency_key"?: string | null,"organization_id"?: string,"status"?: string,"status_changed_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_author_user_id_fkey"
      columns: ["author_user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_conversation_same_org"
      columns: ["conversation_id","organization_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"org_model_settings": {
                  Row: {
                    "allowed_providers": (string)[],"budget_per_day_eur": number,"budget_per_month_eur": number,"budget_per_run_eur": number,"connection": string,"model_by_task": NonNullable<Json>,"organization_id": string,"residency": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "allowed_providers"?: (string)[],"budget_per_day_eur"?: number,"budget_per_month_eur"?: number,"budget_per_run_eur"?: number,"connection"?: string,"model_by_task"?: NonNullable<Json>,"organization_id": string,"residency"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "allowed_providers"?: (string)[],"budget_per_day_eur"?: number,"budget_per_month_eur"?: number,"budget_per_run_eur"?: number,"connection"?: string,"model_by_task"?: NonNullable<Json>,"organization_id"?: string,"residency"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_model_settings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: true
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "org_model_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "contract_type": string,"created_at": string,"data_region": string,"default_locale": string,"id": string,"kind": string,"name": string,"plan": string | null,"status": string,"updated_at": string,"vertical": string | null
                  }
                  Insert: {
                    "contract_type"?: string,"created_at"?: string,"data_region"?: string,"default_locale"?: string,"id"?: string,"kind"?: string,"name": string,"plan"?: string | null,"status"?: string,"updated_at"?: string,"vertical"?: string | null
                  }
                  Update: {
                    "contract_type"?: string,"created_at"?: string,"data_region"?: string,"default_locale"?: string,"id"?: string,"kind"?: string,"name"?: string,"plan"?: string | null,"status"?: string,"updated_at"?: string,"vertical"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"platform_staff": {
                  Row: {
                    "created_at": string,"id": string,"revoked_at": string | null,"role": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"revoked_at"?: string | null,"role": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"revoked_at"?: string | null,"role"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_staff_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"regions": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"organization_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "regions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"resource_services": {
                  Row: {
                    "organization_id": string,"resource_id": string,"service_id": string
                  }
                  Insert: {
                    "organization_id": string,"resource_id": string,"service_id": string
                  }
                  Update: {
                    "organization_id"?: string,"resource_id"?: string,"service_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "resource_services_resource_same_org"
      columns: ["resource_id","organization_id"]
isOneToOne: false
      referencedRelation: "booking_resources"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "resource_services_service_same_org"
      columns: ["service_id","organization_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"services": {
                  Row: {
                    "active": boolean,"created_at": string,"duration_minutes": number,"external_ref": string | null,"id": string,"location_id": string | null,"name": string,"organization_id": string,"updated_at": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"duration_minutes": number,"external_ref"?: string | null,"id"?: string,"location_id"?: string | null,"name": string,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"duration_minutes"?: number,"external_ref"?: string | null,"id"?: string,"location_id"?: string | null,"name"?: string,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "services_location_same_org"
      columns: ["location_id","organization_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "services_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"skills": {
                  Row: {
                    "created_at": string,"default_autonomy": string,"definition": Json | null,"description": string,"effect_class": string,"id": string,"input_schema": NonNullable<Json>,"integration_id": string | null,"key": string,"kind": string,"max_autonomy": string,"mcp_tool_hash": string | null,"mcp_tool_name": string | null,"name": string,"organization_id": string | null,"output_schema": NonNullable<Json>,"required_integration": string | null,"restricted_to_agent_types": (string)[],"status": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "created_at"?: string,"default_autonomy": string,"definition"?: Json | null,"description"?: string,"effect_class": string,"id"?: string,"input_schema"?: NonNullable<Json>,"integration_id"?: string | null,"key": string,"kind": string,"max_autonomy": string,"mcp_tool_hash"?: string | null,"mcp_tool_name"?: string | null,"name": string,"organization_id"?: string | null,"output_schema"?: NonNullable<Json>,"required_integration"?: string | null,"restricted_to_agent_types"?: (string)[],"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"default_autonomy"?: string,"definition"?: Json | null,"description"?: string,"effect_class"?: string,"id"?: string,"input_schema"?: NonNullable<Json>,"integration_id"?: string | null,"key"?: string,"kind"?: string,"max_autonomy"?: string,"mcp_tool_hash"?: string | null,"mcp_tool_name"?: string | null,"name"?: string,"organization_id"?: string | null,"output_schema"?: NonNullable<Json>,"required_integration"?: string | null,"restricted_to_agent_types"?: (string)[],"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "skills_integration_same_org"
      columns: ["integration_id","organization_id"]
isOneToOne: false
      referencedRelation: "integrations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "skills_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"support_grants": {
                  Row: {
                    "created_at": string,"expires_at": string,"granted_by": string,"id": string,"organization_id": string,"reason": string,"revoked_at": string | null,"staff_user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"expires_at": string,"granted_by": string,"id"?: string,"organization_id": string,"reason": string,"revoked_at"?: string | null,"staff_user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"granted_by"?: string,"id"?: string,"organization_id"?: string,"reason"?: string,"revoked_at"?: string | null,"staff_user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_grants_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "support_grants_staff_user_id_fkey"
      columns: ["staff_user_id"]
isOneToOne: false
      referencedRelation: "platform_staff"
      referencedColumns: ["user_id"]
    }
                  ]
                },"usage_records": {
                  Row: {
                    "agent_id": string | null,"call_index": number | null,"cost_eur": number,"created_at": string,"id": string,"location_id": string | null,"metric": string,"model": string,"model_key": string | null,"occurred_at": string,"organization_id": string,"provider": string,"quantity": number,"region": string,"run_id": string | null,"source": string,"tokens_in": number,"tokens_out": number,"via": string
                  }
                  Insert: {
                    "agent_id"?: string | null,"call_index"?: number | null,"cost_eur": number,"created_at"?: string,"id"?: string,"location_id"?: string | null,"metric": string,"model": string,"model_key"?: string | null,"occurred_at"?: string,"organization_id": string,"provider": string,"quantity": number,"region": string,"run_id"?: string | null,"source": string,"tokens_in"?: number,"tokens_out"?: number,"via": string
                  }
                  Update: {
                    "agent_id"?: string | null,"call_index"?: number | null,"cost_eur"?: number,"created_at"?: string,"id"?: string,"location_id"?: string | null,"metric"?: string,"model"?: string,"model_key"?: string | null,"occurred_at"?: string,"organization_id"?: string,"provider"?: string,"quantity"?: number,"region"?: string,"run_id"?: string | null,"source"?: string,"tokens_in"?: number,"tokens_out"?: number,"via"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_records_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_records_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_records_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "agent_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"locale": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"locale"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"locale"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"waitlist_entries": {
                  Row: {
                    "contact_id": string,"conversation_id": string | null,"created_at": string,"id": string,"idempotency_key": string,"location_id": string,"offer_expires_at": string | null,"offer_ref": string | null,"offered_ends_at": string | null,"offered_resource_id": string | null,"offered_starts_at": string | null,"organization_id": string,"service_id": string,"status": string,"updated_at": string,"wanted_from": string,"wanted_until": string
                  }
                  Insert: {
                    "contact_id": string,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key": string,"location_id": string,"offer_expires_at"?: string | null,"offer_ref"?: string | null,"offered_ends_at"?: string | null,"offered_resource_id"?: string | null,"offered_starts_at"?: string | null,"organization_id": string,"service_id": string,"status"?: string,"updated_at"?: string,"wanted_from": string,"wanted_until": string
                  }
                  Update: {
                    "contact_id"?: string,"conversation_id"?: string | null,"created_at"?: string,"id"?: string,"idempotency_key"?: string,"location_id"?: string,"offer_expires_at"?: string | null,"offer_ref"?: string | null,"offered_ends_at"?: string | null,"offered_resource_id"?: string | null,"offered_starts_at"?: string | null,"organization_id"?: string,"service_id"?: string,"status"?: string,"updated_at"?: string,"wanted_from"?: string,"wanted_until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "waitlist_entries_contact_same_org"
      columns: ["contact_id","organization_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "waitlist_entries_conversation_same_org"
      columns: ["conversation_id","organization_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "waitlist_entries_location_same_org"
      columns: ["location_id","organization_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "waitlist_entries_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waitlist_entries_resource_same_org"
      columns: ["offered_resource_id","organization_id"]
isOneToOne: false
      referencedRelation: "booking_resources"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "waitlist_entries_service_same_org"
      columns: ["service_id","organization_id"]
isOneToOne: false
      referencedRelation: "services"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                }
          }
          Views: {
            "usage_summary": {
                  Row: {
                    "agent_id": string | null,"calls": number | null,"cost_eur": number | null,"day": string | null,"location_id": string | null,"model": string | null,"organization_id": string | null,"provider": string | null,"region": string | null,"source": string | null,"tokens_in": number | null,"tokens_out": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_records_agent_id_fkey"
      columns: ["agent_id"]
isOneToOne: false
      referencedRelation: "agents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_records_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usage_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"agent_turn_context":
{ Args: { "p_agent_id": string,"p_organization_id": string }; Returns: Json
                           },
"approval_notification":
{ Args: { "p_approval_id": string,"p_organization_id": string }; Returns: Json
                           },
"close_test_conversation":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"create_invitation":
{ Args: { "p_email": string,"p_organization_id": string,"p_role": string,"p_scope_location_ids"?: (string)[],"p_scope_region_ids"?: (string)[] }; Returns: string
                           },
"find_booking_slots":
{ Args: { "p_exclude_appointment"?: string,"p_from": string,"p_limit": number,"p_location_id": string,"p_organization_id": string,"p_service_id": string,"p_to": string }; Returns: {
              "ends_at": string,"resource_id": string,"starts_at": string
            }[]
                           },
"login_record_failure":
{ Args: { "p_email": string,"p_ip": string,"p_key": string }; Returns: undefined
                           },
"login_record_success":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"login_throttle":
{ Args: { "p_email": string,"p_ip": string,"p_key": string }; Returns: number
                           },
"register_server_key":
{ Args: { "p_key_hash": string,"p_name": string }; Returns: undefined
                           },
"search_knowledge":
{ Args: { "p_embedding_model": string,"p_k": number,"p_location_id": string,"p_organization_id": string,"p_query": string,"p_query_embedding": string }; Returns: {
              "chunk_id": string,"content": string,"score": number,"source_id": string,"source_title": string,"source_type": string
            }[]
                           },
"send_test_message":
{ Args: { "p_agent_id": string,"p_content": string,"p_location_id": string }; Returns: string
                           },
"usage_spend":
{ Args: { "p_day_start": string,"p_month_start": string,"p_organization_id": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
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
  "public": {
          Enums: {
            
          }
        }
} as const

