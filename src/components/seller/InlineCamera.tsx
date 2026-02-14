import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, RotateCcw, SwitchCamera, Loader2 } from 'lucide-react';

interface InlineCameraProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

export function InlineCamera({ onCapture, onClose }: InlineCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsReady(false);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsReady(true);
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Kamera ruxsati berilmadi. Brauzer sozlamalaridan ruxsat bering.');
      } else if (err.name === 'NotFoundError') {
        setError('Kamera topilmadi.');
      } else {
        setError('Kamerani ochishda xatolik yuz berdi.');
      }
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwitchCamera = () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Use actual video dimensions for best quality
    const width = video.videoWidth;
    const height = video.videoHeight;

    // Scale down if too large (prevent memory issues)
    const maxSize = 1200;
    let targetW = width;
    let targetH = height;
    if (width > maxSize || height > maxSize) {
      if (width > height) {
        targetH = Math.round((height / width) * maxSize);
        targetW = maxSize;
      } else {
        targetW = Math.round((width / height) * maxSize);
        targetH = maxSize;
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, targetW, targetH);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);

    // Free canvas memory
    canvas.width = 0;
    canvas.height = 0;

    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    onCapture(base64);
  };

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    onClose();
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black">
        <div className="flex flex-col items-center justify-center h-full text-white p-4 text-center gap-4">
          <Camera className="h-10 w-10 opacity-50" />
          <p className="text-sm">{error}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => startCamera(facingMode)}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Qayta urinish
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-white">
              Yopish
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Video feed — fullscreen */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full flex-1 object-cover"
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
      />

      {/* Hidden canvas for snapshot */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading overlay */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 to-transparent z-[60]">
        <div className="flex items-center justify-between">
          {/* Close */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-10 w-10"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Capture */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-14 w-14 rounded-full border-4 border-white bg-white/20 hover:bg-white/40"
            onClick={handleCapture}
            disabled={!isReady}
          >
            <div className="h-10 w-10 rounded-full bg-white" />
          </Button>

          {/* Switch camera */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-10 w-10"
            onClick={handleSwitchCamera}
          >
            <SwitchCamera className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
