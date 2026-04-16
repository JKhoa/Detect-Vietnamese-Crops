import { useState, useRef, useCallback } from 'react';

export type FacingMode = 'user' | 'environment';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isActive: boolean;
  facingMode: FacingMode;
  error: string | null;
  startCamera: (facing?: FacingMode) => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  captureFrame: () => ImageData | null;
  captureBlob: () => Promise<Blob | null>;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (facing: FacingMode = 'environment') => {
    try {
      setError(null);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      setFacingMode(facing);
      setIsActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể mở camera';
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setError('Quyền truy cập camera bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.');
      } else if (msg.includes('NotFoundError')) {
        setError('Không tìm thấy camera. Vui lòng kiểm tra thiết bị.');
      } else {
        setError(`Lỗi camera: ${msg}`);
      }
      setIsActive(false);
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setError(null);
  }, [stream]);

  const switchCamera = useCallback(async () => {
    const newFacing: FacingMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(newFacing);
  }, [facingMode, startCamera]);

  const captureFrame = useCallback((): ImageData | null => {
    if (!videoRef.current || !isActive) return null;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [isActive]);

  const captureBlob = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !isActive) return null;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  }, [isActive]);

  return {
    videoRef,
    stream,
    isActive,
    facingMode,
    error,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame,
    captureBlob,
  };
}
