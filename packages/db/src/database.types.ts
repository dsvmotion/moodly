
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "agent_runs": {
                  Row: {
                    "agent_id": string,"config_snapshot_id": string | null,"cost_eur": number,"created_at": string,"id": string,"location_id": string | null,"model": string | null,"organization_id": string,"status": string,"tokens_in": number,"tokens_out": number,"trigger": string,"trigger_ref": string | null,"updated_at": string,"workflow_id": string | null
                  }
                  Insert: {
                    "agent_id": string,"config_snapshot_id"?: string | null,"cost_eur"?: number,"created_at"?: string,"id"?: string,"location_id"?: string | null,"model"?: string | null,"organization_id": string,"status"?: string,"tokens_in"?: number,"tokens_out"?: number,"trigger": string,"trigger_ref"?: string | null,"updated_at"?: string,"workflow_id"?: string | null
                  }
                  Update: {
                    "agent_id"?: string,"config_snapshot_id"?: string | null,"cost_eur"?: number,"created_at"?: string,"id"?: string,"location_id"?: string | null,"model"?: string | null,"organization_id"?: string,"status"?: string,"tokens_in"?: number,"tokens_out"?: number,"trigger"?: string,"trigger_ref"?: string | null,"updated_at"?: string,"workflow_id"?: string | null
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
                },"approvals": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"effect_class": string,"execution_id": string,"expires_at": string,"id": string,"input_hash": string,"location_id": string | null,"organization_id": string,"reason": string | null,"required_role": string,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"effect_class": string,"execution_id": string,"expires_at": string,"id"?: string,"input_hash": string,"location_id"?: string | null,"organization_id": string,"reason"?: string | null,"required_role": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"effect_class"?: string,"execution_id"?: string,"expires_at"?: string,"id"?: string,"input_hash"?: string,"location_id"?: string | null,"organization_id"?: string,"reason"?: string | null,"required_role"?: string,"status"?: string
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
                },"skills": {
                  Row: {
                    "created_at": string,"default_autonomy": string,"definition": Json | null,"description": string,"effect_class": string,"id": string,"input_schema": NonNullable<Json>,"integration_id": string | null,"key": string,"kind": string,"max_autonomy": string,"name": string,"organization_id": string | null,"output_schema": NonNullable<Json>,"required_integration": string | null,"restricted_to_agent_types": (string)[],"status": string,"updated_at": string,"version": number
                  }
                  Insert: {
                    "created_at"?: string,"default_autonomy": string,"definition"?: Json | null,"description"?: string,"effect_class": string,"id"?: string,"input_schema"?: NonNullable<Json>,"integration_id"?: string | null,"key": string,"kind": string,"max_autonomy": string,"name": string,"organization_id"?: string | null,"output_schema"?: NonNullable<Json>,"required_integration"?: string | null,"restricted_to_agent_types"?: (string)[],"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"default_autonomy"?: string,"definition"?: Json | null,"description"?: string,"effect_class"?: string,"id"?: string,"input_schema"?: NonNullable<Json>,"integration_id"?: string | null,"key"?: string,"kind"?: string,"max_autonomy"?: string,"name"?: string,"organization_id"?: string | null,"output_schema"?: NonNullable<Json>,"required_integration"?: string | null,"restricted_to_agent_types"?: (string)[],"status"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"create_invitation":
{ Args: { "p_email": string,"p_organization_id": string,"p_role": string,"p_scope_location_ids"?: (string)[],"p_scope_region_ids"?: (string)[] }; Returns: string
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

