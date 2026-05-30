export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x_norm: number;
  y_norm: number;
  w_norm: number;
  h_norm: number;
}

export interface TopKPrediction {
  class_name: string;
  class_id: number;
  confidence: number;
  display_name?: string;
}

export interface DetectedObject {
  id: string;
  class_id: number;
  class_name: string;
  display_name?: string;
  confidence: number;
  bbox: BoundingBox;
  top_k: TopKPrediction[];
}

export interface DetectionFrame {
  frame_index: number;
  timestamp: number;
  objects: DetectedObject[];
  inference_time_ms: number;
}

export interface ImageDetectionResult {
  session_id: string;
  image_width: number;
  image_height: number;
  objects: DetectedObject[];
  inference_time_ms: number;
  created_at: string;
  annotated_image_url?: string;
}

export interface VideoDetectionResult {
  session_id: string;
  total_frames: number;
  processed_frames: number;
  fps: number;
  duration_seconds: number;
  frames: DetectionFrame[];
  annotated_video_url?: string;
  result_json_url?: string;
  created_at: string;
}

export interface RealtimeDetectionResult {
  frame_id: number;
  objects: DetectedObject[];
  inference_time_ms: number;
  fps: number;
}

export interface ProductMetadata {
  class_name: string;
  class_id: number;
  name_vi: string;
  name_en: string;
  group: string;
  varieties: string[];
  characteristics: string[];
  season: string;
  growing_regions: string[];
  nutrition: string[];
  storage: string;
  usage_suggestions: string[];
  ripeness_indicators?: string[];
  color_tag: string;
  emoji: string;
}

export interface DetectionSession {
  session_id: string;
  type: 'image' | 'video' | 'realtime';
  created_at: string;
  objects_count: number;
  unique_classes: string[];
  thumbnail_url?: string;
  duration_seconds?: number;
}

export interface HealthCheckResponse {
  status: string;
  model_loaded: boolean;
  model_path: string;
  classes_count: number;
  version: string;
  uptime_seconds: number;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type DetectionMode = 'camera' | 'image' | 'video';
export type AppPage = 'home' | 'detect' | 'history';
