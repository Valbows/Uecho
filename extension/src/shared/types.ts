/**
 * U:Echo — Core Type Definitions
 * FR-10 Prompt Schema + shared types used across extension layers
 */

// ─── Bounding Box ───────────────────────────────────────────────
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Gesture Types ──────────────────────────────────────────────
export type ActionType = 'resize' | 'move' | 'text' | 'color' | 'image' | 'code';

export interface GestureDelta {
  resize_right?: number;
  resize_bottom?: number;
  resize_left?: number;
  resize_top?: number;
  move_x?: number;
  move_y?: number;
}

export interface GestureEvent {
  type: ActionType;
  selector: string;
  before_bbox: BoundingBox;
  after_bbox: BoundingBox;
  delta: GestureDelta;
  grid_cell?: { x: number; y: number; width: number; height: number };
  timestamp: number;
}

// ─── Element Metadata ───────────────────────────────────────────
export interface ElementInfo {
  tag_name: string;
  selector: string;
  xpath?: string;
  bounding_box: BoundingBox;
  computed_styles: {
    font_size?: string;
    color?: string;
    background_color?: string;
    padding?: string;
    margin?: string;
    display?: string;
    position?: string;
  };
  class_list: string[];
  id?: string;
}

// ─── Region Metadata Payload (FR-8) ────────────────────────────
export interface MetadataPayload {
  gesture: GestureEvent;
  screenshot_url: string;
  tab_id: number;
  page_url: string;
  scroll_x: number;
  scroll_y: number;
  viewport_width: number;
  viewport_height: number;
  extension_session_id: string;
  element_info?: ElementInfo;
}

// ─── FR-10 Prompt Schema ────────────────────────────────────────
export interface PromptSchema {
  feature_name: string;
  selector: string;
  component_path?: string;
  action_type: ActionType;
  current_dimensions: BoundingBox;
  target_dimensions: Partial<BoundingBox>;
  gesture_delta?: GestureDelta;
  visual_change_description: string;
  non_visual_changes?: string;
  screenshots: string[];
  retrieved_examples_used: string[];
  risk_notes?: string;
  open_questions?: string;
  // Extension-specific fields
  tab_url: string;
  route_path?: string;
  scroll_position: { x: number; y: number };
  extension_session_id: string;
  // Human-readable prompt
  prompt_text: string;
}

// ─── Verification Result ────────────────────────────────────────
export interface VerificationResult {
  schema_valid: boolean;
  safety_passed: boolean;
  consistency_passed: boolean;
  semantic_drift_score: number; // cosine similarity 0-1
  drift_warning: boolean; // true if < 0.80
  errors: string[];
  warnings: string[];
}

// ─── Agent Response ─────────────────────────────────────────────
export interface AgentResponse {
  interpreted_intent: string;
  prompt?: PromptSchema;
  verification?: VerificationResult;
  status: 'success' | 'error' | 'needs_review';
  error_message?: string;
}

// ─── Session ────────────────────────────────────────────────────
export interface EchoSession {
  session_id: string;
  user_id: string;
  tab_url: string;
  overlay_mode: OverlayMode;
  agent_active: boolean;
  created_at: number;
  updated_at: number;
}

// ─── Settings ───────────────────────────────────────────────────
export type OverlayMode = 'grid' | 'divbox' | 'off';
export type IDETarget = 'vscode' | 'cursor' | 'windsurf' | 'antigravity' | 'generic';

export interface UserSettings {
  grid_cell_size: number;
  overlay_mode: OverlayMode;
  ide_target: IDETarget;
  webhook_url?: string;
  mcp_bridge_token?: string;
}

// ─── History / Request Record ───────────────────────────────────
export interface RequestRecord {
  request_id: string;
  session_id: string;
  action_type: ActionType;
  selector: string;
  interpreted_intent: string;
  prompt?: PromptSchema;
  verification?: VerificationResult;
  screenshot_url?: string;
  status: 'pending' | 'processing' | 'verified' | 'sent' | 'failed';
  created_at: number;
  updated_at: number;
}

// ─── Chat Message ───────────────────────────────────────────────
export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: number;
  metadata?: {
    gesture_event?: GestureEvent;
    prompt?: PromptSchema;
    is_auto_populated?: boolean;
  };
}

// ─── Connectivity Status ────────────────────────────────────────
export interface ConnectivityStatus {
  extension: boolean;
  backend: boolean;
  ide_bridge: boolean;
}
